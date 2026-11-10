import { inkParams, type InkParams } from '../gl/params';
import type { InkTransition } from './inkTransition';
import './demoPanel.css';

/**
 * Hidden filming controls (toggle with "D"). Settings persist in localStorage so a
 * recording session survives reloads. The panel is position: fixed and excluded from
 * snapshots, so it never ends up in the ink.
 */

type SliderKey = 'duration' | 'tendril' | 'noiseScale' | 'softness' | 'drift';

interface SliderDef {
  key: SliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const SLIDERS: SliderDef[] = [
  { key: 'duration', label: 'Duration', min: 0.4, max: 4, step: 0.05, format: (v) => `${v.toFixed(2)}s` },
  { key: 'tendril', label: 'Tendrils', min: 0, max: 2.5, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'noiseScale', label: 'Noise scale', min: 0.4, max: 2.5, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'softness', label: 'Edge softness', min: 0.5, max: 8, step: 0.1, format: (v) => `${v.toFixed(1)}px` },
  { key: 'drift', label: 'Drift speed', min: 0, max: 4, step: 0.05, format: (v) => v.toFixed(2) },
];

const STORAGE_KEY = 'ink-bleed:params:v1';
const DEFAULTS: InkParams = { ...inkParams };
const SLOW_MO = 0.25;

export interface PanelOptions {
  showMarker: boolean;
  onMarkerChange: (show: boolean) => void;
}

/** Applies persisted settings to `inkParams`. Call before the first transition. */
export function loadSettings(): { showMarker: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { showMarker: true };
    const saved = JSON.parse(raw) as Partial<InkParams> & { showMarker?: boolean };
    for (const s of SLIDERS) {
      const v = saved[s.key];
      if (typeof v === 'number' && Number.isFinite(v)) inkParams[s.key] = clamp(v, s.min, s.max);
    }
    if (saved.timeScale === SLOW_MO) inkParams.timeScale = SLOW_MO;
    return { showMarker: saved.showMarker !== false };
  } catch {
    return { showMarker: true };
  }
}

export class DemoPanel {
  readonly el: HTMLElement;
  private readonly ink: InkTransition;
  private readonly opts: PanelOptions;
  private readonly replayButton: HTMLButtonElement;
  private showMarker: boolean;

  constructor(ink: InkTransition, opts: PanelOptions) {
    this.ink = ink;
    this.opts = opts;
    this.showMarker = opts.showMarker;

    const el = document.createElement('aside');
    el.className = 'demo-panel';
    el.hidden = true;
    el.setAttribute('aria-label', 'Ink demo controls');
    el.setAttribute('data-html2canvas-ignore', '');
    el.innerHTML = `
      <header class="demo-panel__head">
        <span>Ink controls</span>
        <span class="demo-panel__mode">${ink.isWebGL ? 'WebGL2' : 'CSS fallback'}</span>
      </header>
      <div class="demo-panel__sliders"></div>
      <label class="demo-panel__check">
        <input type="checkbox" data-slowmo /> Slow motion 0.25×
      </label>
      <label class="demo-panel__check">
        <input type="checkbox" data-marker /> Tap marker (auto mode)
      </label>
      <div class="demo-panel__actions">
        <button type="button" data-replay disabled>Replay last click</button>
        <button type="button" data-reset class="is-quiet">Reset</button>
      </div>
      <p class="demo-panel__keys"><kbd>D</kbd> panel · <kbd>T</kbd> toggle · <kbd>R</kbd> replay</p>
    `;

    const sliders = el.querySelector<HTMLElement>('.demo-panel__sliders');
    for (const s of SLIDERS) sliders?.append(this.slider(s));

    const slowmo = el.querySelector<HTMLInputElement>('[data-slowmo]');
    if (slowmo) {
      slowmo.checked = inkParams.timeScale === SLOW_MO;
      slowmo.addEventListener('change', () => {
        this.ink.setTimeScale(slowmo.checked ? SLOW_MO : 1);
        this.save();
      });
    }

    const marker = el.querySelector<HTMLInputElement>('[data-marker]');
    if (marker) {
      marker.checked = this.showMarker;
      marker.addEventListener('change', () => {
        this.showMarker = marker.checked;
        this.opts.onMarkerChange(marker.checked);
        this.save();
      });
    }

    const replay = el.querySelector<HTMLButtonElement>('[data-replay]');
    if (!replay) throw new Error('demo panel markup');
    this.replayButton = replay;
    replay.addEventListener('click', () => this.replay());

    el.querySelector('[data-reset]')?.addEventListener('click', () => this.reset());

    document.body.append(el);
    this.el = el;
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  toggle(): void {
    this.el.hidden = !this.el.hidden;
    if (this.isOpen) this.refresh();
  }

  replay(): void {
    this.ink.replay();
  }

  /** Re-sync controls that depend on transition state. */
  refresh(): void {
    this.replayButton.disabled = this.ink.lastClick === null;
  }

  private slider(def: SliderDef): HTMLElement {
    const row = document.createElement('label');
    row.className = 'demo-panel__row';
    row.innerHTML = `
      <span class="demo-panel__label">${def.label}</span>
      <output class="demo-panel__value"></output>
      <input type="range" min="${def.min}" max="${def.max}" step="${def.step}" />
    `;
    const input = row.querySelector('input');
    const output = row.querySelector('output');
    if (!input || !output) return row;
    input.dataset.key = def.key;
    input.value = String(inkParams[def.key]);
    output.textContent = def.format(inkParams[def.key]);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      inkParams[def.key] = v; // read every frame by the renderer; duration applies next click
      output.textContent = def.format(v);
      this.save();
    });
    return row;
  }

  private reset(): void {
    for (const s of SLIDERS) {
      inkParams[s.key] = DEFAULTS[s.key];
      const input = this.el.querySelector<HTMLInputElement>(`input[data-key="${s.key}"]`);
      const output = input?.parentElement?.querySelector('output');
      if (input) input.value = String(DEFAULTS[s.key]);
      if (output) output.textContent = s.format(DEFAULTS[s.key]);
    }
    const slowmo = this.el.querySelector<HTMLInputElement>('[data-slowmo]');
    if (slowmo) slowmo.checked = false;
    this.ink.setTimeScale(1);
    this.save();
  }

  private save(): void {
    try {
      const data: Record<string, unknown> = { timeScale: inkParams.timeScale, showMarker: this.showMarker };
      for (const s of SLIDERS) data[s.key] = inkParams[s.key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable (private mode): settings just won't persist */
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
