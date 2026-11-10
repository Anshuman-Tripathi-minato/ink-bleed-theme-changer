/**
 * Dev-only probes for tuning the ink without relying on real-time playback
 * (e.g. when the tab is backgrounded and rAF is paused). Exposed as `window.__probe`.
 */
import gsap from 'gsap';
import type { InkTransition } from '../ui/inkTransition';

interface InkInternals {
  frame: unknown;
  tween: gsap.core.Tween | null;
  state: { progress: number; time: number };
  renderer: { gl: WebGL2RenderingContext; canvas: HTMLCanvasElement };
  draw(): void;
  cancel(): void;
}

export function installProbe(ink: InkTransition): void {
  const t = ink as unknown as InkInternals;
  const ease = gsap.parseEase('power3.out');

  const start = (x: number, y: number): void => {
    if (t.frame) t.cancel();
    gsap.ticker.tick();
    ink.toggle({ x, y });
    t.tween?.pause();
  };

  /** Render the frame at linear time fraction `u` (0..1) of the current transition. */
  const at = (u: number, durationS = 1.4): void => {
    t.tween?.pause();
    t.state.progress = ease(u);
    t.state.time = u * durationS;
    t.draw();
  };

  // A paused page may never present new WebGL frames; mirror the frame into an <img>.
  let still: HTMLImageElement | null = null;
  const show = (u: number): void => {
    at(u);
    const url = t.renderer.canvas.toDataURL('image/png');
    if (!still) {
      still = document.createElement('img');
      still.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:3000;pointer-events:none';
      document.body.append(still);
    }
    still.src = url;
    still.hidden = false;
  };
  const hide = (): void => {
    if (still) still.hidden = true;
  };

  const pixels = (): Uint8Array => {
    const { gl, canvas } = t.renderer;
    const px = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  };

  /** Inked-area percentage at several time fractions, for a click at (x, y). */
  const curve = (x: number, y: number, us = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1]): string => {
    start(x, y);
    at(0);
    const a = pixels();
    at(1);
    const b = pixels();
    const out: string[] = [];
    for (const u of us) {
      at(u);
      const c = pixels();
      let n = 0;
      let cov = 0;
      for (let i = 0; i < a.length; i += 16) {
        const ai = a[i] ?? 0;
        const bi = b[i] ?? 0;
        if (Math.abs(ai - bi) < 60) continue;
        n++;
        cov += Math.min(1, Math.max(0, (ai - (c[i] ?? 0)) / (ai - bi)));
      }
      out.push(`${u}:${((cov / Math.max(n, 1)) * 100).toFixed(1)}`);
    }
    t.cancel();
    return out.join(' ');
  };

  /** Average draw cost (CPU submit + GPU, synchronised via a 1px readback). */
  const bench = (frames = 30): string => {
    const { gl } = t.renderer;
    const one = new Uint8Array(4);
    at(0.35);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one);
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      at(0.2 + (i / frames) * 0.5);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one);
    }
    return `${((performance.now() - t0) / frames).toFixed(2)}ms/frame @ ${t.renderer.canvas.width}×${t.renderer.canvas.height}`;
  };

  Object.assign(window, { __probe: { start, at, show, hide, pixels, curve, bench, cancel: () => t.cancel() } });
}
