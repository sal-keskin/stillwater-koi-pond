/** A self-contained, network-free canvas background. No framework or assets required. */
export type PondTheme = "day" | "dusk";
export interface PondOptions {
  count?: number;
  theme?: PondTheme;
  interactive?: boolean;
  onRipple?: (x: number, y: number) => void;
}
interface Koi { x: number; y: number; heading: number; turn: number; phase: number; size: number; seed: number; kind: number; }
interface Ripple { x: number; y: number; age: number; }
const TAU = Math.PI * 2;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const PALETTES = {
  day: { water: "#e7e8d9", light: "#f3f0e5", depth: "#aab6a0", ripple: "#5e7766", shadow: "#354b3d", leaf: "#758b59", leafLight: "#97a579", vein: "#556b43", stone: "#9faaa0", gold: "#c7ab66", reflection: "#fffdf1", speck: "#7b8d76" },
  dusk: { water: "#253c36", light: "#3f5747", depth: "#162e2b", ripple: "#9da98a", shadow: "#0e201f", leaf: "#3f5a40", leafLight: "#65764b", vein: "#294934", stone: "#4e6459", gold: "#a58b58", reflection: "#b7c7a4", speck: "#819779" },
};
const SKINS = [
  ["#f4eddb", "#bd5132", "#d47949", "#33413a"],
  ["#eee7d5", "#d39d3b", "#bb7930", "#575946"],
  ["#efe9db", "#35433d", "#b75a3b", "#26352e"],
  ["#d58b4e", "#e8ba77", "#ad6540", "#3f4839"],
];
const GLYPHS = ".:;+*o%";
const spriteCache = new Map<string, HTMLCanvasElement[]>();

