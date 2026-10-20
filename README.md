# Stillwater · koi pond

A quiet, responsive canvas background: ASCII-textured koi, water ripples, lily pads, daylight and dusk, and original browser-generated harp-like notes and soft water ambience.

Adapted from [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks). The original shark engine is preserved in `src/engine.ts`, `src/world.ts`, and `src/renderer.ts`; the pond and audio are new implementations. See [UPSTREAM.md](UPSTREAM.md) for the original README.

## Run locally

Requires Node.js 22.14 or later in the Node 22 line (or a compatible newer LTS).

```sh
npm ci --ignore-scripts
npm run dev -- --host 127.0.0.1
```

Open the Local URL printed by Vite. Click **Enable sound** for audio. Nothing plays automatically. **Just the pond** hides the interface; Escape brings it back. Settings control lighting, fish count, and the two sound layers. Volume and pause remain separate controls.

```sh
npm run build
npm run preview
```

The production demo is in `dist/`. The build also creates two reusable, dependency-free background bundles:

- `dist/stillwater.js` — ES module exporting `KoiPond` and `PondAudio`.
- `dist/stillwater.global.js` — classic script exposing `window.Stillwater`.

Serve these over HTTP(S), rather than opening HTML through `file://`. Deploy the production files, rather than the development server. The site and embed use no external fonts, media, tracking, or network requests at runtime.

## Put a pond behind your webpage

Copy `dist/stillwater.js` into your website. Keep the canvas in a stacking context below the content:

```html
<canvas id="koi" aria-hidden="true"></canvas>
<style>
  body { isolation: isolate; }
  #koi {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
  }
</style>
<script type="module">
  import { KoiPond } from './stillwater.js';
  const pond = new KoiPond(document.querySelector('#koi'), {
    count: 7,
    theme: 'day',
    interactive: false
  });
  // Call pond.destroy() when your route/component unmounts.
</script>
```

For a section background, set the section to `position: relative; isolation: isolate; min-height: 480px`, and the canvas to `position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1`. The engine observes the canvas's actual size, so it works in a container as well as full screen. Page content retains its usual pointer interaction. A canvas behind content usually should use `interactive: false`; enable interaction when the canvas itself receives pointer events, as in the demo.

```ts
const pond = new KoiPond(canvas, {
  count: 7,              // clamped to 3–12; invalid numbers default to 7
  theme: 'day',          // 'day' | 'dusk'
  interactive: true,     // pointer following and tap ripples
  onRipple: (x, y) => {} // coordinates normalised to 0–1
});
pond.setCount(5);
pond.setTheme('dusk');
pond.setPaused(true);
pond.ripple(120, 80);    // local CSS pixels; ignored while paused
pond.destroy();
```

## Opt-in audio

The sound is synthesised locally using Web Audio: soft plucked sine partials in a pentatonic melody, a generated reverb impulse, and gently filtered noise for water. There are no samples, recordings, third-party sound assets, or audio services.

```ts
import { PondAudio } from './stillwater.js';
const audio = new PondAudio();
// Call from a user gesture, such as a button click:
await audio.enable();
audio.setVolume(0.4);            // 0–1
audio.setLayers(true, true);    // harp, water
audio.touch(0.5);               // optional gentle pluck, x in 0–1
await audio.disable();
await audio.destroy();          // when unmounting
```

## Motion, performance, and accessibility

- Starts still when the system requests reduced motion; an explicit Resume action can enable swimming.
- Pauses rendering when the canvas is off screen or the tab is hidden. Audio suspends on hidden tabs, too.
- Caps rendering at approximately 30 fps and device pixel ratio at 2; fish swimming phases are cached.
- Does not steal page scrolling or require a mouse. Sound is opt-in, with volume and independent layer controls.
- Demo dialogs support keyboard focus, Escape, and backdrop dismissal.
- No ambient fish chasing, feeding, alarm effects, or abrupt splash sounds.

## Provenance and license

Upstream: https://github.com/stackedlol/ascii-sharks

Reviewed upstream commit: `c521e24a787e6d4cc460d4cf2b9815f25e4fe453`.

As checked on 20 October 2026, the upstream repository does not include a license. No license has been invented for the inherited source. Retain this provenance and resolve upstream licensing before distributing the inherited code outside the GitHub fork context.

The build tools are pinned in `package.json` and `package-lock.json`. Install scripts are not needed for this project; use `npm ci --ignore-scripts`. The original source audit is summarised in `SECURITY-REVIEW.md`.
