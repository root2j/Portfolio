// The living sky: the original cloud photo rendered through a WebGL shader,
// so the clouds billow, light falls from the top left and fine grain moves
// over it (in the spirit of ShaderGradient). At night it's the same sky,
// dimmed, with stars. Runs on Paper Shaders' ShaderMount. The liquid glass
// nav over it is in app.js and site.css.
//
// Motion levels (set on <html> by app.js): full animates while the hero is on
// screen; reduced shows a still sky that only shifts with the cursor; off
// leaves the plain photo.
import { ShaderMount } from "./vendor/paper-shaders.js";

const root = document.documentElement;
const level = root.classList.contains("m-off") ? "off" : root.classList.contains("m-soft") ? "soft" : "full";
const lowEnd = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;

// The sky's colour at a point on screen. Uniforms that Paper's vertex shader
// also declares (u_resolution, u_pixelRatio, u_imageAspectRatio) must be
// mediump to match it, or the program fails to link on real GPUs.
const SKY_LIB = `
uniform float u_time;
uniform sampler2D u_image;
uniform mediump float u_imageAspectRatio;
uniform vec2 u_pointer;
uniform float u_night;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = r * p * 2.03;
    a *= 0.5;
  }
  return v;
}

// px: device pixels in the viewport (origin bottom-left); res: viewport size
// in device pixels; pr: device pixels per CSS pixel.
vec3 skyAt(vec2 px, vec2 res, float pr) {
  vec2 uv = px / res;
  float aspect = res.x / res.y;
  float t = u_time;

  // Cover-fit the cloud photo, zoomed a little to leave room for movement.
  vec2 fit = (aspect > u_imageAspectRatio
    ? vec2(1.0, u_imageAspectRatio / aspect)
    : vec2(aspect / u_imageAspectRatio, 1.0)) / 1.16;
  vec2 p = (uv - 0.5) * fit;
  p += u_pointer * vec2(0.014, 0.01);
  p += vec2(sin(t * 0.021) * 0.022, cos(t * 0.017) * 0.012);

  // A slow domain warp, so the cloud shapes billow instead of just sliding.
  vec2 q = vec2(fbm(p * 2.6 + vec2(0.0, t * 0.035)), fbm(p * 2.6 + vec2(5.2, -t * 0.03)));
  vec2 w = vec2(fbm(p * 3.1 + q * 1.7 + vec2(1.7, t * 0.02)), fbm(p * 3.1 + q * 1.7 + vec2(8.3, t * 0.025)));
  vec2 st = p + (w - 0.5) * 0.045 + 0.5;
  st.y = 1.0 - st.y;
  vec3 col = texture(u_image, clamp(st, 0.001, 0.999)).rgb;

  // Thin wisps drifting in front, a touch faster than the photo.
  float wisp = fbm(vec2(uv.x * aspect * 1.6 - t * 0.022, uv.y * 2.4 + t * 0.006) + q);
  col = mix(col, vec3(1.0), smoothstep(0.58, 0.9, wisp) * 0.3);

  // Soft light rays from the top left.
  vec2 d = vec2(uv.x * aspect, uv.y) - vec2(-0.1 * aspect, 1.2);
  float ang = atan(d.y, d.x);
  float rays = 0.5 + 0.5 * sin(ang * 22.0 + fbm(vec2(ang * 3.0, t * 0.06)) * 7.0);
  rays = pow(rays, 4.0) * smoothstep(1.9, 0.2, length(d));
  col += vec3(1.0, 0.985, 0.95) * rays * 0.08 * (1.0 - u_night);

  // Night: the same clouds, dimmed and cooled, with stars in the clear sky.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 night = col * vec3(0.17, 0.21, 0.29) + vec3(0.015, 0.03, 0.06);
  float cellSize = 34.0 * pr;
  vec2 cell = floor(px / cellSize);
  vec2 inCell = fract(px / cellSize);
  vec2 starPos = vec2(hash(cell + 1.3), hash(cell + 7.1)) * 0.8 + 0.1;
  float starDist = length((inCell - starPos) * cellSize) / pr;
  float star = smoothstep(1.4, 0.0, starDist) * step(0.86, hash(cell + 3.7));
  star *= 0.55 + 0.45 * sin(t * 1.6 + hash(cell) * 40.0);
  night += vec3(0.85, 0.9, 1.0) * star * smoothstep(0.93, 0.8, lum);
  return mix(col, night, u_night);
}
`;

