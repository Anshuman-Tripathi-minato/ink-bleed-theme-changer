import type { Theme } from '../ui/theme';

/** Live-tunable look of the ink. Mutated by the demo panel (phase 5). */
export interface InkParams {
  /** Seconds for the spread (before the 150ms fade). */
  duration: number;
  /** Tendril reach multiplier, 0 = clean blob. */
  tendril: number;
  /** Noise frequency multiplier: lower = bigger, lazier shapes. */
  noiseScale: number;
  /** Frontier half-width in CSS px. */
  softness: number;
  /** Speed at which the shape evolves during the spread. */
  drift: number;
  /** Global playback rate (0.25 for slow motion). */
  timeScale: number;
}

export const inkParams: InkParams = {
  duration: 1.4,
  tendril: 1,
  noiseScale: 1,
  softness: 1.4,
  drift: 1,
  timeScale: 1,
};

/** Pigment colour pooled at the frontier, keyed by the theme being revealed. */
export const RIM_COLOR: Record<Theme, [number, number, number]> = {
  dark: [0.0, 0.0, 0.01], // ink: a touch denser than the #0b0b0f page
  light: [1.0, 0.996, 0.985], // bleach: a touch brighter than #f6f4ef
};
