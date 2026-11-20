/* Rutuj Dhongade portfolio: motion and interaction.
   Classic script, so the page still reads as a plain document if anything
   fails. GSAP, ScrollTrigger and Lenis are vendored in ./vendor; the living
   sky (sky.js) and the liquid effects (liquid.js) are modules. */
(() => {
  "use strict";

  const doc = document.documentElement;
  const BASE = new URL(".", document.currentScript ? document.currentScript.src : location.href);

  // Motion levels, as in the Wada Pav artifact:
  //   full: everything.
  //   soft: the OS asks for reduced motion. Scroll-linked choreography stays
  //         (it only moves when you scroll); autonomous motion goes: smooth
  //         scrolling, the moving sky, marquee drift, shimmer, grain.
  //   off:  the visitor switched motion off (nav button, or ?motion=off).
  // Full motion is the default for everyone, whatever the OS setting; the
  // Motion button in the nav is always shown so any visitor can turn it off.
  let pref = null;
  try {
    const q = new URLSearchParams(location.search).get("motion");
    if (q === "on" || q === "off") localStorage.setItem("rd-motion", q);
    pref = localStorage.getItem("rd-motion");
  } catch {
    // Storage blocked: stay on full motion.
  }
  const OFF = pref === "off";
  const SOFT = false;
  const FULL = !OFF && !SOFT;
  const LEVEL = OFF ? "off" : SOFT ? "soft" : "full";
  doc.classList.add(`m-${LEVEL}`);
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Motion switch ---------- */
  const motionBtn = $(".nav__motion");
  if (motionBtn) {
    motionBtn.hidden = false;
    motionBtn.textContent = FULL ? "Motion: on" : SOFT ? "Motion: reduced" : "Motion: off";
    motionBtn.setAttribute("aria-pressed", String(FULL));
    motionBtn.title = FULL ? "Turn motion off" : "Turn motion on";
    motionBtn.addEventListener("click", () => {
      try {
        localStorage.setItem("rd-motion", FULL ? "off" : "on");
      } catch {
        // ignore
      }
      const u = new URL(location.href);
      if (u.searchParams.has("motion")) {
        u.searchParams.delete("motion");
        location.replace(u.href);
      } else location.reload();
    });
  }

  /* ---------- Theme: day sky by default, night on request ---------- */
  const themeBtn = $(".theme-toggle");
  const themeMeta = $('meta[name="theme-color"]');
  const isDark = () => doc.dataset.theme === "dark";
  const syncTheme = () => {
    const dark = isDark();
    themeBtn?.setAttribute("aria-label", dark ? "Switch to day sky" : "Switch to night sky");
    themeMeta?.setAttribute("content", dark ? "#0b121b" : "#e9f0f5");
  };
  themeBtn?.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    doc.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore
    }
    syncTheme();
  });
  syncTheme();

  /* ---------- Menu ---------- */
  const menuBtn = $(".menu-toggle");
  const navList = $("#site-nav");
  const setMenu = (open) => {
    menuBtn?.setAttribute("aria-expanded", String(open));
    navList?.classList.toggle("is-open", open);
  };
  menuBtn?.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  navList?.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuBtn?.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      menuBtn.focus();
    }
  });

  const year = $("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Liquid glass nav ---------- */
  // The whole bar is glass. In Chromium it really refracts: .nav__glass and
  // .nav__lens each run the page behind them through an SVG displacement map
  // (see the filters at the top of index.html), so the sky, your name and the
  // cards bend as they pass under it. Other browsers get frosted glass.
  //
  // FluidGlass settings from the React snippet. size: the lens width (CSS px)
  // while it chases the pointer; refraction: how hard the glass bends what's
  // behind it; dispersion: how far red and blue split at the edges;
  // interaction "follow": the lens chases the pointer across the links,
  // anything else keeps it on the current section.
  const GLASS = { shape: "lens", size: 96, refraction: 1, dispersion: 0.35, interaction: "follow" };

  const nav = $(".nav");
  const lens = $(".nav__lens");
  const linkBar = $(".nav__links");
  const links = $$(".nav__links a");
  const wide = window.matchMedia("(min-width: 900px)");

  const LG = (() => {
    const brands = navigator.userAgentData?.brands || [];
    return (
      brands.some((b) => /Chromium/i.test(b.brand)) &&
      !window.matchMedia("(prefers-reduced-transparency: reduce)").matches &&
      Boolean(nav && $("#lg-nav") && $("#lg-lens"))
    );
  })();
  if (LG) doc.classList.add("lg-on");

  // A displacement map for a w x h pill, as a data URL. Each pixel says where
  // to look instead: inside the rim the glass bends the view inward (a
  // rounded bevel `band` px deep, `bend` px at most), and `pull` draws
  // everything toward the middle so what's underneath looks bigger. `scale`
  // is the filter's displacement scale the map is encoded for.
  function pillMap(w, h, { band, bend, pull = 0, scale }) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(w, h);
    const r = h / 2;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const px = x + 0.5 - w / 2;
        const py = y + 0.5 - h / 2;
        const qx = Math.abs(px) - (w / 2 - r);
        const qy = Math.abs(py);
        let dist = qy;
        let nx = 0;
        let ny = 1;
        if (qx > 0) {
          dist = Math.hypot(qx, qy) || 1;
          nx = qx / dist;
          ny = qy / dist;
        }
        const depth = r - dist;
        let dx = 0;
        let dy = 0;
        if (depth >= 0) {
          const k = depth < band ? (1 - depth / band) ** 2 : 0;
          dx = -Math.sign(px) * nx * k * bend - px * pull;
          dy = -Math.sign(py) * ny * k * bend - py * pull;
        }
        const i = (y * w + x) * 4;
        img.data[i] = 128 + (dx / scale) * 255;
        img.data[i + 1] = 128 + (dy / scale) * 255;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }

  // How hard the rim bends. It stays under half the band (less any
  // magnification), so the edge stretches what's behind it without folding
  // it back on itself; red's extra bend for the dispersion is allowed for.
  const REFRACT = Math.min(1, Math.max(0, GLASS.refraction));
  const SPLIT = GLASS.dispersion * 0.6;
  const rimBend = (band, pull) => (band * (0.48 - pull) * REFRACT) / (1 + SPLIT);

  // Point a filter at its map(s), stretched to w x h. The bar has one map and
  // splits colour through the scales (red bends a little more, blue a little
  // less); the lens has a map per colour that differs only at the rim.
  const shown = new Map();
  function useMap(filter, map, w, h) {
    const images = filter.querySelectorAll(".lg-map");
    if (shown.get(filter) !== map) {
      shown.set(filter, map);
      images.forEach((image) => image.setAttribute("href", map.urls[image.dataset.ch || "g"]));
      filter.querySelectorAll(".lg-disp").forEach((d) => {
        const ch = d.dataset.ch;
        const k = map.split && ch ? (ch === "r" ? 1 + map.split : ch === "b" ? 1 - map.split : 1) : 1;
        d.setAttribute("scale", (map.scale * k).toFixed(2));
      });
    }
    images.forEach((image) => {
      image.setAttribute("width", String(w));
      image.setAttribute("height", String(h));
    });
  }

  // The bar's map. While the pill is resizing (it tucks in on scroll) the last
  // map is stretched to fit; a fresh one is drawn once it settles.
  const navFilter = $("#lg-nav");
  let navMapTimer = 0;
  let navMapSize = "";
  function fitNavMap(now) {
    if (!LG || !nav) return;
    const w = Math.round(nav.offsetWidth);
    const h = Math.round(nav.offsetHeight);
    const size = `${w}x${h}`;
    if (!w || !h || size === navMapSize) return;
    clearTimeout(navMapTimer);
    if (now || !shown.has(navFilter)) {
      navMapSize = size;
      const band = Math.min(24, h * 0.4);
      const bend = rimBend(band, 0);
      // A gentler split than the lens: the bar's rim is long.
      const split = SPLIT / 3;
      const scale = Math.ceil(2 * bend * (1 + split)) + 2;
      useMap(navFilter, { urls: { g: pillMap(w, h, { band, bend, scale }) }, scale, split }, w, h);
      return;
    }
    navFilter.querySelectorAll(".lg-map").forEach((image) => {
      image.setAttribute("width", String(w));
      image.setAttribute("height", String(h));
    });
    navMapTimer = setTimeout(() => fitNavMap(true), 160);
  }

  // The lens's maps, one set per size (4 px steps), drawn as they're needed.
  const lensFilter = $("#lg-lens");
  const lensMaps = new Map();
  function fitLensMap(w, h) {
    if (!LG || !w || !h) return;
    const mw = Math.max(h, Math.round(w / 4) * 4);
    const key = `${mw}x${h}`;
    let map = lensMaps.get(key);
    if (!map) {
      if (lensMaps.size > 48) lensMaps.clear();
      const band = h * 0.4;
      const pull = 1 - 1 / (1 + 0.1 * REFRACT);
      const bend = rimBend(band, pull);
      const scale = Math.ceil(2 * (bend * (1 + SPLIT) + (pull * mw) / 2)) + 2;
      const make = (k) => pillMap(mw, h, { band, bend: bend * k, pull, scale });
      map = { urls: { r: make(1 + SPLIT), g: make(1), b: make(1 - SPLIT) }, scale };
      lensMaps.set(key, map);
    }
    useMap(lensFilter, map, Math.round(w), h);
  }

  // Light catches the rim on the side nearest the pointer.
  nav?.addEventListener("pointermove", (e) => {
    const r = nav.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    nav.style.setProperty("--lx", `${(f * 100).toFixed(1)}%`);
    nav.style.setProperty("--la", `${(110 + f * 140).toFixed(1)}deg`);
  });
  nav?.addEventListener("pointerleave", () => nav.style.removeProperty("--la"));

  // The lens: a thicker drop of glass. It chases the pointer across the links
  // (pulled toward the one you're over), stretches as it moves, swells when
  // pressed, and settles on the section you're reading.
  const L = { x: 0, w: GLASS.size, s: 1, o: 0, vx: 0, vw: 0, vs: 0, placed: false, mapH: 0 };
  let current = null;
  let pointerX = null;
  let overLink = null;
  let pressed = false;
  let lensRaf = 0;
  let aliveUntil = 0;

  function lensTarget() {
    if (!lens || !linkBar || !wide.matches) return null;
    const bar = linkBar.getBoundingClientRect();
    const box = (a) => {
      const r = a.getBoundingClientRect();
      return { c: r.left - bar.left + r.width / 2, w: r.width + 20 };
    };
    if (pointerX !== null && GLASS.interaction === "follow" && !OFF) {
      if (overLink) {
        const b = box(overLink);
        return { x: b.c + (pointerX - b.c) * 0.35, w: b.w };
      }
      const w = GLASS.size;
      return { x: Math.min(bar.width - w / 2, Math.max(w / 2, pointerX)), w };
    }
    if (overLink) return { x: box(overLink).c, w: box(overLink).w };
    return current ? { x: box(current).c, w: box(current).w } : null;
  }

  function lensFrame(now) {
    lensRaf = 0;
    const t = lensTarget();
    const h = lens.offsetHeight;
    const tx = t ? t.x : L.x;
    const tw = t ? t.w : L.w;
    const ts = pressed ? 1.12 : 1;
    const to = t ? 1 : 0;
    if (t && (!L.placed || L.o < 0.02)) {
      L.x = tx;
      L.w = tw;
      L.vx = 0;
      L.vw = 0;
      L.placed = true;
    }
    if (FULL) {
      // A slightly underdamped spring: it overshoots a touch, like a drop.
      L.vx = (L.vx + (tx - L.x) * 0.16) * 0.72;
      L.vw = (L.vw + (tw - L.w) * 0.16) * 0.72;
      L.vs = (L.vs + (ts - L.s) * 0.2) * 0.66;
      L.x += L.vx;
      L.w += L.vw;
      L.s += L.vs;
    } else if (SOFT) {
      L.vx = (tx - L.x) * 0.35;
      L.x += L.vx;
      L.w += (tw - L.w) * 0.35;
      L.s = ts;
    } else {
      L.x = tx;
      L.w = tw;
      L.vx = 0;
      L.s = 1;
    }
    L.o += (to - L.o) * (OFF ? 1 : 0.2);

    const stretch = FULL ? Math.min(Math.abs(L.vx) * 0.012, 0.3) : 0;
    const sx = (1 + stretch) * L.s;
    const sy = (1 - stretch * 0.45) * L.s;
    lens.style.width = `${L.w.toFixed(2)}px`;
    lens.style.transform = `translate3d(${(L.x - L.w / 2).toFixed(2)}px, 0, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    lens.style.opacity = L.o.toFixed(3);
    if (L.o > 0.01) fitLensMap(L.w, h);

    const settled =
      Math.abs(tx - L.x) < 0.1 &&
      Math.abs(tw - L.w) < 0.1 &&
      Math.abs(ts - L.s) < 0.002 &&
      Math.abs(L.vx) < 0.02 &&
      Math.abs(to - L.o) < 0.004;
    if (!settled || now < aliveUntil) lensRaf = requestAnimationFrame(lensFrame);
    else L.o = to;
  }

  function wakeLens(ms = 0) {
    if (!lens) return;
    if (ms) aliveUntil = Math.max(aliveUntil, performance.now() + ms);
    if (!lensRaf) lensRaf = requestAnimationFrame(lensFrame);
  }

  if (FINE) {
    linkBar?.addEventListener("pointermove", (e) => {
      pointerX = e.clientX - linkBar.getBoundingClientRect().left;
      overLink = e.target.closest?.(".nav__links a") || null;
      wakeLens();
    });
    linkBar?.addEventListener("pointerleave", () => {
      pointerX = null;
      overLink = null;
      pressed = false;
      wakeLens();
    });
  }
  links.forEach((link) => {
    link.addEventListener("pointerdown", () => {
      pressed = true;
      wakeLens();
    });
    // Keyboard focus moves the lens too (not the focus a click leaves behind).
    link.addEventListener("focus", () => {
      if (!link.matches(":focus-visible")) return;
      overLink = link;
      wakeLens();
    });
    link.addEventListener("blur", () => {
      if (pointerX === null) overLink = null;
      wakeLens();
    });
  });
  window.addEventListener("pointerup", () => {
    if (!pressed) return;
    pressed = false;
    wakeLens();
  });

  const setCurrent = (link) => {
    if (current === link) return;
    current?.classList.remove("is-current");
    current?.removeAttribute("aria-current");
    current = link;
    current?.classList.add("is-current");
    current?.setAttribute("aria-current", "true");
    wakeLens();
  };

  // Once the page scrolls under the bar, the glass frosts a little more so
  // the labels stay readable over text.
  let overQueued = false;
  const markOver = () => {
    overQueued = false;
    nav?.classList.toggle("is-over", window.scrollY > 24);
  };
  window.addEventListener(
    "scroll",
    () => {
      if (overQueued) return;
      overQueued = true;
      requestAnimationFrame(markOver);
    },
    { passive: true }
  );
  markOver();

  // Keep the maps and the lens in step as the pill changes size.
  if (nav) {
    new ResizeObserver(() => {
      fitNavMap(false);
      wakeLens(120);
    }).observe(nav);
    nav.addEventListener("transitionrun", () => wakeLens(700));
    wide.addEventListener("change", () => wakeLens(120));
  }

  /* ---------- Liquid metal + Pretext (About and Contact) ---------- */
  let liquidStarted = false;
  const startLiquid = () => {
    if (liquidStarted) return;
    liquidStarted = true;
    import(new URL("liquid.js", BASE).href)
      .then((m) => m.startLiquid({ level: LEVEL }))
      .catch((e) => console.warn("Liquid effects unavailable:", e));
  };
  const liquidWatch = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        liquidWatch.disconnect();
        startLiquid();
      }
    },
    { rootMargin: "800px 0px" }
  );
  $$(".about, .contact").forEach((el) => liquidWatch.observe(el));

  /* ---------- Holographic cards ---------- */
  function holo(card) {
    if (OFF) return;
    if (!FINE) {
      card.classList.add("is-idle");
      return;
    }
    let raf = 0;
    let px = 50;
    let py = 50;
    const apply = () => {
      raf = 0;
      card.style.setProperty("--mx", `${px}%`);
      card.style.setProperty("--my", `${py}%`);
      card.style.setProperty("--rx", `${(((py - 50) / 50) * -8).toFixed(2)}deg`);
      card.style.setProperty("--ry", `${(((px - 50) / 50) * 10).toFixed(2)}deg`);
      card.style.setProperty("--fx", `${(px * 0.6 + 20).toFixed(1)}%`);
      card.style.setProperty("--fy", `${(py * 0.6 + 20).toFixed(1)}%`);
    };
    card.addEventListener("pointerenter", () => card.classList.add("is-active"));
    card.addEventListener("pointermove", (e) => {
      const b = card.getBoundingClientRect();
      px = ((e.clientX - b.left) / b.width) * 100;
      py = ((e.clientY - b.top) / b.height) * 100;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    card.addEventListener("pointerleave", () => {
      cancelAnimationFrame(raf);
      raf = 0;
      card.classList.remove("is-active");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  }
  $$("[data-holo]").forEach(holo);

  /* ---------- Everything below needs GSAP ---------- */
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const loader = $(".loader");
  if (!G || !ST) {
    loader?.remove();
    return;
  }
  G.registerPlugin(ST);
  ST.config({ ignoreMobileResize: true });

  // Smooth scrolling (full motion only).
  let lenis = null;
  if (FULL && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 0.95 });
    lenis.on("scroll", ST.update);
    G.ticker.add((t) => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
    lenis.stop();
  }
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const el = id.length > 1 ? $(id) : null;
      if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { duration: 1.4 });
      else el.scrollIntoView({ behavior: FULL ? "smooth" : "auto" });
    })
  );

  // Split headings into words for the rise-in.
  function splitWords(el) {
    const words = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.append(" ");
              return;
            }
            const w = document.createElement("span");
            w.className = "w";
            const inner = document.createElement("span");
            inner.className = "wi";
            inner.textContent = part;
            w.append(inner);
            frag.append(w);
            words.push(inner);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    walk(el);
    return words;
  }
  const splits = OFF ? [] : $$("[data-split]").map((el) => ({ el, words: splitWords(el) }));

  /* ---------- Loader ---------- */
  const bar = $(".loader__bar span");
  let loaded = 0.1;
  const bump = (v) => {
    loaded = Math.max(loaded, v);
    if (bar) bar.style.transform = `scaleX(${loaded})`;
  };
  bump(0.3);
  const fontsReady = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => bump(0.8));

  /* ---------- Scroll choreography ---------- */
  function buildSplits() {
    splits.forEach(({ el, words }) => {
      if (FULL) {
        G.from(words, {
          yPercent: 110,
          duration: 0.95,
          ease: "power4.out",
          stagger: 0.06,
          scrollTrigger: { trigger: el, start: "top 86%", once: true },
        });
      } else {
        G.from(words, {
          yPercent: 110,
          ease: "none",
          stagger: 0.1,
          scrollTrigger: { trigger: el, start: "top 92%", end: "top 60%", scrub: true },
        });
      }
    });
  }

  function buildMarquee() {
    const track = $(".marquee__track");
    if (!track) return;
    if (FULL) {
      // Drifts on its own, speeds up with scroll velocity, flips with direction.
      const loop = G.to(track, { xPercent: -50, duration: 30, ease: "none", repeat: -1 });
      loop.totalTime(loop.duration() * 500);
      let boost = 0;
      let dir = 1;
      ST.create({
        trigger: ".marquee",
        start: "top bottom",
        end: "bottom top",
        onUpdate: (s) => {
          boost = Math.min(6, Math.abs(s.getVelocity()) / 300);
          dir = s.direction;
        },
      });
      G.ticker.add(() => {
        boost *= 0.93;
        loop.timeScale(dir * (1 + boost));
      });
    } else {
      G.fromTo(
        track,
        { xPercent: 0 },
        { xPercent: -25, ease: "none", scrollTrigger: { trigger: ".marquee", start: "top bottom", end: "bottom top", scrub: true } }
      );
    }
  }

  function buildWork() {
    // The one moment in this section: the links in the small flow draw across.
    const links = $$(".work__flow .link");
    if (!FULL || !links.length) return;
    // --draw scales the link along its own axis: across on wide screens, down on phones.
    G.from(links, {
      "--draw": 0,
      duration: 0.7,
      ease: "power2.inOut",
      stagger: 0.25,
      scrollTrigger: { trigger: ".work__flow", start: "top 85%", once: true },
    });
  }

  function buildExperience() {
    const section = $("#experience");
    const track = $(".exp__track");
    if (!section || !track) return;
    const mm = G.matchMedia();
    mm.add("(min-width: 900px)", () => {
      section.classList.add("is-pan");
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const pan = G.to(track, {
        x: () => -dist(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${dist()}`,
          pin: true,
          scrub: FULL ? 0.7 : true,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
      $$(".exp__panel", track).forEach((panel) =>
        G.from(panel, {
          rotation: 8,
          yPercent: 22,
          ease: "none",
          scrollTrigger: { trigger: panel, containerAnimation: pan, start: "left 100%", end: "left 55%", scrub: true },
        })
      );
      return () => section.classList.remove("is-pan");
    });
    mm.add("(max-width: 899px)", () => {
      $$(".exp__panel").forEach((panel) =>
        G.from(
          panel,
          FULL
            ? { y: 60, opacity: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: panel, start: "top 88%", once: true } }
            : { y: 40, ease: "none", scrollTrigger: { trigger: panel, start: "top 98%", end: "top 70%", scrub: true } }
        )
      );
    });
  }

  function buildProjects() {
    const slots = $$(".deck__slot");
    if (!slots.length) return;
    const tilt = [-10, 2, 12];
    if (FULL) {
      G.from(slots, {
        y: 160,
        rotation: (i) => tilt[i % 3],
        opacity: 0,
        duration: 1.15,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: { trigger: ".deck", start: "top 82%", once: true },
      });
    } else {
      G.from(slots, {
        y: 90,
        rotation: (i) => tilt[i % 3] * 0.6,
        ease: "none",
        stagger: 0.1,
        scrollTrigger: { trigger: ".deck", start: "top 98%", end: "top 50%", scrub: true },
      });
    }
  }

  function buildSpecs() {
    // Counters (Minimal Counter Story): count up on arrival, or with the scroll.
    $$("[data-count]").forEach((el) => {
      const end = Number(el.dataset.count);
      const from = Number(el.dataset.from || 0);
      const n = { v: from };
      el.textContent = String(from);
      const write = () => (el.textContent = String(Math.round(n.v)));
      if (FULL) {
        G.to(n, { v: end, duration: 1.8, ease: "power3.out", onUpdate: write, scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      } else {
        G.to(n, { v: end, ease: "none", onUpdate: write, scrollTrigger: { trigger: el, start: "top 98%", end: "top 60%", scrub: true } });
      }
    });
    if (FULL) {
      G.from(".cell", {
        y: 50,
        opacity: 0,
        duration: 0.85,
        ease: "power3.out",
        stagger: 0.06,
        scrollTrigger: { trigger: ".bento", start: "top 82%", once: true },
      });
      G.from(".chips li", {
        scale: 0.85,
        opacity: 0,
        duration: 0.45,
        ease: "back.out(2)",
        stagger: 0.015,
        scrollTrigger: { trigger: ".bento", start: "top 60%", once: true },
      });
    }
  }

  function buildNav() {
    // The lens follows the section you're reading.
    links.forEach((link) => {
      const section = $(link.getAttribute("href"));
      if (!section) return;
      // A pinned section scrolls for longer than its own height: track its spacer.
      const spacer = section.parentElement?.classList.contains("pin-spacer") ? section.parentElement : section;
      ST.create({
        trigger: spacer,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (self) => {
          if (self.isActive) setCurrent(link);
          else if (current === link) setCurrent(null);
        },
      });
    });
    // Like iOS: the pill tucks in as you scroll down, and comes back on the way up.
    let compact = false;
    ST.create({
      start: 0,
      end: "max",
      onUpdate: (s) => {
        const y = s.scroll();
        const next = y > 160 && s.direction === 1 ? true : s.direction === -1 || y <= 160 ? false : compact;
        if (next !== compact) {
          compact = next;
          nav?.classList.toggle("is-compact", compact);
        }
      },
    });
  }

  function buildHeroScroll() {
    // The name narrows and lifts as you scroll away from it.
    G.to(".hero__name", {
      "--wdth": 68,
      yPercent: -10,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });
  }

  function intro() {
    bump(1);
    const done = () => {
      loader?.remove();
      lenis?.start();
    };
    if (!FULL) {
      G.to(loader, { opacity: 0, duration: 0.25, onComplete: done });
      buildHeroScroll();
      return;
    }
    G.timeline({ defaults: { ease: "power4.out" }, onComplete: buildHeroScroll })
      .to(loader, { yPercent: -100, duration: 0.95, ease: "power4.inOut", delay: 0.2 })
      .add(done)
      .from(".hero__name .line > span", { yPercent: 115, duration: 1.15, stagger: 0.1 }, "-=0.4")
      .fromTo(".hero__name", { "--wdth": 62 }, { "--wdth": 112, duration: 1.7, ease: "power3.out" }, "<")
      .from(
        ".hero .eyebrow, .hero__lede, .hero__ctas > :not([hidden])",
        { y: 26, opacity: 0, duration: 0.9, stagger: 0.07, clearProps: "transform,opacity" },
        "-=1.2"
      )
      // y only: fading the bar would hide the page from its glass until the end.
      .from(".nav", { y: -90, duration: 1, ease: "back.out(1.4)", clearProps: "transform" }, "<");
  }

  async function boot() {
    await Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2000))]);
    if (!OFF) {
      // Build in page order so pins measure each other correctly.
      buildSplits();
      buildMarquee();
      buildWork();
      buildExperience();
      buildProjects();
      buildSpecs();
    }
    buildNav();
    ST.refresh();
    intro();
  }

  boot();
})();
