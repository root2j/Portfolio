# Portfolio

The personal site of Rutuj Dhongade, served by GitHub Pages at
<https://root2j.github.io/Portfolio/>.

Plain HTML, CSS and JavaScript with no build step. Every library, font and
image is served from this repo: no CDNs, no analytics, no trackers.

## The look

The original off-white sky, brought to life. The cloud photo runs through a
WebGL shader so the clouds billow, light falls from the top left and fine
grain moves over it; at night it's the same sky, dimmed, with stars. Type is
ink on sky, and every surface is frosted glass. The day sky is the default;
the moon button switches to night.

| Source | Where it shows up |
| --- | --- |
| ShaderGradient | The moving grain and light in the living sky (`sky.js`) |
| FluidGlass (React Bits) / iOS liquid glass | The whole nav is liquid glass. In Chromium it really refracts: the page behind it (sky, your name, the cards) bends at the pill's rounded edge, with a slight colour split, through SVG displacement maps drawn by `app.js`. A lens of thicker glass follows the pointer, stretches as it moves, swells when pressed, magnifies the label under it, and rests on the section you're reading. The monogram and Email me are tinted glass; the other buttons are clear glass bubbles. The glass frosts a little more once the page scrolls under it, and the pill tucks in as you scroll down. Settings match the snippet (`shape: "lens"`, `refraction: 1`, `dispersion: 0.35`, `interaction: "follow"`) in `GLASS` in `app.js`. Safari and Firefox get frosted glass with the same rims and lens. |
| Liquid Logo / Paper Shaders | The liquid-metal RD monogram and the chrome ring round the photo (`liquid.js`) |
| Pretext | The About text re-flows live around the moving photo (`liquid.js`) |
| Pokémon Cards CSS | Holographic foil and tilt on the project cards (`app.js`, `site.css`) |
| Minimal Counter Story | The counters in the spec sheet |
| The Wada Pav artifact | Loader, sideways experience pan, scroll-velocity marquee, bento grid, grain, motion switch |

## Files

```
index.html                    the page
assets/css/site.css           all styles, day and night
assets/js/app.js              motion levels, loader, scroll choreography, liquid glass nav, cards
assets/js/sky.js              the living sky (Paper Shaders ShaderMount)
assets/Rutuj-Dhongade-Resume.pdf   the public resume behind the hero button
assets/js/liquid.js           liquid metal (Paper Shaders) and text flow (Pretext)
assets/js/vendor/             GSAP + ScrollTrigger, Lenis, Paper Shaders, Pretext, with licences
assets/fonts/                 Archivo and JetBrains Mono, with licences
assets/img/                   sky, photo, liquid-metal logo map, social image, touch icon
favicon.svg
.nojekyll                     tells GitHub Pages to serve files as they are
```

## Preview locally

```
python -m http.server 8000
```

Then open <http://localhost:8000>. Paths are relative, so the same files work
at `/` locally and at `/Portfolio/` on GitHub Pages.

## Motion

Full motion is the default for every visitor, including when the OS asks for
reduced motion. The Motion button in the nav is always shown, so anyone can
switch it off; the choice is remembered in the browser. `?motion=off` and
`?motion=on` set it from a link.

| Level | When | What moves |
| --- | --- | --- |
| Full | Default | Everything |
| Off | The visitor picks it with the nav button, or `?motion=off` | Nothing. A plain, readable page. |

## Toning things down

| Effect | To turn it off |
| --- | --- |
| Loader | delete the `.loader` div in `index.html` |
| Living sky | remove the `sky.js` script tag; the photo stays as a still (or slowly drifting) background |
| Smooth scrolling | remove the `lenis.min.js` script tag |
| Marquee | delete the `.marquee` div |
| Sideways experience pan | delete `buildExperience()` from `boot()` in `app.js` |
| Lens chasing the pointer | set `interaction` in `GLASS` (`app.js`) to anything but `"follow"`; the lens then only marks the current section |
| Refraction | delete the `doc.classList.add("lg-on")` line in `app.js`; the nav stays frosted glass |
| Section tracking and tuck-in | delete `buildNav()` from `boot()` in `app.js` |
| Holographic cards | delete the `data-holo` attributes |
| Liquid metal and text flow | delete `startLiquid()` from `app.js` |
| Grain | delete the `.grain` div |

## Common edits

- **Resume:** replace `assets/Rutuj-Dhongade-Resume.pdf`, keeping the same
  name. It's the public copy: no internal names, numbers or systems.
- **Work section:** a short intro, the three-step flow (People, AI agents,
  Tools and data) and four work areas, each a heading and one sentence.
  Keep it general: no internal names, numbers or systems.
- **Add a project or demo:** copy a `.deck__slot` block in the Projects section.
- **Social image:** serve the site, open it in a 1200×630 window, hide the nav,
  screenshot the hero and save it as `assets/img/og.jpg`.
- **Liquid-metal logo:** `assets/img/rd-liquid.png` is "RD" in Archivo 800 run
  through Paper Shaders' `toProcessedLiquidMetal()`. It's an edge map, not a
  picture: the shader turns it into chrome.

## Credits

- Cloud photo by Miguel Á. Padriñán (the original site's background).
- GSAP 3.13.0 and ScrollTrigger, GSAP standard no-charge licence. Lenis
  1.1.13, MIT. Paper Shaders 0.0.82, Apache 2.0. Pretext 1.0.0, MIT.
- Fonts: Archivo and JetBrains Mono, SIL Open Font License 1.1.
- Icons: Tabler Icons 3.52.0, MIT.
- Effects after ShaderGradient, Liquid Glass JS, React Bits FluidGlass and
  Pokémon Cards CSS; the code here is written for this site.
