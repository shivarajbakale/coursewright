import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fontWait } from '@/lib/inkling';
import { parseChapter } from './markdown/parse';
import { Inkling } from './diagrams/Inkling';

fontWait.ms = 0;

const SOURCE = 'title "The loop"\nthink: circle "Think"\nact: circle "Act"\nthink -> act\nstep 1: think "The model thinks"\nstep 2: act "Then it acts"';

describe('explainers in the reader', () => {
  it('reads an ```inkling fence as an explainer block, other fences stay code', () => {
    const blocks = parseChapter(`# T\n\nBefore.\n\n\`\`\`inkling\n${SOURCE}\n\`\`\`\n\n\`\`\`python\nx = 1\n\`\`\`\n`);
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'inkling', 'code']);
    expect(blocks[1]).toEqual({ kind: 'inkling', source: SOURCE });
  });

  it('draws it inline with a step bar', async () => {
    render(<Inkling source={SOURCE} />);
    expect(await screen.findByRole('img', { name: 'The loop. The model thinks. Then it acts' })).toBeInTheDocument();
    expect(screen.getByText('2. Then it acts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Draw it again' })).toBeInTheDocument();
  });

  it('opens full screen and closes again', async () => {
    render(<Inkling source={SOURCE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open full screen' }));
    const close = await screen.findByRole('button', { name: 'Close full screen' });
    await waitFor(() => expect(screen.getAllByRole('img', { name: 'The loop. The model thinks. Then it acts' })).toHaveLength(2));
    expect(screen.getAllByRole('button', { name: 'Open full screen' })).toHaveLength(1);
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close full screen' })).toBeNull());
  });

  it('shows the text when the drawing has a mistake', async () => {
    render(<Inkling source={'title "Broken"\nlayout spiral'} />);
    expect(await screen.findByText('“Broken” has a mistake, so here is its text.')).toBeInTheDocument();
  });
});
