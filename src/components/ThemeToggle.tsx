import type { MouseEvent } from 'react';

export type ThemeName = 'light' | 'dark';

export function ThemeToggle({ theme, onToggle }: { theme: ThemeName; onToggle: () => void }) {
  const next = theme === 'dark' ? 'light' : 'dark';

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    onToggle();
    // Drop focus after a mouse click so Space goes back to jumping instead of re-toggling.
    if (e.detail > 0) e.currentTarget.blur();
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleClick}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
        </svg>
      )}
    </button>
  );
}
