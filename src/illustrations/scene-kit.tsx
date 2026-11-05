import type { ReactNode } from 'react';

import s from './scene.module.css';
import { cx } from './scene-utils';

interface FrameProps {
  label: string;
  children: ReactNode;
  height?: number;
}

/**
 * The 800×420 canvas every scene draws on: scales to its container's width
 * and carries the accessible name. Every stroke in a scene is 1.5 units,
 * round-capped, set once here.
 */
export function SceneFrame({ label, children, height }: FrameProps) {
  return (
    <svg
      viewBox="0 0 800 420"
      role="img"
      aria-label={label}
      className={cx(s.root, height !== undefined && s.fill)}
      preserveAspectRatio="xMidYMid meet"
      style={height !== undefined ? { height } : undefined}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** A sheet or index card: radius 8, hairline edge. */
export function Sheet({
  x,
  y,
  w,
  h,
  tone = 'front',
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: 'front' | 'back' | 'now';
}) {
  const paint = tone === 'back' ? s.paperBack : tone === 'now' ? s.paperNow : s.paper;
  return <rect x={x} y={y} width={w} height={h} rx="8" className={paint} />;
}

/** One ruled line of placeholder text. `progress` marks the line being written. */
export function Rule({
  x,
  y,
  w,
  className,
  progress,
}: {
  x: number;
  y: number;
  w: number;
  className?: string;
  progress?: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height="4"
      rx="2"
      data-slot={progress ? 'scene-progress' : undefined}
      className={className ?? s.rule}
    />
  );
}

/** A 16-unit check mark, top-left at (x, y). */
export function Check({ x, y, className }: { x: number; y: number; className?: string }) {
  return (
    <path
      d={`M${x + 13} ${y + 4} L${x + 6} ${y + 11} L${x + 3} ${y + 8}`}
      className={className ?? s.ink}
    />
  );
}

/**
 * The scene's one line of status, bottom left: what is happening in words,
 * then the figure (a count, a fraction) in mono.
 */
export function Caption({ label, figure }: { label: string; figure?: string }) {
  return (
    <text x="40" y="396" fontSize="14" className={s.dim}>
      {label}
      {figure && (
        <tspan dx="12" className={s.mono}>
          {figure}
        </tspan>
      )}
    </text>
  );
}
