import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { DiagramCard } from '@/copilot/DiagramCard';
import { fontWait } from '@/lib/inkling';
import { renderRoutes } from './render';

fontWait.ms = 0;
const WAIT = { timeout: 5000 };

// A layout added in Inkling 1.0: the chat must draw every layout the tutor's make_drawing can return.
const VENN = [
  'title "Where good products come from"',
  'layout venn',
  'set design "Design"',
  'set code "Code"',
  '- Sketches in design',
  '- Tests in code',
  '- Prototypes in design & code',
  'steps auto',
].join('\n');

describe("The tutor's drawings in the chat", () => {
  it('draws an Inkling result with its title and a save button', async () => {
    renderRoutes(() => <DiagramCard diagram={{ kind: 'inkling', title: 'Where good products come from', source: VENN }} />, {
      paths: ['/'],
      initialEntries: ['/'],
    });
    expect(await screen.findByText('Where good products come from', {}, WAIT)).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /^Where good products come from/ }, WAIT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save to notes' })).toBeInTheDocument();
  });

  it('says so when the drawing could not be made', async () => {
    renderRoutes(() => <DiagramCard diagram={{ kind: 'none', title: 'x', source: '' }} />, {
      paths: ['/'],
      initialEntries: ['/'],
    });
    expect(await screen.findByText("The diagram couldn't be made.", {}, WAIT)).toBeInTheDocument();
  });
});
