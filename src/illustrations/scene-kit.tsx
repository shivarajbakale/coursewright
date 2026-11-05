import { useId, type ReactNode } from 'react';

import s from './scene.module.css';
import { cx } from './scene-utils';

/** The idea-shaped sparkle the mockup scatters around a scene. */
export function Sparkle({
  x,
  y,
  scale = 1,
  className,
}: {
  x: number;
  y: number;
  scale?: number;
  className?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        data-slot={className ? 'scene-progress' : undefined}
        className={className}
        d="M0 -12 L3.5 -3.5 L12 0 L3.5 3.5 L0 12 L-3.5 3.5 L-12 0 L-3.5 -3.5Z"
      />
    </g>
  );
}

interface FrameProps {
  label: string;
  children: ReactNode;
  /** Dot grid (default) or the square grid the projects scene uses. */
  grid?: 'dots' | 'lines';
  height?: number;
}

/**
 * The 800×420 canvas every scene draws on: scales to its container's width,
 * carries the accessible name and the background grid.
 */
export function SceneFrame({ label, children, grid = 'dots', height }: FrameProps) {
  const id = `sc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg
      viewBox="0 0 800 420"
      role="img"
      aria-label={label}
      className={cx(s.root, height !== undefined && s.fill)}
      preserveAspectRatio="xMidYMid meet"
      style={height !== undefined ? { height } : undefined}
    >
      <defs>
        <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
          {grid === 'dots' ? (
            <circle cx="2" cy="2" r="1.2" className={s.fDot} />
          ) : (
            <path d="M24 0H0V24" className={cx(s.fNone, s.sSurface)} strokeWidth="1" />
          )}
        </pattern>
      </defs>
      <rect width="800" height="420" fill={`url(#${id})`} />
      {children}
    </svg>
  );
}

