import { Vector2 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Bloom, or a plain render when the device cannot afford it.
 * Both paths expose the same `render` and `setSize`, so the loop never branches.
 */
export function createRenderPipeline({ renderer, scene, camera, enableBloom }) {
  if (!enableBloom) {
    return {
      bloomEnabled: false,
      render: () => renderer.render(scene, camera),
      setSize: () => {},
      disableBloom: () => {},
    };
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new Vector2(window.innerWidth, window.innerHeight),
    0.52, // strength
    0.62, // radius
    0.36, // threshold
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let active = true;

  function setSize() {
    composer.setSize(window.innerWidth, window.innerHeight);
    bloom.resolution.set(window.innerWidth, window.innerHeight);
  }
  setSize();

  return {
    get bloomEnabled() {
      return active;
    },
    render: () => (active ? composer.render() : renderer.render(scene, camera)),
    setSize,
    /** Called by the loop when measured frame times stay bad. */
    disableBloom() {
      active = false;
    },
  };
}
