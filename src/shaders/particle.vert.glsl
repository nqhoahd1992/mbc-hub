attribute float aSize;
attribute float aFade;

uniform float uScale;
uniform float uOpacity;

varying float vFade;

void main() {
  vFade = aFade * uOpacity;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale * (1.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
