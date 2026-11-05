import { Box } from '@mantine/core';
import { BlockEditorView, useBlockEditor } from '@shivarajbakale/blocks';
import { readOnlyEditorOptions } from '@/features/blocks';
import classes from './readonly-blocks.module.css';

/**
 * Read-only markdown through kit's block editor, so generated text renders
 * exactly like chapters and notes. Key it by content identity when the
 * markdown can change: the editor reads `markdown` once.
 */
export function MarkdownView({ markdown, label }: { markdown: string; label?: string }) {
  const editor = useBlockEditor({ initial: markdown, label, ...readOnlyEditorOptions() });
  return (
    <Box data-markdown-view className={classes.readonly}>
      <BlockEditorView editor={editor} menus={false} />
    </Box>
  );
}
