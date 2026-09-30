import { Vector3 } from 'three';
import './styles/main.css';

import { APP_BY_ID } from './data/apps.js';
import { publishCssVariables } from './utils/color.js';
import { detectPerformanceTier, prefersReducedMotion, settingsForTier, supportsWebGL2 } from './utils/device.js';
import { getState, setState, subscribe } from './state.js';

import { buildAppPositions, buildLinks } from './scene/layout.js';
import { createStage } from './scene/sceneSetup.js';
import { createCore } from './scene/core.js';
import { createCycleRing } from './scene/cycleRing.js';
import { createNodes } from './scene/nodes.js';
import { createSpine } from './scene/spine.js';
import { createFlowStreams } from './scene/flowStreams.js';
import { createPicking } from './scene/picking.js';
import { createRenderPipeline } from './scene/postfx.js';
import { createFocusController } from './scene/focus.js';

import { renderAppIndex } from './ui/appIndex.js';
import { mountFallback } from './ui/fallback2d.js';
import { createOverlay } from './ui/overlay.js';
import { createDetailPanel } from './ui/detailPanel.js';
import { createTooltip } from './ui/tooltip.js';
import { createSearch } from './ui/search.js';

const INTRO_DURATION = 2.4;

publishCssVariables();

const canvas = document.getElementById('scene');
const labelLayer = document.getElementById('labels');
const appIndex = document.getElementById('app-index');

if (!supportsWebGL2()) {
  mountFallback(
    appIndex,
    'This browser cannot run the 3D model, so here is the same information as a list.',
  );
} else {
  boot();
}

function boot() {
  const reducedMotion = prefersReducedMotion();
  const settings = settingsForTier(detectPerformanceTier());

  // Always present, visually hidden behind the scene: the keyboard and screen
  // reader path through the same registry the scene is built from.
  renderAppIndex(appIndex);
  document.body.classList.add('is-3d');

  const { renderer, labelRenderer, scene, world, camera, controls, clock } = createStage({
    canvas,
    labelLayer,
    settings,
  });

  const appPositions = buildAppPositions();
  const links = buildLinks(appPositions, APP_BY_ID);

  const core = createCore();
  const ring = createCycleRing();
  const nodes = createNodes(appPositions, { animateSpin: !reducedMotion });
  const spine = createSpine(appPositions);
  const streams = createFlowStreams(links, { particlesPerLink: settings.particlesPerLink });

  world.add(core.group, ring.group, spine.group, streams.group, nodes.group);

  const pipeline = createRenderPipeline({
    renderer,
    scene,
    camera,
    enableBloom: settings.bloom && !reducedMotion,
  });
  window.addEventListener('resize', pipeline.setSize);

  const picking = createPicking({ domElement: renderer.domElement, camera, pickables: nodes.pickables });
  const focus = createFocusController({ camera, controls });
  focus.snapHome();

  const search = createSearch(document.getElementById('search'), {
    onSelect: () => renderer.domElement.focus?.(),
  });

  createOverlay(document.getElementById('hud'), {
    onResetView: () => focus.reset(),
    onOpenSearch: () => search.open(),
  });
  createDetailPanel(document.getElementById('detail-panel'));
  createTooltip(document.getElementById('tooltip'), window);

  // Selecting a tool flies the camera to it; clearing the selection pulls back.
  const worldPosition = new Vector3();
  let lastSelected = null;
  subscribe(({ selected }) => {
    if (selected === lastSelected) return;
    lastSelected = selected;
    const node = nodes.nodes.get(selected);
    if (node) {
      node.holder.getWorldPosition(worldPosition);
      focus.focusOn(worldPosition, reducedMotion ? 0.01 : 1.1);
    } else {
      focus.reset(reducedMotion ? 0.01 : 1.2);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (search.isOpen) return;

    const typingTarget = event.target instanceof HTMLElement && event.target.closest('input, textarea');
    if (typingTarget) return;

    if (event.key === '/') {
      event.preventDefault();
      search.open();
      return;
    }
    if (event.key === 'Escape') {
      setState({ selected: null, flowFilter: null, stageFilter: null });
      return;
    }
    if (event.key === 'Enter') {
      const app = getState().selected ? APP_BY_ID[getState().selected] : null;
      if (app?.url) window.open(app.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const ids = [...nodes.nodes.keys()];
      if (ids.length === 0) return;
      event.preventDefault();
      const current = ids.indexOf(getState().selected);
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const next = (current + step + ids.length) % ids.length;
      setState({ selected: ids[current === -1 ? 0 : next] });
    }
  });

  let paused = false;
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (!paused) clock.getDelta(); // drop the time spent hidden
  });

  let intro = reducedMotion ? INTRO_DURATION : 0;
  let frameSamples = 0;
  let frameTimeTotal = 0;

  function applyIntro(progress) {
    core.setIntro(Math.min(1, progress / 0.35));
    ring.setIntro(Math.min(1, Math.max(0, (progress - 0.15) / 0.4)));
    spine.setIntro(Math.min(1, Math.max(0, (progress - 0.3) / 0.35)));
    nodes.setIntro(Math.min(1, Math.max(0, (progress - 0.45) / 0.4)));
    streams.setIntro(progress);
  }

  applyIntro(reducedMotion ? 1 : 0);

  function tick() {
    requestAnimationFrame(tick);
    if (paused) return;

    // The intro runs on real time; the simulation uses a clamped delta so a
    // long stall cannot make particles jump across a whole link.
    const rawDelta = clock.getDelta();
    const delta = Math.min(rawDelta, 0.05);
    const elapsed = reducedMotion ? 0 : clock.getElapsedTime();

    if (intro < INTRO_DURATION) {
      intro = Math.min(INTRO_DURATION, intro + rawDelta);
      applyIntro(intro / INTRO_DURATION);
      if (intro >= INTRO_DURATION) setState({ introDone: true });
    }

    controls.autoRotate = !reducedMotion && !getState().selected && !focus.isAnimating;
    focus.update(delta);
    controls.update();

    // Nodes are only pickable once they have actually appeared.
    if (intro >= INTRO_DURATION) picking.update();
    core.setTraffic(nodes.trafficRatio());
    core.update(elapsed, delta);
    nodes.update(elapsed, delta, camera);
    spine.update(elapsed, delta);
    if (!reducedMotion) streams.update(elapsed, delta);

    pipeline.render();
    labelRenderer.render(scene, camera);

    // If frames stay slow once the intro is over, drop bloom rather than limp.
    if (pipeline.bloomEnabled && intro >= INTRO_DURATION) {
      frameTimeTotal += delta;
      frameSamples += 1;
      if (frameSamples >= 120) {
        if (frameTimeTotal / frameSamples > 1 / 28) pipeline.disableBloom();
        frameSamples = 0;
        frameTimeTotal = 0;
      }
    }
  }

  tick();
}