/** Pre-render a few swimming phases rather than rasterising every fish every frame. */
function sprites(kind: number, seed: number) {
  const key = `${kind}:${seed}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const frames: HTMLCanvasElement[] = [];
  const colors = SKINS[kind % SKINS.length];
  for (let frame = 0; frame < 20; frame++) {
    const surface = document.createElement("canvas");
    surface.width = 300; surface.height = 150;
    const g = surface.getContext("2d")!;
    const phase = frame / 20 * TAU;
    g.font = "bold 7px ui-monospace, Menlo, monospace";
    g.textAlign = "center"; g.textBaseline = "middle";
    for (let px = 18; px < 283; px += 4) {
      // snout at right; tail at left
      const s = (265 - px) / 235;
      if (s < 0 || s > 1.05) continue;
      const bend = Math.sin(phase - s * 4.8) * Math.pow(s, 1.8) * 15;
      const width = s < .14 ? 22 * Math.sqrt(Math.max(0, 1 - ((s - .14) / .14) ** 2))
        : s < .38 ? 22 + 2 * Math.sin((s - .14) * 9)
        : 24 * Math.pow(Math.max(0, 1 - (s - .38) / .55), .85) + 1;
      for (let py = 20; py < 132; py += 5) {
        const v = py - 75 - bend;
        const a = Math.abs(v);
        const tail = s > .88 && s < 1.04 && a < (s - .87) * 185 && a > Math.max(0, (s - .97) * 95);
        const fins = s > .24 && s < .5 && a < 43 * Math.sin((s - .24) / .26 * Math.PI) && a > width * .8;
        const rearFin = s > .65 && s < .79 && a < 17 * Math.sin((s - .65) / .14 * Math.PI);
        const body = s < .94 && a < width;
        if (!body && !tail && !fins && !rearFin) continue;
        const n = hash(px * 9.7 + py * 3.1 + seed);
        const marking = Math.sin(s * 17 + seed + Math.sin(v * .14) * 1.3) + Math.cos(v * .12 + s * 8 + seed) > .25;
        const black = kind === 2 && Math.sin(s * 31 + v * .2 + seed) > .65;
        let color = body ? (black ? colors[1] : marking ? colors[1] : colors[0]) : colors[0];
        if (body && marking && n > .78) color = colors[2];
        if (s < .115 && a > width * .58 && a < width * .87) color = colors[3];
        g.globalAlpha = body ? .85 : .3 + n * .35;
        g.fillStyle = color;
        // A continuous ivory silhouette, with fine ink-like texture on the scales.
        const edge = body && a > width * .83;
        if (body && !edge) {
          g.fillRect(px - 2, py - 2.5, 4, 5);
          if (color === colors[0]) { g.fillStyle = colors[3]; g.globalAlpha = .17; }
        }
        if (edge) { g.fillStyle = colors[3]; g.globalAlpha = .28; }
        g.fillText(edge || !body ? (n > .5 ? ":" : ".") : GLYPHS[Math.floor(n * GLYPHS.length)], px, py);
      }
    }
    frames.push(surface);
  }
  spriteCache.set(key, frames);
  return frames;
}

export class KoiPond {
  private ctx: CanvasRenderingContext2D;
  private floor: HTMLCanvasElement;
  private plants: HTMLCanvasElement;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private fish: Koi[] = [];
  private ripples: Ripple[] = [];
  private pointer = { x: 0, y: 0, active: false };
  private time = 0;
  private last = 0;
  private raf = 0;
  private nextRipple = 5;
  private manualPause = false;
  private disposed = false;
  private visible = true;
  private motion = matchMedia("(prefers-reduced-motion: reduce)");
  private abort = new AbortController();
  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver;
  private theme: PondTheme;
  readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, private options: PondOptions = {}) {
    this.canvas = canvas;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser does not support a 2D canvas.");
    this.ctx = context;
    this.floor = document.createElement("canvas");
    this.plants = document.createElement("canvas");
    this.theme = options.theme === "dusk" ? "dusk" : "day";
    this.manualPause = this.motion.matches;
    this.setCount(options.count ?? 7);
    const signal = this.abort.signal;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.schedule(); });
    this.intersectionObserver.observe(canvas);
    document.addEventListener("visibilitychange", () => this.schedule(), { signal });
    this.motion.addEventListener("change", () => { this.manualPause = this.motion.matches; this.schedule(); }, { signal });
    if (options.interactive !== false) {
      canvas.addEventListener("pointermove", (event) => {
        const r = canvas.getBoundingClientRect();
        this.pointer = { x: event.clientX - r.left, y: event.clientY - r.top, active: event.pointerType !== "touch" };
      }, { passive: true, signal });
      canvas.addEventListener("pointerleave", () => { this.pointer.active = false; }, { signal });
      canvas.addEventListener("pointerdown", (event) => {
        const r = canvas.getBoundingClientRect();
        this.ripple(event.clientX - r.left, event.clientY - r.top);
      }, { passive: true, signal });
    }
    this.resize();
    this.schedule();
  }

  get paused() { return this.manualPause; }
  get count() { return this.fish.length; }
  setPaused(paused: boolean) { this.manualPause = paused; this.schedule(); }
  setTheme(theme: PondTheme) {
    this.theme = theme === "dusk" ? "dusk" : "day";
    this.paintEnvironment(); this.draw();
  }
  setCount(value: number) {
    const count = clamp(Number.isFinite(value) ? Math.round(value) : 7, 3, 12);
    const positions = [[.70,.29],[.58,.62],[.84,.72],[.36,.76],[.85,.43],[.25,.55],[.55,.15],[.17,.32],[.76,.88],[.43,.4],[.16,.85],[.94,.23]];
    this.fish = Array.from({ length: count }, (_, i) => this.fish[i] ?? {
      x: positions[i][0], y: positions[i][1], heading: [2.5,-.5,-2.4,.8,1.6,-.9,2.9][i % 7], turn: 0,
      phase: hash(i + 8) * TAU, size: .78 + hash(i * 3 + 10) * .35, seed: i * 13 + 4, kind: i % 4,
    });
    this.draw();
  }
  ripple(x: number, y: number) {
    if (this.manualPause) return;
    this.ripples.push({ x: x / this.width, y: y / this.height, age: 0 });
    if (this.ripples.length > 16) this.ripples.shift();
    this.options.onRipple?.(x / this.width, y / this.height);
  }
  destroy() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    this.abort.abort(); this.resizeObserver.disconnect(); this.intersectionObserver.disconnect();
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    this.width = rect.width; this.height = rect.height;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    for (const surface of [this.canvas, this.floor, this.plants]) {
      surface.width = Math.round(this.width * this.dpr); surface.height = Math.round(this.height * this.dpr);
    }
    this.paintEnvironment(); this.draw();
  }

  private paintEnvironment() {
    const g = this.floor.getContext("2d"); const p = this.plants.getContext("2d");
    if (!g || !p) return;
    const { width: w, height: h, dpr } = this; const c = PALETTES[this.theme];
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const water = g.createLinearGradient(0, 0, w, h);
    water.addColorStop(0, c.light); water.addColorStop(.52, c.water); water.addColorStop(1, c.depth);
    g.fillStyle = water; g.fillRect(0, 0, w, h);
    // Silt and fine mineral grains, fixed to the pond bed.
    for (let i = 0; i < Math.min(20000, w * h / 80); i++) {
      const x = hash(i * 3 + 1) * w; const y = hash(i * 3 + 2) * h;
      g.globalAlpha = .035 + hash(i * 7) * .09;
      g.fillStyle = i % 3 ? c.speck : c.reflection;
      g.fillRect(x, y, i % 5 ? 1 : 2, 1);
    }
    // A little constellation of river stones under the water.
    for (let i = 0; i < 32; i++) {
      const x = w * (.76 + hash(i * 7) * .25); const y = h * (.75 + hash(i * 9) * .3);
      g.globalAlpha = .11; g.fillStyle = c.stone;
      g.beginPath(); g.ellipse(x, y, 5 + hash(i) * 22, 3 + hash(i + 5) * 13, hash(i + 3) * 3, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    p.setTransform(dpr, 0, 0, dpr, 0, 0); p.clearRect(0, 0, w, h);
    const scale = clamp(w / 1100, .65, 1.15);
    // The corners frame the water while leaving the middle open.
    const leaves = [[.96,.10,64,.4],[1.015,.23,78,-.2],[.89,.035,48,1.3],[.91,.18,39,2.2],[-.015,.85,76,1.2],[.065,.94,66,2.4],[.115,1.015,84,.7],[.035,.75,41,-.8]];
    for (const [x, y, r, rotation] of leaves) this.leaf(p, x * w, y * h, r * scale, rotation, c);
  }

  private leaf(g: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number, c: typeof PALETTES.day) {
    g.save(); g.translate(x, y); g.rotate(rotation); g.scale(1, .8);
    g.fillStyle = c.shadow; g.globalAlpha = .12;
    g.beginPath(); g.ellipse(9, 14, radius * 1.1, radius, 0, 0, TAU); g.fill();
    g.globalAlpha = .9;
    const fill = g.createRadialGradient(-radius * .3, -radius * .4, 0, 0, 0, radius);
    fill.addColorStop(0, c.leafLight); fill.addColorStop(1, c.leaf);
    g.fillStyle = fill; g.beginPath(); g.moveTo(0, 0);
    g.arc(0, 0, radius, .16, TAU - .16); g.closePath(); g.fill();
    g.strokeStyle = c.vein; g.lineWidth = .6; g.globalAlpha = .32;
    for (let i = 1; i < 12; i++) {
      const a = i / 12 * TAU;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a - .12) * radius * .5, Math.sin(a - .12) * radius * .5, Math.cos(a) * radius * .92, Math.sin(a) * radius * .92); g.stroke();
    }
    // ASCII flecks keep the plants in the same material language as the koi.
    g.font = "7px ui-monospace, Menlo, monospace"; g.fillStyle = c.reflection; g.globalAlpha = .18;
    for (let i = 0; i < 42; i++) { const a = hash(i + radius) * TAU; const r = Math.sqrt(hash(i * 4 + radius)) * radius * .9; g.fillText("·", Math.cos(a) * r, Math.sin(a) * r); }
    g.restore();
  }

  private schedule() {
    cancelAnimationFrame(this.raf);
    if (this.disposed || this.manualPause || !this.visible || document.hidden) { this.draw(); return; }
    this.last = performance.now(); this.raf = requestAnimationFrame(this.frame);
  }
  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min((now - this.last) / 1000, .05);
    // A gentle 30fps cap avoids burning a laptop battery behind page content.
    if (now - this.last < 30) { this.raf = requestAnimationFrame(this.frame); return; }
    this.last = now; this.time += dt; this.step(dt); this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };
  private step(dt: number) {
    const w = this.width, h = this.height;
    for (const [i, f] of this.fish.entries()) {
      let desired = f.heading + Math.sin(this.time * .17 + f.seed) * .4;
      let dx = Math.cos(desired), dy = Math.sin(desired);
      const marginX = Math.min(.15, 80 / w), marginY = Math.min(.15, 80 / h);
      if (f.x < marginX) dx += (marginX - f.x) * 25;
      if (f.x > 1 - marginX) dx -= (f.x - 1 + marginX) * 25;
      if (f.y < marginY) dy += (marginY - f.y) * 25;
      if (f.y > 1 - marginY) dy -= (f.y - 1 + marginY) * 25;
      for (const other of this.fish) {
        if (f === other) continue;
        const ox = (f.x - other.x) * w, oy = (f.y - other.y) * h; const d = Math.hypot(ox, oy);
        if (d < 100 && d > 1) { dx += ox / d * (1 - d / 100) * .7; dy += oy / d * (1 - d / 100) * .7; }
      }
      if (this.pointer.active) {
        const px = this.pointer.x - f.x * w, py = this.pointer.y - f.y * h; const d = Math.hypot(px, py);
        if (d > 70 && d < 260) { dx += px / d * .25; dy += py / d * .25; }
      }
      desired = Math.atan2(dy, dx);
      f.turn += (clamp(angle(desired - f.heading), -.4, .4) - f.turn) * dt * 1.8;
      f.heading += f.turn * dt;
      const speed = (15 + i % 3 * 3) * clamp(w / 1000, .55, 1);
      f.x = clamp(f.x + Math.cos(f.heading) * speed * dt / w, -.04, 1.04);
      f.y = clamp(f.y + Math.sin(f.heading) * speed * dt / h, -.04, 1.04);
      f.phase += dt * 1.6;
    }
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter(r => r.age < 5);
    if (this.time > this.nextRipple) {
      this.ripples.push({ x: .15 + hash(this.time) * .7, y: .18 + hash(this.time + 7) * .64, age: 0 });
      this.nextRipple = this.time + 6 + hash(this.time + 1) * 5;
    }
  }

  private draw() {
    if (!this.ctx || !this.floor.width) return;
    const g = this.ctx, w = this.width, h = this.height; const c = PALETTES[this.theme];
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.drawImage(this.floor, 0, 0);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Soft refracted lines in the water, drawn below the fish.
    g.strokeStyle = c.reflection; g.lineWidth = .8;
    for (let j = 0; j < 12; j++) {
      g.globalAlpha = .08;
      g.beginPath();
      for (let x = -20; x < w + 30; x += 18) {
        const y = (j / 12) * h + Math.sin(x * .007 + this.time * .12 + j * 2) * 24 + Math.sin(x * .016 - this.time * .08 + j) * 9;
        if (x === -20) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    const scale = clamp(w / 1050, .52, 1.1);
    for (const f of this.fish) {
      const frames = sprites(f.kind, f.seed);
      const image = frames[Math.floor((f.phase % TAU + TAU) % TAU / TAU * frames.length)];
      const size = 244 * scale * f.size;
      g.save(); g.translate(f.x * w, f.y * h); g.rotate(f.heading);
      g.globalAlpha = .055; g.fillStyle = c.shadow;
      g.filter = "blur(5px)";
      g.beginPath(); g.ellipse(4, 7, size * .33, size * .065, 0, 0, TAU); g.fill();
      g.filter = "none";
      g.globalAlpha = this.theme === "dusk" ? .85 : .98;
      g.drawImage(image, -size * .5, -size * .25, size, size * .5);
      g.restore();
      // Two tiny wake curves following the tail.
      g.save(); g.translate(f.x * w - Math.cos(f.heading) * size * .43, f.y * h - Math.sin(f.heading) * size * .43); g.rotate(f.heading);
      g.strokeStyle = c.ripple; g.globalAlpha = .10; g.lineWidth = .7;
      for (const side of [-1, 1]) { g.beginPath(); g.moveTo(-size * .18, side * size * .05); g.quadraticCurveTo(-size * .06, side * size * .07, 0, side * size * .01); g.stroke(); }
      g.restore();
    }
    for (const r of this.ripples) {
      for (let i = 0; i < 3; i++) {
        const age = r.age - i * .4;
        if (age < 0) continue;
        g.globalAlpha = Math.max(0, 1 - age / 4) * .22; g.strokeStyle = c.ripple; g.lineWidth = .75;
        g.beginPath(); g.ellipse(r.x * w, r.y * h, 8 + age * 25, 5 + age * 19, -.15, 0, TAU); g.stroke();
      }
    }
    g.globalAlpha = 1; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(this.plants, 0, 0);
  }
}
