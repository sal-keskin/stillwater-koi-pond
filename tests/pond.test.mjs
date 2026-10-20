import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KoiPond } from '../dist/stillwater.js';

// Minimal browser boundaries for deterministic simulation and lifecycle checks.
// Visual rendering and actual controls are checked separately in the browser.
const gradient = { addColorStop() {} };
const context = new Proxy({}, { get: (_, property) => property.startsWith('create') ? () => gradient : () => {}, set: () => true });
const scheduled = new Map();
let nextFrame = 0;
let reduced = false;
let observers = [];
class Observer {
  constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
  observe() {}
  disconnect() { this.disconnected = true; }
}
function canvas(width = 1200, height = 800) {
  return Object.assign(new EventTarget(), { width: 300, height: 150, getContext: () => context, getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) });
}
globalThis.document = Object.assign(new EventTarget(), { hidden: false, createElement: () => canvas() });
globalThis.matchMedia = () => Object.assign(new EventTarget(), { matches: reduced });
globalThis.ResizeObserver = Observer;
globalThis.IntersectionObserver = Observer;
globalThis.devicePixelRatio = 3;
globalThis.requestAnimationFrame = callback => { scheduled.set(++nextFrame, callback); return nextFrame; };
globalThis.cancelAnimationFrame = id => scheduled.delete(id);

test('the simulation stays finite and in bounds through twenty minutes and resizes', () => {
  const surface = canvas();
  const pond = new KoiPond(surface, { count: 12, interactive: false });
  for (let step = 0; step < 36000; step++) pond.step(1 / 30);
  assert.equal(pond.canvas.width, 2400, 'device pixel ratio is capped at two');
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 640 });
  pond.resize();
  for (let step = 0; step < 6000; step++) pond.step(1 / 30);
  assert.equal(pond.canvas.width, 640, 'resize uses the new container width');
  for (const fish of pond.fish) {
    for (const field of ['x', 'y', 'heading', 'turn', 'phase']) assert.ok(Number.isFinite(fish[field]), field);
    assert.ok(fish.x >= -.04 && fish.x <= 1.04);
    assert.ok(fish.y >= -.04 && fish.y <= 1.04);
  }
  assert.ok(pond.ripples.length < 16, 'ambient ripple history must stay bounded');
  pond.destroy();
});

test('public count input is bounded, including nonfinite values', () => {
  const pond = new KoiPond(canvas(), { interactive: false });
  for (const [value, expected] of [[-10, 3], [100000, 12], [NaN, 7], [Infinity, 7], [5.3, 5]]) {
    pond.setCount(value); assert.equal(pond.count, expected);
  }
  pond.destroy();
});

test('reduced motion starts still; explicit resume works; destroy releases resources', () => {
  reduced = true; observers = []; scheduled.clear();
  const pond = new KoiPond(canvas(), { interactive: false });
  assert.equal(pond.paused, true);
  assert.equal(scheduled.size, 0);
  pond.ripple(30, 30); assert.equal(pond.ripples.length, 0);
  pond.setPaused(false); assert.equal(scheduled.size, 1);
  pond.ripple(30, 30); assert.equal(pond.ripples.length, 1);
  pond.setPaused(true); assert.equal(scheduled.size, 0);
  pond.setPaused(false); pond.destroy();
  assert.equal(scheduled.size, 0);
  assert.ok(observers.every(observer => observer.disconnected));
  assert.ok(pond.abort.signal.aborted);
  reduced = false;
});

test('off-screen and hidden canvases stop requesting animation frames', () => {
  observers = []; scheduled.clear();
  const pond = new KoiPond(canvas(), { interactive: false });
  const intersection = observers[1];
  intersection.callback([{ isIntersecting: false }]); assert.equal(scheduled.size, 0);
  intersection.callback([{ isIntersecting: true }]); assert.equal(scheduled.size, 1);
  document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); assert.equal(scheduled.size, 0);
  document.hidden = false; document.dispatchEvent(new Event('visibilitychange')); assert.equal(scheduled.size, 1);
  pond.destroy();
});
