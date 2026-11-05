import { ActionIcon } from '@mantine/core';
import { Moon, Sun } from 'lucide-react';

import { useTheme } from '@/components/theme-provider';

/** Flips between light and dark. The design system is dark-first. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="lg"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </ActionIcon>
  );
}
