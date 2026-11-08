import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import { CodeToolResult } from '@/copilot/CodeToolResult';
import { codeWorkingLabel } from '@/copilot/codeTools';

function show(node: React.ReactNode) {
  return render(<MantineProvider>{node}</MantineProvider>);
}

describe("The tutor's looks at a GitHub codebase", () => {
  it('says what it is doing while a call runs', () => {
    expect(codeWorkingLabel('read_repo_file', { repo: 'acme/demo', path: 'src/agent.ts' })).toBe('Reading src/agent.ts');
    expect(codeWorkingLabel('search_repo', { repo: 'acme/demo', query: 'finishTurn' })).toBe(
      'Searching acme/demo for “finishTurn”'
    );
  });

  it('links a read to the lines on GitHub', () => {
    const url = 'https://github.com/acme/demo/blob/trunk/src/agent.ts#L12-L14';
    show(
      <CodeToolResult
        tool="read_repo_file"
        result={{ repo: 'acme/demo', path: 'src/agent.ts', startLine: 12, endLine: 14, totalLines: 18, url }}
      />
    );
    expect(screen.getByRole('link', { name: 'Read src/agent.ts, lines 12–14 of 18' })).toHaveAttribute('href', url);
  });

  it('names where a definition is', () => {
    show(
      <CodeToolResult
        tool="find_definition"
        result={{ name: 'runLoop', definitions: [{ path: 'src/agent.ts', line: 12, url: 'https://github.com/x' }] }}
      />
    );
    expect(screen.getByRole('link', { name: 'runLoop is defined in src/agent.ts:12' })).toBeInTheDocument();
  });

  it('shows the error in plain words', () => {
    show(<CodeToolResult tool="repo_tree" result={{ error: 'GitHub’s rate limit is used up.' }} />);
    expect(screen.getByText('GitHub’s rate limit is used up.')).toBeInTheDocument();
  });
});
