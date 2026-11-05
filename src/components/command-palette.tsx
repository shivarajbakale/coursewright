import { useEffect, useState } from 'react';
import { Group, Kbd, Text } from '@mantine/core';
import {
  Spotlight,
  createSpotlight,
  useSpotlight,
  type SpotlightActionData,
  type SpotlightActionGroupData,
} from '@mantine/spotlight';
import { useNavigate } from '@tanstack/react-router';
import { useHotkey } from '@tanstack/react-hotkeys';
import { Plus, Search } from 'lucide-react';

import { navItems } from '@/config/nav';

/**
 * ⌘K command palette — keyboard-first navigation, Linear-style.
 *
 * Built on `@mantine/spotlight`. Spotlight owns the query state, arrow-key
 * traversal and Enter-to-trigger. The ⌘K binding is **not** Spotlight's
 * `shortcut` prop any more: it is a `useHotkey` registration, so that every
 * shortcut in the app lives in one manager that can be inspected, and so that
 * a second binding on the same chord is reported rather than silently shadowed.
 * The window event stays: the topbar's search button dispatches it, and so can
 * anything else that wants to open the palette without importing it.
 *
 * ## Why the compound API, and why the hand-written ARIA
 *
 * Two things the shorthand `<Spotlight actions={…} />` cannot do.
 *
 * The first is a footer, and the keyboard hints along the bottom are what tell
 * a first-time user this is a keyboard surface at all.
 *
 * The second is the important one. **Spotlight ships no ARIA roles** — no
 * `combobox`, no `listbox`, no `option`, no `aria-selected`, no
 * `aria-activedescendant`. Visually it is a command palette; to a screen reader
 * it is a text field beside a pile of buttons, and pressing the arrow keys
 * announces nothing. cmdk, which this replaced, provided the whole combobox
 * pattern. Losing it would have been a real regression dressed up as a
 * dependency swap, and `src/test/command-palette.test.tsx` asserts the pattern
 * precisely so that it cannot be lost quietly.
 *
 * So the pattern is supplied here. That means owning the filtering, because
 * `aria-selected` has to agree with Spotlight's `selected` index — which counts
 * the actions actually rendered. Spotlight's own filter is internal (the package
 * does not re-export it), so `filterActions` below is a copy of its behaviour:
 * label matches first, then description and keyword matches, regrouped in place.
 * Render order is registration order, and the index lines up.
 *
 * Extend `quickActions` to add commands; navigation is derived from `navItems`.
 */
export const COMMAND_PALETTE_EVENT = 'command-palette:open';

export function openCommandPalette() {
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
}

/** Keywords arrive as a string or a list; Spotlight matches against one string. */
function keywordText(keywords: SpotlightActionData['keywords']): string {
  if (Array.isArray(keywords)) return keywords.join(',').toLowerCase().trim();
  if (typeof keywords === 'string') return keywords.toLowerCase().trim();
  return '';
}

/**
 * Spotlight's default filter, reimplemented: label matches rank above
 * description/keyword matches, and the surviving actions are put back into
 * their groups in that order.
 */
function filterActions(
  rawQuery: string,
  groups: SpotlightActionGroupData[],
): SpotlightActionGroupData[] {
  const query = rawQuery.trim().toLowerCase();
  const byLabel: Array<SpotlightActionData & { group: string }> = [];
  const byKeyword: Array<SpotlightActionData & { group: string }> = [];

  groups.forEach((group) => {
    group.actions.forEach((action) => {
      const entry = { ...action, group: group.group };
      if (action.label?.toLowerCase().includes(query)) byLabel.push(entry);
      else if (
        action.description?.toLowerCase().includes(query) ||
        keywordText(action.keywords).includes(query)
      )
        byKeyword.push(entry);
    });
  });

  const result: SpotlightActionGroupData[] = [];
  const seen = new Map<string, SpotlightActionGroupData>();

  [...byLabel, ...byKeyword].forEach(({ group, ...action }) => {
    let bucket = seen.get(group);
    if (!bucket) {
      bucket = { group, actions: [] };
      seen.set(group, bucket);
      result.push(bucket);
    }
    bucket.actions.push(action);
  });

  return result;
}

const quickActions = [
  { title: 'New project', to: '/projects', icon: Plus, keywords: ['new', 'add', 'create'] },
];

/** DOM id for one action, so `aria-activedescendant` has something to point at. */
const optionId = (id: string) => `command-palette-option-${id}`;

