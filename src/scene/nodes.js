import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Group,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TetrahedronGeometry,
  Vector3,
} from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { APPS } from '../data/apps.js';
import { FLOW_BY_ID } from '../data/flows.js';
import { UI_COLORS, toThreeColor } from '../utils/color.js';
import { emphasisForApp, getState, setState, subscribe } from '../state.js';
import { buildLabelLifts } from './layout.js';

const NODE_RADIUS = 0.62;

/** Each flow owns a silhouette, so the model survives without colour. */
const SHAPES = {
  octahedron: () => new OctahedronGeometry(NODE_RADIUS, 0),
  box: () => new BoxGeometry(NODE_RADIUS * 1.25, NODE_RADIUS * 1.25, NODE_RADIUS * 1.25),
  icosahedron: () => new IcosahedronGeometry(NODE_RADIUS, 0),
  tetrahedron: () => new TetrahedronGeometry(NODE_RADIUS * 1.2, 0),
};

const EMPHASIS_SCALE = { focus: 1.35, normal: 1, dim: 0.85 };
const EMPHASIS_OPACITY = { focus: 1, normal: 0.92, dim: 0.22 };
// Lower wins when two labels compete for the same patch of screen.
const EMPHASIS_PRIORITY = { focus: 0, normal: 1, dim: 2 };

const geometryCache = new Map();
function geometryForShape(shape) {
  if (!geometryCache.has(shape)) {
    geometryCache.set(shape, (SHAPES[shape] ?? SHAPES.icosahedron)());
  }
  return geometryCache.get(shape);
}

