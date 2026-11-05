import {
  MantineProvider,
  localStorageColorSchemeManager,
  useMantineColorScheme,
  type MantineColorScheme,
} from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { MotionConfig } from 'motion/react';

import { transitions } from '@/lib/motion';

import { cssVariablesResolver, theme as mantineTheme } from '@/theme';

/**
 * Colour-scheme ownership.
 *
 * Mantine is the source of truth: it stores the choice, sets
 * `data-mantine-color-scheme` on `<html>`, and every Mantine component reads
 * its palette from there. Nothing mirrors that onto a `dark` / `light` class
 * any more — the mirror existed for Tailwind's colour utilities, which are
 * gone, and a second source of truth nobody reads is a thing to keep in step
 * for no benefit.
 *
 * What this file adds beyond mounting the provider is one adapter: the old
 * `useTheme()` shape — `{ theme, setTheme }` over `'dark' | 'light' | 'system'`
 * — so callers did not all have to change on the same day. `'system'` is
 * Mantine's `'auto'`; nothing else differs.
 */

type Theme = 'dark' | 'light' | 'system';

const toMantine = (t: Theme): MantineColorScheme => (t === 'system' ? 'auto' : t);
const fromMantine = (s: MantineColorScheme): Theme => (s === 'auto' ? 'system' : s);

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'ui-color-scheme',
}: ThemeProviderProps) {
  return (
    <MantineProvider
      theme={mantineTheme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme={toMantine(defaultTheme)}
      colorSchemeManager={localStorageColorSchemeManager({ key: storageKey })}
    >
      {/* Two managers, both mounted once and driven imperatively from anywhere:
          `modals.openConfirmModal` (what ui-lint's native-dialog rule points at,
          so the advice has to be followable the moment it is read) and the
          notifications queue behind `@/lib/notify`. */}
      <Notifications position="top-center" />
      {/* Motion's defaults, set once beside Mantine's.

          `reducedMotion="user"` is Framer's own guard and the floor, not the
          whole answer: it suppresses transform and layout animation and still
          allows a fade. The app's components go further and collapse to a zero
          duration (`useMotionEnabled` in `@/lib/motion`), so this line covers
          the case a component forgets to — which is exactly the case a default
          is for.

          The `transition` here is the default for any `motion` element that
          does not name one. Naming it here rather than in each component is
          what makes the motion scale retunable in one place, the same argument
          as `theme.shadows` a few lines up. */}
      <MotionConfig reducedMotion="user" transition={transitions.base}>
        <ModalsProvider>{children}</ModalsProvider>
      </MotionConfig>
    </MantineProvider>
  );
}

export const useTheme = () => {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return {
    theme: fromMantine(colorScheme),
    setTheme: (next: Theme) => setColorScheme(toMantine(next)),
  };
};