export function CommandPalette() {
  const navigate = useNavigate();
  // One store per mounted palette, not the package-level singleton. The store
  // holds `opened`, `query` and `selected`, so a shared one would outlive the
  // component: unmount and remount (a test, a route swap) and the new palette
  // would inherit the old one's query and open state. Owning it also keeps the
  // ARIA state read here and the state Spotlight acts on the same object.
  const [[spotlightStore, spotlightHandlers]] = useState(createSpotlight);
  const { query, opened, listId } = useSpotlight(spotlightStore);
  const [active, setActive] = useState(0);

  /**
   * Spotlight moves its cursor with `store.updateState`, which writes the new
   * index **without notifying subscribers** — its own highlight is a
   * `data-selected` attribute set imperatively on the DOM node, so it never
   * needs a re-render. React state has to be told separately, or `aria-selected`
   * would stay on row 0 while the visible highlight walked down the list.
   *
   * So this reads the index back one microtask later, after Spotlight's own
   * handler has run: for arrow keys it has moved the cursor by then, and for a
   * new query its `selectAction(0)` microtask was queued first and so has
   * already reset it. One mirror, always downstream of the real move.
   */
  const syncSelection = () =>
    queueMicrotask(() => setActive(spotlightStore.getState().selected));

  useEffect(() => {
    const onOpen = () => spotlightHandlers.open();
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen);
    return () => window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen);
  }, [spotlightHandlers]);

  // ⌘K on a Mac, Ctrl+K everywhere else. `Mod` resolves per platform, and the
  // toggle is deliberate: the palette is the only surface the chord belongs to,
  // so pressing it again should close it rather than do nothing.
  useHotkey('Mod+K', () => spotlightHandlers.toggle(), {
    // Deliberate, and a change from Spotlight's own `shortcut`, which ignored
    // input, textarea and select. A palette you cannot reach from the search
    // box you are already typing in is a palette you reach for the mouse to
    // open — so this one answers everywhere.
    ignoreInputs: false,
    meta: { name: 'Command palette', description: 'Search or jump to anything' },
  });

  const go = (to: string) => navigate({ to });

  const groups: SpotlightActionGroupData[] = [
    {
      group: 'Actions',
      actions: quickActions.map((item) => ({
        id: `action-${item.to}`,
        label: item.title,
        keywords: item.keywords,
        leftSection: <item.icon size={16} />,
        onClick: () => go(item.to),
      })),
    },
    {
      group: 'Navigation',
      actions: navItems.map((item) => ({
        id: `nav-${item.to}`,
        label: item.title,
        keywords: item.keywords?.split(' '),
        leftSection: <item.icon size={16} />,
        onClick: () => go(item.to),
      })),
    },
  ];

  const filtered = filterActions(query, groups);

  // Flat order across groups — the order Spotlight registers actions in, and so
  // the order its `selected` index counts.
  const flat: SpotlightActionData[] = filtered.flatMap((group) => group.actions);
  const selected = Math.min(active, flat.length - 1);
  const activeId = flat[selected] ? optionId(flat[selected].id) : undefined;

  // Spotlight opens with `selected: -1` — nothing highlighted until the first
  // keystroke. A command palette should open with its first row live so Enter
  // works immediately, so this puts the cursor on row 0, in the store as well
  // as in React: the store's index is what the next arrow key counts from.
  useEffect(() => {
    if (opened && spotlightStore.getState().selected === -1 && flat.length > 0) {
      spotlightStore.setState({ ...spotlightStore.getState(), selected: 0 });
      setActive(0);
    }
  }, [opened, flat.length, spotlightStore]);

  let index = -1;

  return (
    <Spotlight.Root
      store={spotlightStore}
      shortcut={null}
      scrollable
      maxHeight="min(60vh, 22rem)"
    >
      <Spotlight.Search
        placeholder="Search or jump to…"
        data-autofocus
        onKeyDown={syncSelection}
        onChange={syncSelection}
        leftSection={<Search size={16} />}
        role="combobox"
        aria-expanded={opened}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
      />
      <Spotlight.ActionsList role="listbox" aria-label="Commands">
        {filtered.map((group) => (
          <Spotlight.ActionsGroup key={group.group} label={group.group}>
            {group.actions.map((action) => {
              index += 1;
              const isSelected = index === selected;
              return (
                <Spotlight.Action
                  key={action.id}
                  id={optionId(action.id)}
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected || undefined}
                  label={action.label}
                  keywords={action.keywords}
                  leftSection={action.leftSection}
                  onClick={action.onClick}
                />
              );
            })}
          </Spotlight.ActionsGroup>
        ))}
        <Spotlight.Empty>No results found.</Spotlight.Empty>
      </Spotlight.ActionsList>
      <Spotlight.Footer>
        <Group justify="flex-end" gap="md">
          <PaletteHint keys={['↑', '↓']}>navigate</PaletteHint>
          <PaletteHint keys={['↵']}>select</PaletteHint>
          <PaletteHint keys={['esc']}>close</PaletteHint>
        </Group>
      </Spotlight.Footer>
    </Spotlight.Root>
  );
}

function PaletteHint({ keys, children }: { keys: string[]; children: React.ReactNode }) {
  return (
    <Group gap={4} wrap="nowrap">
      {keys.map((k) => (
        <Kbd key={k} size="xs">
          {k}
        </Kbd>
      ))}
      <Text size="xs" c="dimmed">
        {children}
      </Text>
    </Group>
  );
}
