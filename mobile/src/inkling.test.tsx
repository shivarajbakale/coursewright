import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('shows the text when the drawing has a mistake', async () => {
    render(<Inkling source={'title "Broken"\nlayout spiral'} />);
    expect(await screen.findByText('“Broken” has a mistake, so here is its text.')).toBeInTheDocument();
  });
});
