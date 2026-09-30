uniform float uTime;
uniform float uPulse;
uniform float uAmplitude;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDisplacement;

void main() {
  float slow = uTime * 0.22;
  float n = snoise(position * 0.85 + vec3(0.0, slow, 0.0));
  n += 0.5 * snoise(position * 1.9 - vec3(slow * 1.4, 0.0, 0.0));

  // The pulse is driven by how much traffic the model is currently showing.
  float breath = 1.0 + 0.055 * sin(uTime * (1.1 + uPulse * 2.4));
  float displaced = n * uAmplitude * (0.6 + uPulse * 0.8);

  vDisplacement = n;

  vec3 displacedPosition = position * breath + normal * displaced;
  vec4 mvPosition = modelViewMatrix * vec4(displacedPosition, 1.0);

  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPosition.xyz);

  gl_Position = projectionMatrix * mvPosition;
}
