'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('posflow-theme');
    if (stored) {
      const darkActive = stored === 'dark';
      setIsDark(darkActive);
      document.documentElement.classList.toggle('dark', darkActive);
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = !isDark;
    setIsDark(nextTheme);
    if (nextTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('posflow-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('posflow-theme', 'light');
    }
  };

  if (!mounted) {
    return (
      <div
        style={{
          width: '2rem',
          height: '2rem',
          borderRadius: '9999px',
          border: '1px solid var(--border-color)',
          background: 'var(--surface)',
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme"
      style={{
        width: '2.1rem',
        height: '2.1rem',
        borderRadius: '9999px',
        border: '1px solid var(--border-color)',
        background: 'var(--surface)',
        color: 'var(--text)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      className={className}
    >
      {isDark ? (
        <Sun size={16} style={{ color: '#f59e0b' }} />
      ) : (
        <Moon size={16} style={{ color: '#64748b' }} />
      )}
    </button>
  );
}
