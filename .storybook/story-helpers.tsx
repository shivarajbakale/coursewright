import { expect, fn, waitFor } from 'storybook/test';

/**
 * Storybook helpers — the standard knobs/actions/slots toolbox for every
 * atom story in this design system. Import from `'storybook/story-helpers'`
 * (the alias is set up by `viteFinal` in `main.ts`).
 *
 * Why this file exists:
 *   - `handlers()` wires every event prop to the Actions panel with one line,
 *     so the user can see exactly which handler fires when (no console.log).
 *   - The argType factories (`variantArg`, `boolArg`, `numberArg`, `rangeArg`,
 *     `textArg`, `hidden`) give the Controls panel rich inputs (select
 *     pickers, range sliders, description tooltips) instead of bare text.
 *   - `SlotShowcase` lays out compound-component subcomponents in a labeled
 *     grid so every Slot is visible without clicking.
 */

/* -------------------------------------------------------------------------- */
/*                              play-function helpers                         */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the control a play function is about to drive.
 *
 * Stories that mount inside `withMemoryRouter` are not in the DOM on the frame
 * `play` begins: `RouterProvider` renders nothing until it has resolved its
 * first match, which happens a tick later. A play that reaches straight for
 * `document.body.querySelector` is asserting on a frame nobody promised it —
 * Storybook 9 left enough of a gap for it to work by accident, Storybook 10
 * does not. Waiting is the assertion those plays always meant to make.
 */
export async function trigger(selector: string): Promise<HTMLElement> {
  let found: HTMLElement | null = null;
  await waitFor(() => {
    found = document.body.querySelector<HTMLElement>(selector);
    expect(found).toBeTruthy();
  });
  return found as unknown as HTMLElement;
}

/* -------------------------------------------------------------------------- */
/*                                argType factories                           */
/* -------------------------------------------------------------------------- */

/**
 * Use for CVA `variant` props. Produces a select control with the variant
 * options + a "Variants" table category so they group in the Controls panel.
 */
export function variantArg<K extends string>(
  _name: K,
  options: readonly string[],
  defaultValue?: string,
) {
  return {
    control: { type: 'select' as const },
    options: [...options],
    description: `Visual style. Picks one of ${options.length} variants.`,
    table: {
      category: 'Variants',
      defaultValue: defaultValue ? { summary: defaultValue } : undefined,
    },
  };
}

/** Boolean control. Defaults to `false` unless overridden. */
export function boolArg(
  _name: string,
  description: string,
  defaultValue = false,
) {
  return {
    control: 'boolean' as const,
    description,
    table: { defaultValue: { summary: String(defaultValue) } },
  };
}

/** Number control with optional min/max/step. Defaults to free input. */
export function numberArg(
  _name: string,
  opts: {
    min?: number;
    max?: number;
    step?: number;
    description?: string;
    defaultValue?: number;
  } = {},
) {
  return {
    control: { type: 'number' as const, min: opts.min, max: opts.max, step: opts.step },
    description: opts.description,
    table: {
      defaultValue:
        opts.defaultValue !== undefined ? { summary: String(opts.defaultValue) } : undefined,
    },
  };
}

/** Range control (slider + numeric input pair). */
export function rangeArg(
  _name: string,
  opts: {
    min: number;
    max: number;
    step?: number;
    description?: string;
    defaultValue?: number;
  },
) {
  return {
    control: { type: 'range' as const, min: opts.min, max: opts.max, step: opts.step },
    description: opts.description,
    table: {
      defaultValue:
        opts.defaultValue !== undefined ? { summary: String(opts.defaultValue) } : undefined,
    },
  };
}

/** Plain text control with a default. */
export function textArg(_name: string, defaultValue: string, description?: string) {
  return {
    control: 'text' as const,
    description,
    table: { defaultValue: { summary: defaultValue } },
  };
}

/** Hide a prop from the Controls panel entirely. */
export function hidden() {
  // Storybook 9 changed `control: false` to `control: { disable: true }` —
  // the legacy boolean form is now a type error against `InputType`.
  return { control: { disable: true }, table: { disable: true } };
}

/* -------------------------------------------------------------------------- */
/*                                  handlers                                  */
/* -------------------------------------------------------------------------- */

/**
 * Returns an `{ [event]: action(event) }` map you can spread into a story's
 * `args`. Every event handler prop gets logged to the Actions panel.
 *
 *   args: { children: 'Save', ...handlers(['onClick', 'onFocus']) }
 *
 * `fn()` from `storybook/test` installs a vitest spy that needs Storybook's
 * test runtime to be initialised. When the ui-probe composes stories at module-
 * load (before `setProjectAnnotations` runs), `fn()` can't install its spy and
 * throws "cannot spy on a non-function value". We catch that case and fall
 * back to a no-op so import-time `argTypes.onClick = handlers(['onClick']).onClick`
 * doesn't take the whole sweep down.
 */
export function handlers<T extends string>(
  names: readonly T[],
): Record<T, (...args: unknown[]) => void> {
  const out = {} as Record<T, (...args: unknown[]) => void>;
  for (const name of names) {
    try {
      out[name] = fn(name as never) as unknown as (...args: unknown[]) => void;
    } catch {
      // Outside Storybook's test runtime (e.g. ui-probe composing stories).
      // The Actions panel won't light up; the click handler is still callable.
      out[name] = (() => {}) as (...args: unknown[]) => void;
    }
  }
  return out;
}

/**
 * argTypes entries that make the Actions panel light up.
 *
 * `handlers()` returns spy *functions*, which belong in `args`. Putting a
 * function into `argTypes` (as several stories used to) is silently ignored
 * by Storybook — the panel stays empty and the prop loses its Controls row.
 * This is the argTypes-side counterpart: each name becomes a declared event
 * with an `action`, grouped under an "Events" table category.
 *
 *   argTypes: { ...eventArgTypes(['onCheckedChange']) }
 */
export function eventArgTypes<T extends string>(
  names: readonly T[],
): Record<T, { action: T; description: string; table: { category: string } }> {
  const out = {} as Record<T, { action: T; description: string; table: { category: string } }>;
  for (const name of names) {
    out[name] = {
      action: name,
      description: `Fires on ${name.replace(/^on/, '').replace(/([A-Z])/g, ' $1').trim().toLowerCase()}.`,
      table: { category: 'Events' },
    };
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*                              fixture data                                   */
/* -------------------------------------------------------------------------- */

/**
 * Canonical users for shell stories. The full demo user is what every
 * authenticated story should pass to NavUser / expect to see in AppSidebar.
 * The guest is what the unauthenticated branch of AppSidebar renders.
 * The no-avatar is what happens when session.user.image is null.
 */
export const fixtureUsers = {
  demo: {
    name: 'Demo User',
    email: 'demo@rocketship.dev',
    avatar: 'https://avatars.githubusercontent.com/u/9919?s=200',
  },
  guest: { name: 'Guest', email: '', avatar: '' },
  noAvatar: {
    name: 'Demo User',
    email: 'demo@rocketship.dev',
    avatar: '',
  },
} as const;
