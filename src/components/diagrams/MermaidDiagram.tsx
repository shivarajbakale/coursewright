import { useEffect, useId, useRef, useState } from 'react';
import { Alert, Box, Code, Skeleton, useComputedColorScheme } from '@mantine/core';

/**
 * Renders Mermaid source to SVG on the client (mermaid is loaded lazily, it is
 * large). `securityLevel: 'strict'` keeps generated diagrams from running
 * scripts or links.
 */
export function MermaidDiagram({ source }: { source: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const scheme = useComputedColorScheme('dark');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mermaid lays the diagram out in a scratch element before handing back the
  // SVG. By default that element is appended to <body>, where it makes the whole
  // document scroll for as long as the render takes — the shell is a fixed
  // viewport. Give it a box of ours, clipped, instead.
  const scratch = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        // Mermaid is loaded lazily; if the diagram unmounted meanwhile there is no scratch box, and Mermaid
        // would fall back to laying the diagram out in <body>, scrolling the whole document. Draw nothing.
        if (cancelled || !scratch.current) return;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: scheme === 'dark' ? 'dark' : 'neutral' });
        const out = await mermaid.render(`m${id}`, source, scratch.current);
        if (!cancelled) setSvg(out.svg);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id, source, scheme]);

  // A generated diagram can have a syntax slip; show its text instead of a parser dump.
  if (error)
    return (
      <Alert color="yellow" variant="light" title="This diagram has a syntax error, so here is its text">
        <Code block mah={240} style={{ overflow: 'auto' }}>
          {source}
        </Code>
      </Alert>
    );
  return (
    <Box pos="relative" style={{ overflow: 'hidden' }}>
      <Box ref={scratch} pos="absolute" w="100%" h={0} style={{ overflow: 'hidden', visibility: 'hidden' }} aria-hidden />
      {svg ? (
        <Box ta="center" style={{ overflowX: 'hidden' }} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <Skeleton h={200} radius="md" />
      )}
    </Box>
  );
}
