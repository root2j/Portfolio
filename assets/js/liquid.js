// Liquid metal (Paper Shaders, the engine behind Liquid Logo) and live text
// flow (Pretext).
//
// - The About photo sits in a liquid-metal ring and drifts through the
//   paragraph; it follows the cursor when you point inside the text. Pretext
//   breaks every line to fit the gap beside the photo, so the paragraph
//   re-wraps as it moves.
// - The contact section shows the RD monogram in liquid metal.
//
// Motion levels come from app.js: "full" animates everything, "soft" (the OS
// asks for reduced motion) keeps the metal still and moves the photo only
// when you point at it, "off" leaves CSS in charge (the text wraps the photo
// standing still).
import { ShaderMount, liquidMetalFragmentShader, ShaderFitOptions } from "./vendor/paper-shaders.js";
import { prepareWithSegments, layoutNextLine } from "./vendor/pretext.js";

const SIZING = {
  u_fit: ShaderFitOptions.contain,
  u_scale: 1,
  u_rotation: 0,
  u_offsetX: 0,
  u_offsetY: 0,
  u_originX: 0.5,
  u_originY: 0.5,
  u_worldWidth: 0,
  u_worldHeight: 0,
};

function liquidMetal(host, uniforms, speed) {
  return new ShaderMount(
    host,
    liquidMetalFragmentShader,
    {
      u_colorBack: [0, 0, 0, 0],
      u_colorTint: [1, 1, 1, 1],
      u_repetition: 2.2,
      u_softness: 0.12,
      u_shiftRed: 0.3,
      u_shiftBlue: 0.3,
      u_distortion: 0.08,
      u_contour: 0.45,
      u_angle: 70,
      u_shape: 1,
      u_isImage: false,
      u_imageAspectRatio: 1,
      ...SIZING,
      ...uniforms,
    },
    undefined,
    speed,
    0,
    1.5
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function logo(speed) {
  const host = document.querySelector(".contact__logo");
  if (!host) return;
  try {
    const image = await loadImage(new URL("../img/rd-liquid.png", import.meta.url).href);
    liquidMetal(host, { u_image: image, u_isImage: true, u_shape: 0 }, speed);
  } catch {
    // No processed logo: leave the space empty.
  }
}

function ring(speed) {
  const host = document.querySelector(".flow-orb");
  if (!host) return;
  host.style.background = "none";
  liquidMetal(host, { u_shape: 1, u_repetition: 3 }, speed);
}

async function flow(level) {
  const box = document.querySelector(".flow");
  const textEl = box?.querySelector(".flow-text");
  const photo = box?.querySelector(".flow-photo");
  const linesEl = box?.querySelector(".flow-lines");
  if (!box || !textEl || !photo || !linesEl) return;

  await document.fonts.ready;
  const style = getComputedStyle(textEl);
  const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const prepared = prepareWithSegments(textEl.textContent.trim().replace(/\s+/g, " "), font);

  const staticHeight = box.offsetHeight;
  box.classList.add("is-flowing");

  const pad = parseFloat(getComputedStyle(box).paddingLeft) || 0;
  const padTop = parseFloat(getComputedStyle(box).paddingTop) || 0;
  let width = box.clientWidth - pad * 2;
  let size = photo.offsetWidth;
  let lineHeight = parseFloat(style.lineHeight);
  let height = staticHeight;
  const pool = [];
  const pos = { x: 0, y: 0, ready: false };
  const aim = { x: 0, y: 0, inside: false };

  new ResizeObserver(() => {
    width = box.clientWidth - pad * 2;
    size = photo.offsetWidth;
    lineHeight = parseFloat(getComputedStyle(linesEl).lineHeight);
  }).observe(box);

  box.addEventListener("pointermove", (e) => {
    const r = box.getBoundingClientRect();
    aim.x = e.clientX - r.left - pad;
    aim.y = e.clientY - r.top - padTop;
    aim.inside = true;
  });
  box.addEventListener("pointerleave", () => (aim.inside = false));

  const minRun = () => (width < 520 ? 96 : 110);
  const runs = (top, bottom, cx, cy, radius) => {
    const nearest = Math.min(Math.max(cy, top), bottom);
    const dy = Math.abs(nearest - cy);
    if (dy >= radius) return [[0, width]];
    const half = Math.sqrt(radius * radius - dy * dy);
    return [
      [0, cx - half],
      [cx + half, width],
    ].filter(([a, b]) => b - a >= minRun());
  };

  const render = (time) => {
    const t = time / 1000;
    const r = size / 2;
    // Where the photo would like to be: drifting (full motion), resting on
    // the right (reduced motion), or under the cursor.
    let tx = width - r;
    let ty = r;
    if (level === "full") {
      const minX = Math.max(r, width * (width < 520 ? 0.68 : 0.45));
      tx = minX + (width - r - minX) * (0.5 + 0.5 * Math.sin(t * 0.21));
      ty = r + Math.max(0, height - size) * (0.5 + 0.5 * Math.sin(t * 0.31 + 1.4));
    }
    if (aim.inside) {
      tx = Math.min(Math.max(aim.x, r), width - r);
      ty = Math.min(Math.max(aim.y, r), Math.max(r, height - r));
    }
    if (!pos.ready) {
      pos.x = tx;
      pos.y = ty;
      pos.ready = true;
    }
    pos.x += (tx - pos.x) * 0.08;
    pos.y += (ty - pos.y) * 0.08;

    let cursor;
    let y = 0;
    let count = 0;
    let done = false;
    while (!done && y < 4000) {
      for (const [x0, x1] of runs(y, y + lineHeight, pos.x, pos.y, r + 18)) {
        const line = layoutNextLine(prepared, x1 - x0, cursor);
        if (!line) {
          done = true;
          break;
        }
        let span = pool[count];
        if (!span) {
          span = document.createElement("span");
          linesEl.append(span);
          pool.push(span);
        }
        const words = line.text.trimEnd();
        if (span.textContent !== words) span.textContent = words;
        span.style.transform = `translate(${x0.toFixed(1)}px, ${y}px)`;
        span.hidden = false;
        cursor = line.end;
        count += 1;
      }
      y += lineHeight;
    }
    for (let i = count; i < pool.length; i += 1) pool[i].hidden = true;
    height = Math.max(height, y, size);
    linesEl.style.height = `${height}px`;
    photo.style.transform = `translate(${(pad + pos.x - r).toFixed(1)}px, ${(padTop + pos.y - r).toFixed(1)}px)`;
  };

  let visible = false;
  let raf = 0;
  const loop = (time) => {
    render(time);
    raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
  };
  const wake = () => {
    if (visible && !document.hidden && !raf) raf = requestAnimationFrame(loop);
  };
  render(performance.now());
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    wake();
  }).observe(box);
  document.addEventListener("visibilitychange", wake);
}

export function startLiquid({ level }) {
  const speed = level === "full" ? 1 : 0;
  ring(speed);
  logo(speed);
  if (level !== "off") flow(level);
}
