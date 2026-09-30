import {
  AdditiveBlending,
  BackSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
} from 'three';
import coreVertex from '../shaders/core.vert.glsl?raw';
import coreFragment from '../shaders/core.frag.glsl?raw';
import noise from '../shaders/noise.glsl?raw';
import { LAYOUT } from './layout.js';
import { toThreeColor } from '../utils/color.js';

/**
 * The company itself, at the centre of the cycle.
 *
 * A faceted crystal rather than a smooth ball: the flat faces give it an edge
 * that survives bloom, where a high-poly sphere just turns into a bright smudge.
 * Its pulse is fed by how much traffic the current filter leaves visible, so a
 * busy model visibly beats faster than a filtered-down one.
 */
export function createCore() {
  const group = new Group();

  // Polyhedron geometries are already non-indexed, so recomputing the normals
  // is all that is needed to get genuinely flat faces.
  const crystal = new IcosahedronGeometry(LAYOUT.coreRadius, 1);
  crystal.computeVertexNormals();

  const material = new ShaderMaterial({
    vertexShader: `${noise}\n${coreVertex}`,
    fragmentShader: coreFragment,
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0.5 },
      uAmplitude: { value: 0.07 },
      uColorInner: { value: toThreeColor('#101c42').clone() },
      uColorOuter: { value: toThreeColor('#6ea0e8').clone() },
    },
  });

  const mesh = new Mesh(crystal, material);
  group.add(mesh);

  const shell = new Mesh(
    new IcosahedronGeometry(LAYOUT.coreRadius * 1.55, 1),
    new MeshBasicMaterial({
      color: toThreeColor('#7fb2ff'),
      wireframe: true,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  group.add(shell);

  const glow = new Mesh(
    new IcosahedronGeometry(LAYOUT.coreRadius * 2.6, 12),
    new MeshBasicMaterial({
      color: toThreeColor('#3f6dbd'),
      transparent: true,
      opacity: 0.05,
      side: BackSide,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(glow);

  let pulse = 0.5;

  return {
    group,
    /** @param {number} traffic 0..1 share of the model currently lit */
    setTraffic(traffic) {
      pulse = traffic;
    },
    update(elapsed, delta) {
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uPulse.value +=
        (pulse - material.uniforms.uPulse.value) * Math.min(delta * 2.5, 1);

      mesh.rotation.set(elapsed * 0.03, elapsed * 0.07, 0);
      shell.rotation.set(-elapsed * 0.05, -elapsed * 0.04, elapsed * 0.02);
      shell.material.opacity = 0.13 + Math.sin(elapsed * 1.1) * 0.04;
      glow.scale.setScalar(1 + Math.sin(elapsed * 0.9) * 0.02);
    },
    setIntro(progress) {
      group.scale.setScalar(Math.max(progress, 0.001));
      glow.material.opacity = 0.05 * progress;
    },
  };
}
