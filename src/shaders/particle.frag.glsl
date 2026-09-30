uniform vec3 uColor;

varying float vFade;

void main() {
  vec2 offset = gl_PointCoord - vec2(0.5);
  float d = length(offset);
  if (d > 0.5) discard;

  // Bright core with a soft halo, so a stream still reads at small sizes.
  float core = smoothstep(0.5, 0.0, d);
  float halo = smoothstep(0.5, 0.18, d);
  float alpha = (core * 0.55 + halo * 0.8) * vFade;

  // Deliberately not tone mapped: these are additive light, and rolling them
  // off would flatten the streams into grey.
  gl_FragColor = vec4(uColor * (0.7 + core * 0.9), alpha);
  #include <colorspace_fragment>
}