export function createNodes(appPositions, { animateSpin = true } = {}) {
  const group = new Group();
  const nodes = new Map();
  const pickables = [];
  const labelLifts = buildLabelLifts(appPositions);

  for (const app of APPS) {
    const position = appPositions.get(app.id);
    if (!position) continue;

    const flow = FLOW_BY_ID[app.flow];
    const isPlanned = app.status === 'planned';
    const color = toThreeColor(flow.color);

    const holder = new Group();
    holder.position.copy(position);

    const material = isPlanned
      ? new MeshBasicMaterial({
          color: toThreeColor(UI_COLORS.planned),
          wireframe: true,
          transparent: true,
          opacity: 0.75,
        })
      : new MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.65,
          roughness: 0.35,
          metalness: 0.15,
          transparent: true,
          opacity: 1,
        });

    const mesh = new Mesh(geometryForShape(flow.shape), material);
    mesh.userData.appId = app.id;
    holder.add(mesh);
    pickables.push(mesh);

    // Generous invisible hit area - the visible shapes are small on purpose.
    const hitArea = new Mesh(
      new SphereGeometry(NODE_RADIUS * 2.4, 8, 6),
      new MeshBasicMaterial({ visible: false }),
    );
    hitArea.userData.appId = app.id;
    holder.add(hitArea);
    pickables.push(hitArea);

    const halo = new Mesh(
      new SphereGeometry(NODE_RADIUS * 1.6, 16, 12),
      new MeshBasicMaterial({
        color: isPlanned ? toThreeColor(UI_COLORS.planned) : color,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    holder.add(halo);

    const element = document.createElement('button');
    element.type = 'button';
    element.className = `node-label node-label--${app.flow}`;
    element.dataset.appId = app.id;
    element.innerHTML =
      `<span class="node-label__name">${app.name}</span>` +
      (isPlanned ? '<span class="node-label__badge">planned</span>' : '');
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      setState({ selected: app.id });
    });
    element.addEventListener('pointerenter', () => setState({ hovered: app.id }));
    element.addEventListener('pointerleave', () => setState({ hovered: null }));

    const lift = labelLifts.get(app.id) ?? 0;
    const labelY = NODE_RADIUS * 2.1 + lift;

    const label = new CSS2DObject(element);
    label.position.set(0, labelY, 0);
    holder.add(label);

    // A label pushed clear of its neighbours needs a leader, or it reads as
    // belonging to whatever node happens to sit under it. Drawn in 3D so it
    // stays exact at any zoom, unlike a CSS pseudo-element would.
    let leader = null;
    if (lift > 0.1) {
      const geometry = new BufferGeometry().setFromPoints([
        new Vector3(0, NODE_RADIUS * 1.15, 0),
        new Vector3(0, labelY - 0.2, 0),
      ]);
      leader = new Line(
        geometry,
        new LineBasicMaterial({
          color: isPlanned ? toThreeColor(UI_COLORS.planned) : color,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        }),
      );
      holder.add(leader);
    }

    group.add(holder);
    nodes.set(app.id, {
      app,
      holder,
      mesh,
      halo,
      leader,
      label,
      material,
      element,
      size: null, // label box in px, measured once it has been laid out
      emphasis: 'normal',
      scale: 1,
      haloOpacity: 0,
      spin: Math.random() * Math.PI * 2,
      spinSpeed: 0.18 + Math.random() * 0.14,
    });
  }

  /**
   * Hides a label when a more important one already occupies that patch of
   * screen. Static vertical offsets can only separate tools inside one stage;
   * two stages can still line up at some camera angles, and only the projection
   * knows when.
   *
   * Priority is emphasis first, then distance to the camera - so a highlighted
   * tool always wins, and otherwise the nearer label survives, which matches
   * what the depth of the scene already suggests.
   */
  const projected = new Vector3();
  const distanceA = new Vector3();
  const distanceB = new Vector3();

  function resolveLabelCollisions(camera) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const boxes = [];

    const ranked = [...nodes.values()].sort((a, b) => {
      const byEmphasis = EMPHASIS_PRIORITY[a.emphasis] - EMPHASIS_PRIORITY[b.emphasis];
      if (byEmphasis !== 0) return byEmphasis;
      return (
        camera.position.distanceToSquared(a.holder.getWorldPosition(distanceA)) -
        camera.position.distanceToSquared(b.holder.getWorldPosition(distanceB))
      );
    });

    for (const node of ranked) {
      if (!node.holder.visible) continue;

      // Measured once: the box only changes if the name changes.
      if (!node.size && node.element.offsetWidth > 0) {
        node.size = { w: node.element.offsetWidth, h: node.element.offsetHeight };
      }
      if (!node.size) continue;

      projected.setFromMatrixPosition(node.label.matrixWorld).project(camera);
      if (projected.z > 1) {
        node.element.classList.add('is-occluded');
        continue;
      }

      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const box = {
        left: x - node.size.w / 2,
        right: x + node.size.w / 2,
        top: y - node.size.h / 2,
        bottom: y + node.size.h / 2,
      };

      const clash = boxes.some(
        (other) =>
          box.left < other.right &&
          box.right > other.left &&
          box.top < other.bottom &&
          box.bottom > other.top,
      );

      node.element.classList.toggle('is-occluded', clash);
      if (!clash) boxes.push(box);
    }
  }

  function applyState() {
    const { selected, hovered } = getState();
    for (const node of nodes.values()) {
      node.emphasis = emphasisForApp(node.app);
      node.element.classList.toggle('is-selected', selected === node.app.id);
      node.element.classList.toggle('is-hovered', hovered === node.app.id);
      node.element.classList.toggle('is-dim', node.emphasis === 'dim');
      node.element.setAttribute('aria-pressed', String(selected === node.app.id));
    }
  }

  applyState();
  subscribe(applyState);

  return {
    group,
    pickables,
    nodes,
    /** Share of tools currently lit, used to drive the core pulse. */
    trafficRatio() {
      let lit = 0;
      for (const node of nodes.values()) if (node.emphasis !== 'dim') lit += 1;
      return nodes.size === 0 ? 0 : lit / nodes.size;
    },
    positionOf(appId) {
      return nodes.get(appId)?.holder.position ?? null;
    },
    update(elapsed, delta, camera) {
      const ease = Math.min(delta * 6, 1);
      for (const node of nodes.values()) {
        const targetScale = EMPHASIS_SCALE[node.emphasis];
        const targetOpacity = EMPHASIS_OPACITY[node.emphasis];
        const targetHalo = node.emphasis === 'focus' ? 0.12 : 0;

        node.scale += (targetScale - node.scale) * ease;
        node.haloOpacity += (targetHalo - node.haloOpacity) * ease;
        node.material.opacity += (targetOpacity - node.material.opacity) * ease;

        node.mesh.scale.setScalar(node.scale);
        node.halo.material.opacity = node.haloOpacity;
        if (node.leader) {
          node.leader.material.opacity = EMPHASIS_OPACITY[node.emphasis] * 0.32;
        }
        node.halo.scale.setScalar(node.scale * (1 + Math.sin(elapsed * 2.2) * 0.05));

        if (animateSpin) node.spin += delta * node.spinSpeed;
        node.mesh.rotation.set(node.spin * 0.7, node.spin, node.spin * 0.35);

        if (node.material.emissiveIntensity !== undefined) {
          const targetEmissive = node.emphasis === 'focus' ? 0.85 : 0.55;
          node.material.emissiveIntensity +=
            (targetEmissive - node.material.emissiveIntensity) * ease;
        }
      }

      if (camera) resolveLabelCollisions(camera);
    },
    setIntro(progress) {
      for (const node of nodes.values()) {
        const appear = Math.max(0, Math.min(1, progress));
        node.holder.visible = appear > 0.02;
        node.holder.scale.setScalar(appear);
        node.element.style.opacity = appear > 0.9 ? '' : '0';
      }
    },
  };
}
