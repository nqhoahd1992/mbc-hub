import { Raycaster, Vector2 } from 'three';
import { setState } from '../state.js';

const DRAG_THRESHOLD = 6; // px - beyond this a pointer up is an orbit, not a click

/**
 * Hover and selection from the pointer.
 * Raycasting runs once per frame at most, off the last known pointer position.
 */
export function createPicking({ domElement, camera, pickables }) {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const downPosition = new Vector2();
  const scratch = new Vector2();

  let hasPointer = false;
  let dirty = false;
  let dragging = false;

  function updatePointer(event) {
    pointer.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1,
    );
    hasPointer = true;
    dirty = true;
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    return hit?.object.userData.appId ?? null;
  }

  domElement.addEventListener('pointermove', (event) => {
    updatePointer(event);
    if (dragging && downPosition.distanceTo(scratch.set(event.clientX, event.clientY)) > DRAG_THRESHOLD) {
      setState({ hovered: null });
    }
  });

  domElement.addEventListener('pointerleave', () => {
    hasPointer = false;
    setState({ hovered: null });
  });

  domElement.addEventListener('pointerdown', (event) => {
    dragging = true;
    downPosition.set(event.clientX, event.clientY);
  });

  domElement.addEventListener('pointerup', (event) => {
    dragging = false;
    if (downPosition.distanceTo(scratch.set(event.clientX, event.clientY)) > DRAG_THRESHOLD) return;
    updatePointer(event);
    setState({ selected: pick() });
  });

  return {
    update() {
      if (!dirty || !hasPointer || dragging) return;
      dirty = false;
      const appId = pick();
      domElement.style.cursor = appId ? 'pointer' : '';
      setState({ hovered: appId });
    },
  };
}
