import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

const renderCalls: unknown[][] = [];
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (...args: unknown[]) => {
      renderCalls.push(args);
      return { svg: '<svg></svg>' };
    }),
  },
}));

import { MermaidDiagram } from '@/components/diagrams/MermaidDiagram';

describe('MermaidDiagram', () => {
  it('draws into its own scratch box, and draws nothing once it has unmounted', async () => {
    const view = render(
      <MantineProvider>
        <MermaidDiagram source={'flowchart LR\n  a --> b'} />
      </MantineProvider>
    );
    view.unmount(); // before the lazy import resolves: the page was left
    await new Promise((r) => setTimeout(r, 20));
    // Mermaid given no box lays the diagram out in <body>, which scrolls the whole document.
    expect(renderCalls).toEqual([]);

    render(
      <MantineProvider>
        <MermaidDiagram source={'flowchart LR\n  a --> b'} />
      </MantineProvider>
    );
    await vi.waitFor(() => expect(renderCalls.length).toBe(1));
    expect(renderCalls[0][2]).toBeInstanceOf(HTMLElement);
  });
});
