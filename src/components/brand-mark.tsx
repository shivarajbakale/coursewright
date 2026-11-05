import { Box } from '@mantine/core';

import classes from './brand-mark.module.css';

/**
 * The Coursewright mark: a C whose mouth holds ruled lines, the longest one
 * (in the accent) the line being written. Drawn in the text colour, so it
 * follows the theme; the accent is lime in dark and olive in light, where
 * lime is too faint. Masters live in public/brand/.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 256 256"
      w={size}
      h={size}
      aria-hidden
      className={classes.mark}
    >
      {/* prettier-ignore */}
      <g transform="translate(8 0)"><path d="M195.65 187.10 A96.0 96.0 0 1 1 195.65 68.90 L170.43 88.60 A64.0 64.0 0 1 0 170.43 167.40 Z" fill="currentColor"/><rect x="104" y="93" width="72" height="18" rx="9" fill="currentColor"/><rect x="104" y="119" width="112" height="18" rx="9" fill="var(--cw-mark-accent)"/><rect x="104" y="145" width="72" height="18" rx="9" fill="currentColor"/></g>
    </Box>
  );
}
