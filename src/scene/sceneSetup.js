import {
  ACESFilmicToneMapping,
  AmbientLight,
  Clock,
  Group,
  PerspectiveCamera,
  PointLight,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { UI_COLORS, toThreeColor } from '../utils/color.js';

const WORLD_TILT = -0.26;

export function createStage({ canvas, labelLayer, settings }) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: settings.antialias,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(toThreeColor(UI_COLORS.background), 1);

  const scene = new Scene();

  const camera = new PerspectiveCamera(46, 1, 0.1, 400);
  camera.position.set(0, 14, 29);

  // Everything positional is authored in a flat XZ plane; the tilt is applied
  // once here so the layout maths never has to think about it.
  const world = new Group();
  world.rotation.x = WORLD_TILT;
  scene.add(world);

  scene.add(new AmbientLight(0xffffff, 0.55));
  const keyLight = new PointLight(0xffffff, 180, 0, 2);
  keyLight.position.set(12, 18, 16);
  scene.add(keyLight);
  const rimLight = new PointLight(0x5f8dff, 90, 0, 2);
  rimLight.position.set(-16, -10, -14);
  scene.add(rimLight);

  const labelRenderer = new CSS2DRenderer({ element: labelLayer });

  // Controls live on the canvas, not on the label layer: that layer is pointer
  // transparent except for the labels themselves, so a label stays clickable
  // while a drag anywhere else still orbits the scene.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 12;
  controls.maxDistance = 58;
  controls.maxPolarAngle = Math.PI * 0.86;
  controls.minPolarAngle = Math.PI * 0.08;
  controls.enablePan = false;
  controls.autoRotateSpeed = 0.32;

  const clock = new Clock();

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.maxPixelRatio));
    renderer.setSize(width, height, false);
    labelRenderer.setSize(width, height);
  }

  resize();
  window.addEventListener('resize', resize);

  return { renderer, labelRenderer, scene, world, camera, controls, clock, resize };
}
