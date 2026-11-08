/**
 * One line in the tutor chat for each look at a GitHub codebase (agent/app/codebase.py): what the tutor
 * listed, outlined, read, searched or looked up, with a link to the lines on GitHub.
 */
import { Anchor, Group, Text } from '@mantine/core';
import { Crosshair, FileCode, FolderTree, ListTree, Search, TriangleAlert } from 'lucide-react';
import { codeSummary, type CodeResult, type CodeTool } from './codeTools';

const ICONS = {
  repo_tree: FolderTree,
  file_outline: ListTree,
  read_repo_file: FileCode,
  search_repo: Search,
  find_definition: Crosshair,
} as const;

export function CodeToolResult({ tool, result }: { tool: CodeTool; result: CodeResult | null }) {
  if (!result || result.error)
    return (
      <Group gap={6} py={2} wrap="nowrap">
        <TriangleAlert size={12} />
        <Text size="xs" c="red">
          {result?.error ?? 'The codebase could not be read.'}
        </Text>
      </Group>
    );
  const Icon = ICONS[tool];
  const url = result.url ?? result.definitions?.[0]?.url;
  return (
    <Group gap={6} py={2} wrap="nowrap" style={{ minWidth: 0 }}>
      <Icon size={12} style={{ flexShrink: 0 }} />
      {url ? (
        <Anchor href={url} target="_blank" rel="noreferrer" size="xs" truncate>
          {codeSummary(tool, result)}
        </Anchor>
      ) : (
        <Text size="xs" c="dimmed" truncate>
          {codeSummary(tool, result)}
        </Text>
      )}
    </Group>
  );
}
