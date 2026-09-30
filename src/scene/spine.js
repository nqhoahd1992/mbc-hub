import {
  AdditiveBlending,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { APPS } from '../data/apps.js';
import { FLOW_BY_ID } from '../data/flows.js';
import { STAGES } from '../data/stages.js';
import { UI_COLORS, toThreeColor } from '../utils/color.js';
import { linkCurve, pointOnRing } from '../utils/curves.js';
import { LAYOUT } from './layout.js';
import { emphasisForApp, subscribe } from '../state.js';

/**
 * The vertical axis that carries cross-cutting tools.
 *
 * Tendrils reach from each backbone tool to every stage arc: that is the visual
 * claim that Finance and Timesheet touch the whole cycle rather than one step of
 * it, and it is what gives a new cross-cutting tool a place to stand.
 */
export function createSpine(appPositions) {
  const group = new Group();
  const tendrilsByApp = new Map();

  const column = new Mesh(
    new CylinderGeometry(0.035, 0.035, LAYOUT.spineHeight * 2, 8, 1, true),
    new MeshBasicMaterial({
      color: toThreeColor(UI_COLORS.border),
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  group.add(column);

  const backboneApps = APPS.filter((app) => app.stage === 'backbone');

  for (const app of backboneApps) {
    const anchor = appPositions.get(app.id);
    if (!anchor) continue;

    const color = toThreeColor(FLOW_BY_ID[app.flow].color);
    const lines = [];

    for (const stage of STAGES) {
      // Stop short of the ring: a tendril should read as reaching towards the
      // stage, not as a wire cage drawn over the whole model.
      const target = pointOnRing(stage.turn, LAYOUT.ringRadius * 0.74);
      const curve = linkCurve(anchor, target, { bow: 0.08 });
      const geometry = new BufferGeometry().setFromPoints(curve.getPoints(48));
      const material = new LineBasicMaterial({
        color: app.status === 'planned' ? toThreeColor(UI_COLORS.planned) : color,
        transparent: true,
        opacity: 0.07,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const line = new Line(geometry, material);
      group.add(line);
      lines.push(material);
    }

    tendrilsByApp.set(app.id, { app, materials: lines, opacity: 0.07 });
  }

  function applyState() {
    for (const entry of tendrilsByApp.values()) {
      const emphasis = emphasisForApp(entry.app);
      entry.target = emphasis === 'focus' ? 0.42 : emphasis === 'dim' ? 0.02 : 0.07;
    }
  }

  applyState();
  subscribe(applyState);

  return {
    group,
    update(elapsed, delta) {
      const ease = Math.min(delta * 5, 1);
      for (const entry of tendrilsByApp.values()) {
        entry.opacity += ((entry.target ?? 0.07) - entry.opacity) * ease;
        for (const material of entry.materials) material.opacity = entry.opacity;
      }
      column.material.opacity = 0.24 + Math.sin(elapsed * 0.8) * 0.05;
    },
    setIntro(progress) {
      group.scale.setScalar(Math.max(progress, 0.001));
    },
  };
}
