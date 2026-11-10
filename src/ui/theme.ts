export type Theme = 'light' | 'dark';

const root = document.documentElement;

export function getTheme(): Theme {
  return root.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

/** Instantly applies a theme to the live DOM and keeps the toggle's ARIA state in sync. */
export function applyTheme(theme: Theme, toggle?: HTMLButtonElement | null): void {
  root.dataset.theme = theme;
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
  }
}
