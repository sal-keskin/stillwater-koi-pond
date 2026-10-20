import { KoiPond } from "./src/pond";
import { PondAudio } from "./src/audio";
import "./src/style.css";

const get = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const audio = new PondAudio();
const canvas = get<HTMLCanvasElement>("#pond");
const pond = new KoiPond(canvas, { onRipple: (x) => audio.touch(x) });
const soundButton = get<HTMLButtonElement>("#sound-toggle");
const soundLabel = get("#sound-label");
const pauseButton = get<HTMLButtonElement>("#pause-toggle");
const status = get("#status");

function updateMotion() {
  pauseButton.setAttribute("aria-pressed", String(pond.paused));
  pauseButton.setAttribute("aria-label", pond.paused ? "Resume swimming" : "Pause swimming");
  pauseButton.title = pond.paused ? "Resume swimming" : "Pause swimming";
  get("#pond-state").textContent = pond.paused ? `${pond.count} koi, a moment of stillness` : `${pond.count} koi, taking their time`;
}
updateMotion();
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
motionPreference.addEventListener("change", updateMotion);

soundButton.addEventListener("click", async () => {
  soundButton.disabled = true; soundButton.setAttribute("aria-busy", "true"); status.textContent = "";
  soundLabel.textContent = audio.enabled ? "Fading out…" : "Starting sound…";
  try {
    if (audio.enabled) await audio.disable(); else await audio.enable();
    soundButton.setAttribute("aria-pressed", String(audio.enabled));
    soundButton.setAttribute("aria-label", audio.enabled ? "Mute harp and water sounds" : "Enable harp and water sounds");
    get("#sound-invitation").textContent = audio.enabled ? "stay as long as you like" : "a little quieter with sound ↘";
  } catch {
    status.textContent = "Sound couldn’t start. Tap to try again.";
  } finally {
    soundLabel.textContent = audio.enabled ? "Sound is on" : "Enable sound";
    soundButton.disabled = false; soundButton.removeAttribute("aria-busy");
  }
});
get<HTMLInputElement>("#volume").addEventListener("input", (event) => {
  const input = event.currentTarget as HTMLInputElement;
  audio.setVolume(Number(input.value) / 100);
  input.setAttribute("aria-valuetext", `${input.value} percent`);
});
pauseButton.addEventListener("click", () => { pond.setPaused(!pond.paused); updateMotion(); });
for (const name of ["settings", "embed"]) {
  const dialog = get<HTMLDialogElement>(`#${name}-dialog`);
  get(`#${name}-open`).addEventListener("click", () => dialog.showModal());
  dialog.querySelector(".dialog-close")!.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
  });
}
document.querySelectorAll<HTMLInputElement>('input[name="theme"]').forEach(input => input.addEventListener("change", () => {
  const theme = input.value === "dusk" ? "dusk" : "day";
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')!.setAttribute("content", theme === "dusk" ? "#253c36" : "#e7e8d9");
  pond.setTheme(theme);
}));
get<HTMLSelectElement>("#koi-count").addEventListener("change", (event) => { pond.setCount(Number((event.currentTarget as HTMLSelectElement).value)); updateMotion(); });
function updateLayers() {
  const harp = get<HTMLInputElement>("#harp-layer").checked, water = get<HTMLInputElement>("#water-layer").checked;
  audio.setLayers(harp, water);
  get("#sound-caption").textContent = harp && water ? "ORIGINAL HARP & SOFT WATER" : harp ? "ORIGINAL HARP" : water ? "SOFT WATER" : "SOUND LAYERS ARE OFF";
}
get("#harp-layer").addEventListener("change", updateLayers);
get("#water-layer").addEventListener("change", updateLayers);
get("#quiet-view").addEventListener("click", () => {
  document.body.classList.add("quiet"); get("#show-controls").hidden = false; get("#show-controls").focus();
});
get("#show-controls").addEventListener("click", () => {
  document.body.classList.remove("quiet"); get("#show-controls").hidden = true; get("#quiet-view").focus();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("quiet")) get("#show-controls").click();
});
get<HTMLButtonElement>("#copy-embed").addEventListener("click", async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  button.disabled = true;
  try {
    await navigator.clipboard.writeText(get("#embed-code").textContent!);
    button.textContent = "Copied ✓"; button.dataset.state = "success";
  } catch {
    button.textContent = "Select the code above to copy"; button.dataset.state = "error";
    const range = document.createRange(); range.selectNodeContents(get("#embed-code"));
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  } finally {
    button.disabled = false;
    setTimeout(() => { button.textContent = "Copy embed code ↗"; delete button.dataset.state; }, 3000);
  }
});
function dispose() { pond.destroy(); void audio.destroy(); motionPreference.removeEventListener("change", updateMotion); }
window.addEventListener("pagehide", (event) => { if (!event.persisted) dispose(); });
if (import.meta.hot) import.meta.hot.dispose(dispose);
