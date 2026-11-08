import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { BlockEditor } from '@shivarajbakale/blocks';
import { InklingDiagram } from '@/components/diagrams/InklingDiagram';
import { FLOW_KIND, coursewrightExtensions, coursewrightWidgets } from '@/features/blocks/extensions';
import { fontWait } from '@/lib/inkling';

fontWait.ms = 0;

const SOURCE = 'title "The loop"\nthink: circle "Think"\nact: circle "Act"\nthink -> act\nstep 1: think "The model thinks"\nstep 2: act "Then it acts"';

describe('Inkling explainers on the desktop', () => {
  it('reads an ```inkling fence in a chapter as a diagram block and writes it back unchanged', () => {
    const md = `Before.\n\n\`\`\`inkling\n${SOURCE}\n\`\`\`\n\nAfter.`;
    const editor = new BlockEditor({ initial: md, extensions: coursewrightExtensions(), widgets: coursewrightWidgets() });
    const blocks = editor.getBlocks();
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'widget', 'paragraph']);
    expect(blocks[1].props).toEqual({ kind: FLOW_KIND, props: { kind: 'inkling', source: SOURCE } });
    expect(editor.toMarkdown().trim()).toBe(md);
    editor.destroy();
  });

  it('draws inline with the step caption and controls', async () => {
    render(
      <MantineProvider>
        <InklingDiagram source={SOURCE} />
      </MantineProvider>,
    );
    expect(await screen.findByRole('img', { name: 'The loop. The model thinks. Then it acts' })).toBeInTheDocument();
    expect(screen.getByText('2. Then it acts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous step' })).toBeEnabled();
  });

  it('opens large, steps with the arrow keys and closes', async () => {
    render(
      <MantineProvider>
        <InklingDiagram source={SOURCE} />
      </MantineProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Open large' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('img', { name: 'The loop. The model thinks. Then it acts' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Open large' })).toBeNull();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(await within(dialog).findByText('1. The model thinks')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fill the screen' }));
    expect(within(dialog).getByRole('button', { name: 'Back to a window' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await screen.findAllByRole('button', { name: 'Open large' });
  });

  it('shows the source when the drawing has a mistake', async () => {
    render(
      <MantineProvider>
        <InklingDiagram source={'title "Broken"\nlayout spiral'} />
      </MantineProvider>,
    );
    expect(await screen.findByText('Broken has a mistake, so here is its text')).toBeInTheDocument();
  });
});