const SKY_FRAGMENT = `#version 300 es
precision highp float;
uniform mediump vec2 u_resolution;
uniform mediump float u_pixelRatio;
out vec4 fragColor;
${SKY_LIB}
void main() {
  vec3 col = skyAt(gl_FragCoord.xy, u_resolution, u_pixelRatio);
  float grain = hash(gl_FragCoord.xy + fract(u_time * 7.0) * 113.0) - 0.5;
  col += grain * mix(0.04, 0.035, u_night);
  fragColor = vec4(col, 1.0);
}`;

const isDark = () => root.dataset.theme === "dark";

function hasWebGL2() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

async function loadImage(sources) {
  for (const src of sources) {
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      return img;
    } catch {
      // Try the next format.
    }
  }
  return null;
}

async function start() {
  const small = window.matchMedia("(max-width: 800px)").matches;
  const base = new URL(`../img/sky-${small ? 1280 : 1920}`, import.meta.url).href;
  const image = await loadImage([`${base}.avif`, `${base}.webp`]);
  if (!image) return;

  const speed = level === "full" ? 1 : 0;
  const frame = level === "full" ? 0 : 42000;
  let night = isDark() ? 1 : 0;
  const mounts = [];

  const skyHost = document.createElement("div");
  skyHost.className = "sky-gl";
  skyHost.setAttribute("aria-hidden", "true");
  document.querySelector(".sky")?.after(skyHost);
  try {
    mounts.push(
      new ShaderMount(
        skyHost,
        SKY_FRAGMENT,
        { u_image: image, u_pointer: [0, 0], u_night: night },
        { alpha: false, antialias: false, premultipliedAlpha: false },
        speed,
        frame,
        1,
        small ? 420_000 : 2_400_000
      )
    );
  } catch {
    skyHost.remove();
    return;
  }
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      skyHost.classList.add("is-ready");
      root.classList.add("has-gl-sky");
    })
  );

  // Animate only while the hero is on screen; further down the sky holds
  // still, so the glass over it doesn't have to re-render every frame.
  let heroVisible = true;
  const hero = document.querySelector(".hero");
  if (hero && level === "full") {
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      mounts.forEach((m) => m.setSpeed(heroVisible ? 1 : 0));
    }).observe(hero);
  }

  // A little parallax toward the cursor (mouse and pen only).
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
  const follow = () => {
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    mounts.forEach((m) => m.setUniforms({ u_pointer: [pointer.x, -pointer.y] }));
    const settled = Math.abs(pointer.tx - pointer.x) < 0.001 && Math.abs(pointer.ty - pointer.y) < 0.001;
    pointer.raf = settled ? 0 : requestAnimationFrame(follow);
  };
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fine) {
    window.addEventListener(
      "pointermove",
      (event) => {
        if (!heroVisible) return;
        pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (event.clientY / window.innerHeight) * 2 - 1;
        if (!pointer.raf) pointer.raf = requestAnimationFrame(follow);
      },
      { passive: true }
    );
  }

  // Fade between day and night when the theme changes.
  let fade = 0;
  new MutationObserver(() => {
    const target = isDark() ? 1 : 0;
    cancelAnimationFrame(fade);
    const step = () => {
      night += (target - night) * 0.12;
      if (Math.abs(target - night) < 0.004) night = target;
      mounts.forEach((m) => m.setUniforms({ u_night: night }));
      if (night !== target) fade = requestAnimationFrame(step);
    };
    step();
  }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
}

if (level !== "off" && !lowEnd && hasWebGL2()) start();
