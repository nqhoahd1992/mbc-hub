uniform vec3 uColorInner;
uniform vec3 uColorOuter;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDisplacement;

void main() {
  float fresnel = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0), 2.2);
  float ridges = smoothstep(-0.35, 0.65, vDisplacement);

  vec3 color = mix(uColorInner, uColorOuter, ridges);
  color += uColorOuter * fresnel * 1.35;
  color += 0.06 * sin(uTime * 0.7 + vDisplacement * 6.0);

  gl_FragColor = vec4(color, 1.0);

  // The core is an opaque surface, so it goes through the same tone mapping as
  // the standard materials around it.
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
