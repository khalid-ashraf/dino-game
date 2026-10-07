import { useLayoutEffect, useState } from 'react';
import { Game } from './components/Game';
import { ThemeToggle, type ThemeName } from './components/ThemeToggle';
import './App.css';

const THEME_KEY = 'dino-game:theme';

function initialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage unavailable; fall back to the system preference
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [theme, setTheme] = useState(initialTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage unavailable; choice just won't persist
    }
  };

  return (
    <main className="page">
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      <Game dark={theme === 'dark'} />
      <p>Press space to jump · ↓ to duck</p>
    </main>
  );
}
