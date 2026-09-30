import { Vector3 } from 'three';

// The HUD occupies the left of a wide screen, so the overview looks slightly
// left of centre, which pushes the model into the clear space on the right.
const HOME_TARGET = new Vector3(0, 0, 0);
const HOME_OFFSET_X = -2;

function homeTarget() {
  return HOME_TARGET.set(window.innerWidth >= 900 ? HOME_OFFSET_X : 0, 0, 0);
}
// Far enough that the stage names stay on screen through a full auto-rotation.
const HOME_DISTANCE = 38;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Camera framing.
 * Selecting a tool flies the camera to look at it from slightly outside the
 * ring; clearing the selection returns to the overview.
 */
export function createFocusController({ camera, controls }) {
  const fromPosition = new Vector3();
  const fromTarget = new Vector3();
  const toPosition = new Vector3();
  const toTarget = new Vector3();
  const scratch = new Vector3();

  let elapsed = 0;
  let duration = 0;

  function start(position, target, seconds) {
    fromPosition.copy(camera.position);
    fromTarget.copy(controls.target);
    toPosition.copy(position);
    toTarget.copy(target);
    elapsed = 0;
    duration = seconds;
  }

  return {
    get isAnimating() {
      return duration > 0 && elapsed < duration;
    },
    /** @param {Vector3} worldPosition already in world space */
    focusOn(worldPosition, seconds = 1.1) {
      // Stand off along the vector from the core, lifted a little, so the node
      // is never occluded by the ring it sits on.
      scratch.copy(worldPosition);
      const outward = scratch.clone().normalize().multiplyScalar(14);
      const position = scratch.clone().add(outward).add(new Vector3(0, 6, 0));
      if (position.length() < controls.minDistance + 2) {
        position.setLength(controls.minDistance + 6);
      }
      start(position, worldPosition, seconds);
    },
    /** Places the overview framing without animating, for the first frame. */
    snapHome() {
      controls.target.copy(homeTarget());
      camera.position.set(homeTarget().x, HOME_DISTANCE * 0.44, HOME_DISTANCE * 0.78);
      duration = 0;
    },
    reset(seconds = 1.2) {
      const direction = camera.position.clone().setY(0);
      if (direction.lengthSq() < 1e-4) direction.set(0, 0, 1);
      direction.normalize().multiplyScalar(HOME_DISTANCE * 0.78);
      direction.y = HOME_DISTANCE * 0.44;
      start(direction, homeTarget(), seconds);
    },
    update(delta) {
      if (duration <= 0 || elapsed >= duration) return;
      elapsed = Math.min(elapsed + delta, duration);
      const t = easeInOutCubic(elapsed / duration);
      camera.position.lerpVectors(fromPosition, toPosition, t);
      controls.target.lerpVectors(fromTarget, toTarget, t);
    },
  };
}
