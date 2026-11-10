import gsap from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import type { Theme } from './theme';

gsap.registerPlugin(MorphSVGPlugin);

const SUN = 'M12 7a5 5 0 1 1 0 10a5 5 0 1 1 0-10z';
const MOON = 'M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a7.2 7.2 0 0 0 9.7 9.7z';

interface IconPose {
  body: string;
  rays: { scale: number; opacity: number; rotation: number };
  icon: number; // whole-icon rotation, degrees
}

const POSE: Record<Theme, IconPose> = {
  light: { body: SUN, rays: { scale: 1, opacity: 1, rotation: 0 }, icon: 0 },
  dark: { body: MOON, rays: { scale: 0.2, opacity: 0, rotation: -60 }, icon: -25 },
};

export interface MorphOptions {
  duration: number;
  ease: string;
  timeScale: number;
  /** Seconds after which the button chrome (bg / border / colour) switches theme. */
  chromeDelay?: number;
  /** Starting chrome colours (computed before the DOM theme flipped). */
  chromeFrom?: ChromeColors;
}

export interface ChromeColors {
  backgroundColor: string;
  borderColor: string;
  color: string;
}

/**
 * The toggle's sun ↔ moon icon. It lives above the ink overlay (it is hidden in the
 * snapshots), so it animates on its own, in lock-step with the ink: same duration, ease
 * and time scale. Its chrome colours are held at the old theme until the ink reaches it.
 */
export class ThemeIcon {
  private readonly button: HTMLElement;
  private readonly icon: SVGSVGElement | null;
  private readonly body: SVGPathElement | null;
  private readonly rays: SVGLineElement[];
  private timeline: gsap.core.Timeline | null = null;

  constructor(button: HTMLElement) {
    this.button = button;
    this.icon = button.querySelector('svg');
    this.body = button.querySelector('.theme-toggle__body');
    this.rays = Array.from(button.querySelectorAll<SVGLineElement>('.theme-toggle__rays line'));
  }

  kill(): void {
    this.timeline?.kill();
    this.timeline = null;
  }

  setTimeScale(scale: number): void {
    this.timeline?.timeScale(scale);
  }

  /** Current chrome colours as rendered (call before flipping the theme). */
  readChrome(): ChromeColors {
    const cs = getComputedStyle(this.button);
    return { backgroundColor: cs.backgroundColor, borderColor: cs.borderTopColor, color: cs.color };
  }

  /** Jump to a theme's pose without animating. */
  set(theme: Theme): void {
    this.timeline?.kill();
    this.timeline = null;
    const pose = POSE[theme];
    if (this.body) gsap.set(this.body, { morphSVG: pose.body });
    gsap.set(this.rays, { ...pose.rays, svgOrigin: '12 12' });
    if (this.icon) gsap.set(this.icon, { rotation: pose.icon, transformOrigin: '50% 50%' });
    gsap.set(this.button, { clearProps: 'backgroundColor,borderColor,color' });
  }

  /** Animate to a theme's pose, starting from wherever the icon currently is. */
  morphTo(theme: Theme, opts: MorphOptions): void {
    this.timeline?.kill();
    const pose = POSE[theme];
    const tl = gsap.timeline({ defaults: { duration: opts.duration, ease: opts.ease } });

    if (this.body) tl.to(this.body, { morphSVG: { shape: pose.body, shapeIndex: 'auto' } }, 0);
    // Rays retract / bloom one after another, like the ink sweeping round.
    tl.to(this.rays, { ...pose.rays, svgOrigin: '12 12', stagger: opts.duration * 0.035 }, 0);
    if (this.icon) tl.to(this.icon, { rotation: pose.icon, transformOrigin: '50% 50%' }, 0);

    if (opts.chromeFrom) {
      // Hold the old colours (the live DOM already has the new theme), then hand over to
      // the stylesheet as the ink arrives.
      // Plain style write (not gsap.set) so the hold lands in this very frame.
      Object.assign(this.button.style, opts.chromeFrom);
      const delay = opts.chromeDelay ?? 0;
      const swap = Math.min(0.18, opts.duration * 0.15);
      tl.to(
        this.button,
        {
          backgroundColor: () => this.targetChrome().backgroundColor,
          borderColor: () => this.targetChrome().borderColor,
          color: () => this.targetChrome().color,
          duration: swap,
          ease: 'power1.out',
          onComplete: () => {
            gsap.set(this.button, { clearProps: 'backgroundColor,borderColor,color' });
          },
        },
        delay,
      );
    } else {
      gsap.set(this.button, { clearProps: 'backgroundColor,borderColor,color' });
    }

    tl.timeScale(opts.timeScale);
    this.timeline = tl;
  }

  /** Stylesheet colours for the current (already flipped) theme. */
  private targetChrome(): ChromeColors {
    const saved = this.button.getAttribute('style') ?? '';
    this.button.style.removeProperty('background-color');
    this.button.style.removeProperty('border-color');
    this.button.style.removeProperty('color');
    const target = this.readChrome();
    this.button.setAttribute('style', saved);
    return target;
  }
}
