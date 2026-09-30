import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Points,
  ShaderMaterial,
} from 'three';
import particleVertex from '../shaders/particle.vert.glsl?raw';
import particleFragment from '../shaders/particle.frag.glsl?raw';
import { APP_BY_ID } from '../data/apps.js';
import { FLOWS, FLOW_BY_ID } from '../data/flows.js';
import { UI_COLORS, toThreeColor } from '../utils/color.js';
import { sampleCurve } from '../utils/curves.js';
import { emphasisForLink, subscribe } from '../state.js';

const CURVE_SAMPLES = 160;
const LINE_EMPHASIS_OPACITY = { focus: 0.75, normal: 0.22, dim: 0.04 };
// Planned links are drawn dashed and dimmer: they describe intent, not traffic.
const GHOST_OPACITY_SCALE = 0.45;
const PARTICLE_EMPHASIS = { focus: 1, normal: 0.7, dim: 0.05 };

/**
 * Links and the particles travelling along them.
 *
 * A link only carries particles when both of its ends are live - a planned tool
 * gets a dashed, still line instead. Motion in this scene therefore always means
 * something that actually moves today.
 */
export function createFlowStreams(links, { particlesPerLink }) {
  const group = new Group();
  const lineEntries = [];
  const flowStreams = [];

  for (const link of links) {
    const points = link.curve.getPoints(CURVE_SAMPLES - 1);
    const geometry = new BufferGeometry().setFromPoints(points);
    const color = toThreeColor(link.ghost ? UI_COLORS.planned : FLOW_BY_ID[link.flow].color);

    const material = link.ghost
      ? new LineDashedMaterial({
          color,
          transparent: true,
          opacity: 0.18,
          dashSize: 0.8,
          gapSize: 0.7,
          depthWrite: false,
        })
      : new LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.22,
          blending: AdditiveBlending,
          depthWrite: false,
        });

    const line = new Line(geometry, material);
    if (link.ghost) line.computeLineDistances();
    group.add(line);

    lineEntries.push({ link, material, opacity: material.opacity, target: material.opacity });
  }

  for (const flow of FLOWS) {
    const flowLinks = links.filter((link) => link.flow === flow.id && !link.ghost);
    if (flowLinks.length === 0) continue;

    const curves = flowLinks.map((link) => sampleCurve(link.curve, CURVE_SAMPLES));
    const count = flowLinks.length * particlesPerLink;

    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const fades = new Float32Array(count);
    const linkIndex = new Uint16Array(count);
    const offsets = new Float32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const li = Math.floor(i / particlesPerLink);
      linkIndex[i] = li;
      // Even spacing plus a little jitter, so a stream reads as a flow and not
      // as a marching grid.
      offsets[i] = (i % particlesPerLink) / particlesPerLink + Math.random() * 0.012;
      speeds[i] = 0.055 + Math.random() * 0.03;
      sizes[i] = 120 + Math.random() * 90;
      fades[i] = 0;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aFade', new BufferAttribute(fades, 1));

    const material = new ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: {
        uColor: { value: toThreeColor(flow.color).clone() },
        uScale: { value: 1 },
        uOpacity: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const points = new Points(geometry, material);
    points.frustumCulled = false;
    group.add(points);

    flowStreams.push({
      flow,
      links: flowLinks,
      curves,
      geometry,
      material,
      positions,
      fades,
      linkIndex,
      offsets,
      speeds,
      count,
      linkOpacity: new Float32Array(flowLinks.length).fill(PARTICLE_EMPHASIS.normal),
      linkTarget: new Float32Array(flowLinks.length).fill(PARTICLE_EMPHASIS.normal),
    });
  }

  function applyState() {
    for (const entry of lineEntries) {
      const emphasis = emphasisForLink(entry.link, APP_BY_ID);
      entry.target =
        LINE_EMPHASIS_OPACITY[emphasis] * (entry.link.ghost ? GHOST_OPACITY_SCALE : 1);
    }
    for (const stream of flowStreams) {
      stream.links.forEach((link, index) => {
        stream.linkTarget[index] = PARTICLE_EMPHASIS[emphasisForLink(link, APP_BY_ID)];
      });
    }
  }

  applyState();
  subscribe(applyState);

  let introProgress = 1;

  return {
    group,
    update(elapsed, delta) {
      const ease = Math.min(delta * 5, 1);

      for (const entry of lineEntries) {
        entry.opacity += (entry.target - entry.opacity) * ease;
        entry.material.opacity = entry.opacity * introProgress;
      }

      for (const stream of flowStreams) {
        for (let i = 0; i < stream.linkOpacity.length; i += 1) {
          stream.linkOpacity[i] += (stream.linkTarget[i] - stream.linkOpacity[i]) * ease;
        }

        const { positions, fades, curves, linkIndex, offsets, speeds, count } = stream;
        for (let i = 0; i < count; i += 1) {
          const li = linkIndex[i];
          const curve = curves[li];
          const t = (offsets[i] + elapsed * speeds[i]) % 1;

          const scaled = t * (CURVE_SAMPLES - 1);
          const i0 = Math.floor(scaled);
          const i1 = Math.min(i0 + 1, CURVE_SAMPLES - 1);
          const mix = scaled - i0;

          const a = i0 * 3;
          const b = i1 * 3;
          const p = i * 3;
          positions[p] = curve[a] + (curve[b] - curve[a]) * mix;
          positions[p + 1] = curve[a + 1] + (curve[b + 1] - curve[a + 1]) * mix;
          positions[p + 2] = curve[a + 2] + (curve[b + 2] - curve[a + 2]) * mix;

          // Fade in and out at the endpoints so particles are born and absorbed
          // by the tools rather than popping mid-air.
          const edge = Math.min(t, 1 - t);
          fades[i] = Math.min(1, edge / 0.12) * stream.linkOpacity[li];
        }

        stream.geometry.attributes.position.needsUpdate = true;
        stream.geometry.attributes.aFade.needsUpdate = true;
        stream.material.uniforms.uOpacity.value = introProgress;
      }
    },
    setParticleScale(scale) {
      for (const stream of flowStreams) stream.material.uniforms.uScale.value = scale;
    },
    setIntro(progress) {
      introProgress = Math.max(0, Math.min(1, (progress - 0.5) / 0.5));
    },
  };
}
