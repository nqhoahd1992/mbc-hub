import {
  AdditiveBlending,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
} from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { APPS } from '../data/apps.js';
import { STAGES } from '../data/stages.js';
import { UI_COLORS, toThreeColor } from '../utils/color.js';
import { TAU, pointOnRing } from '../utils/curves.js';
import { LAYOUT, buildStageAnchors } from './layout.js';
import { getState, subscribe, toggleFilter } from '../state.js';

const SECTOR = 1 / STAGES.length;
const SECTOR_GAP = 0.018;

/**
 * A stage counts as staffed only once something there actually works. A stage
 * whose only tool is still planned keeps the dim arc and the "no tool yet" note,
 * which is the honest reading: the tool is coming, it is not here.
 */
function stageIsPopulated(stageId) {
  return APPS.some((app) => app.stage === stageId && app.status === 'live');
}

/** The six stage arcs, the boundary ticks, and the stage name labels. */
export function createCycleRing() {
  const group = new Group();
  const arcs = new Map();
  const labels = new Map();

  const baseRing = new Mesh(
    new RingGeometry(LAYOUT.ringRadius - 0.035, LAYOUT.ringRadius + 0.035, 220, 1),
    new MeshBasicMaterial({
      color: toThreeColor(UI_COLORS.border),
      transparent: true,
      opacity: 0.8,
      side: DoubleSide,
    }),
  );
  baseRing.rotation.x = Math.PI / 2;
  group.add(baseRing);

  for (const stage of STAGES) {
    const populated = stageIsPopulated(stage.id);
    const geometry = new RingGeometry(
      LAYOUT.ringRadius - 0.42,
      LAYOUT.ringRadius + 0.42,
      64,
      1,
      (stage.turn - SECTOR / 2 + SECTOR_GAP / 2) * TAU,
      (SECTOR - SECTOR_GAP) * TAU,
    );
    const material = new MeshBasicMaterial({
      color: toThreeColor(populated ? '#3d5891' : UI_COLORS.planned),
      transparent: true,
      opacity: populated ? 0.42 : 0.14,
      side: DoubleSide,
      depthWrite: false,
    });
    const arc = new Mesh(geometry, material);
    arc.rotation.x = Math.PI / 2;
    arc.userData.baseOpacity = material.opacity;
    group.add(arc);
    arcs.set(stage.id, arc);
  }

  // Boundary ticks, drawn as short radial segments between sectors.
  const tickPositions = [];
  for (const stage of STAGES) {
    const turn = stage.turn - SECTOR / 2;
    const inner = pointOnRing(turn, LAYOUT.ringRadius - 1.1);
    const outer = pointOnRing(turn, LAYOUT.ringRadius + 1.1);
    tickPositions.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
  }
  const tickGeometry = new BufferGeometry();
  tickGeometry.setAttribute('position', new Float32BufferAttribute(tickPositions, 3));
  group.add(
    new LineSegments(
      tickGeometry,
      new LineBasicMaterial({
        color: toThreeColor(UI_COLORS.border),
        transparent: true,
        opacity: 0.5,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );

  // Direction arrows between the stages. Without them the six names read as six
  // unrelated words; with them the ring reads as an order that comes back round.
  const arrowGeometry = new ConeGeometry(0.2, 0.62, 10);
  arrowGeometry.rotateX(Math.PI / 2); // point along +Z, the tangent direction
  const arrowMaterial = new MeshBasicMaterial({
    color: toThreeColor('#3d5891'),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const arrowTarget = new Vector3();

  for (const stage of STAGES) {
    const turn = stage.turn + SECTOR / 2;
    const arrow = new Mesh(arrowGeometry, arrowMaterial);
    arrow.position.copy(pointOnRing(turn, LAYOUT.ringRadius));
    // Face the next stage along the ring.
    arrow.lookAt(arrowTarget.copy(pointOnRing(turn + 0.02, LAYOUT.ringRadius)));
    group.add(arrow);
  }

  for (const { stage, position } of buildStageAnchors()) {
    const order = STAGES.indexOf(stage) + 1;
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'stage-label';
    element.dataset.stage = stage.id;
    element.innerHTML =
      `<span class="stage-label__order">${order}</span>` +
      `<span class="stage-label__name">${stage.label}</span>`;
    if (!stageIsPopulated(stage.id)) {
      element.classList.add('stage-label--empty');
      element.innerHTML += '<span class="stage-label__note">no tool yet</span>';
    }
    element.title = stage.description;
    element.addEventListener('click', () => toggleFilter('stageFilter', stage.id));

    const label = new CSS2DObject(element);
    label.position.copy(position);
    group.add(label);
    labels.set(stage.id, element);
  }

  function applyState() {
    const { stageFilter } = getState();
    for (const [stageId, arc] of arcs) {
      const active = !stageFilter || stageFilter === stageId;
      arc.material.opacity = arc.userData.baseOpacity * (active ? 1 : 0.25);
    }
    for (const [stageId, element] of labels) {
      element.classList.toggle('is-active', stageFilter === stageId);
      element.classList.toggle('is-dim', Boolean(stageFilter) && stageFilter !== stageId);
      element.setAttribute('aria-pressed', String(stageFilter === stageId));
    }
  }

  applyState();
  subscribe(applyState);

  return {
    group,
    setIntro(progress) {
      group.scale.setScalar(Math.max(progress, 0.001));
      for (const element of labels.values()) {
        element.style.opacity = progress > 0.85 ? '' : '0';
      }
    },
  };
}
