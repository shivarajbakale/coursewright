import type { ReactNode } from 'react';
import { Box } from '@mantine/core';

import s from './spot.module.css';
import { cx } from './scene-utils';

/**
 * Spot illustrations for empty and error states: one small drawing per
 * situation, in the build scenes' line art. Each is decorative (the state's
 * title says what happened), so it is hidden from assistive technology.
 *
 * Empty states mark the next step in lime; error states mark the break in red.
 */
export type SpotKind =
  | 'courses' // no courses yet
  | 'notebook' // no notes yet
  | 'index' // nothing indexed
  | 'search' // a search matched nothing
  | 'inbox' // nothing new
  | 'tutor' // a conversation not started
  | 'offline' // the service did not answer
  | 'missing' // the thing does not exist
  | 'broken'; // the service answered with an error

const ALERT: SpotKind[] = ['offline', 'broken'];

function Frame({ kind, children }: { kind: SpotKind; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 128"
      aria-hidden="true"
      focusable="false"
      data-spot={kind}
      className={cx(s.root, ALERT.includes(kind) && s.alert)}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* A hairline floor, so every drawing sits on the same ground. */}
      <path d="M36 116h128" className={s.floor} />
      {children}
    </svg>
  );
}

function Rules({ x, y, widths, gap = 9 }: { x: number; y: number; widths: number[]; gap?: number }) {
  return (
    <>
      {widths.map((w, i) => (
        <rect key={i} x={x} y={y + i * gap} width={w} height="3" rx="1.5" className={s.rule} />
      ))}
    </>
  );
}

/** A small round badge with a mark in it: the one accented thing. */
function Badge({ cx: x, cy: y, children }: { cx: number; cy: number; children: ReactNode }) {
  return (
    <g className={s.beat}>
      <circle cx={x} cy={y} r="11" className={s.accentFill} />
      <g className={s.accent}>{children}</g>
    </g>
  );
}

const DRAWINGS: Record<SpotKind, ReactNode> = {
  // Two finished sheets behind a dashed one still to be written, and a plus.
  courses: (
    <>
      <rect x="62" y="30" width="70" height="80" rx="8" className={s.paperBack} transform="rotate(-8 97 70)" />
      <rect x="70" y="26" width="70" height="80" rx="8" className={s.paperBack} transform="rotate(5 105 66)" />
      <rect x="66" y="24" width="70" height="86" rx="8" className={s.paper} />
      <rect x="74" y="34" width="54" height="66" rx="5" className={s.ghost} />
      <Badge cx={136} cy={26}>
        <path d="M136 21v10M131 26h10" />
      </Badge>
    </>
  ),
  // An open notebook: one page started, one blank, a pencil ready.
  notebook: (
    <>
      <path d="M100 28c-14-6-34-6-48-2v84c14-4 34-4 48 2" className={s.paper} />
      <path d="M100 28c14-6 34-6 48-2v84c-14-4-34-4-48 2z" className={s.paper} />
      <path d="M100 28v84" className={s.ink} />
      <Rules x={60} y={42} widths={[30, 34, 22]} />
      <g className={s.beat}>
        <path d="M112 94l30-30 6 6-30 30-8 2z" className={s.accentFill} />
        <path d="M137 69l6 6" className={s.accent} />
      </g>
    </>
  ),
  // A card drawer with empty dividers, nothing filed yet.
  index: (
    <>
      <path d="M64 50h72v14H64z" className={s.paperBack} />
      <path d="M70 40h24v10H70z" className={s.paperBack} />
      <path d="M108 44h22v6h-22z" className={s.paperBack} />
      <rect x="50" y="62" width="100" height="50" rx="6" className={s.paper} />
      <rect x="88" y="78" width="24" height="10" rx="3" className={s.accentFill} />
      <path d="M50 70h100" className={s.ink} opacity="0.4" />
    </>
  ),
  // A page of text under a lens that finds nothing.
  search: (
    <>
      <rect x="54" y="20" width="76" height="92" rx="8" className={s.paper} />
      <Rules x={64} y={34} widths={[48, 56, 40, 52, 30, 44, 36]} />
      <g className={s.beat}>
        <circle cx="126" cy="70" r="20" className={s.accentFill} />
        <path d="M140 84l14 14" className={s.accent} strokeWidth="3" />
        <path d="M118 70h16" className={s.accent} />
      </g>
    </>
  ),
  // An empty tray with a check: nothing waiting.
  inbox: (
    <>
      <path d="M52 76l14-34h68l14 34v30a6 6 0 0 1-6 6H58a6 6 0 0 1-6-6z" className={s.paper} />
      <path d="M52 76h28l6 10h28l6-10h28" className={s.ink} />
      <Badge cx={100} cy={56}>
        <path d="M95 56l4 4 6-8" />
      </Badge>
    </>
  ),
  // A page of the course, and a reply forming beside it.
  tutor: (
    <>
      <rect x="38" y="30" width="64" height="80" rx="8" className={s.paper} />
      <Rules x={48} y={44} widths={[40, 44, 30, 42, 26]} gap={10} />
      <path d="M90 74h-6" className={s.ink} />
      <g className={s.beat}>
        <path d="M112 30h46a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8h-30l-12 10v-10h-4a8 8 0 0 1-8-8V38a8 8 0 0 1 8-8z" className={s.accentFill} />
        <circle cx="122" cy="51" r="2.5" className={s.accentSolid} />
        <circle cx="134" cy="51" r="2.5" className={s.accentSolid} />
        <circle cx="146" cy="51" r="2.5" className={s.accentSolid} />
      </g>
    </>
  ),
  // The app and the service, unplugged: the cable ends short of the socket.
  offline: (
    <>
      <rect x="28" y="30" width="58" height="76" rx="8" className={s.paper} />
      <Rules x={38} y={44} widths={[36, 28, 38, 22]} gap={10} />
      <rect x="124" y="30" width="48" height="76" rx="8" className={s.paperBack} />
      <path d="M134 46h28M134 62h28M134 78h28" className={s.ink} opacity="0.5" />
      <circle cx="148" cy="94" r="2.5" className={s.ink} />
      <path d="M86 68h8" className={s.ink} />
      <rect x="94" y="62" width="8" height="12" rx="2" className={s.paper} />
      <path d="M102 65h4M102 71h4" className={s.ink} />
      <path d="M124 68h-6" className={s.ink} />
      <rect x="112" y="63" width="6" height="10" rx="2" className={s.paperBack} />
      <g className={s.beat}>
        <path d="M109 54v-6M101 56l-3-5M117 56l3-5" className={s.accent} />
      </g>
    </>
  ),
  // The outline where a page used to be, and a lone corner.
  missing: (
    <>
      <rect x="62" y="20" width="76" height="92" rx="8" className={s.ghost} />
      <path d="M118 112l20-20v12a8 8 0 0 1-8 8z" className={s.paperBack} />
      <g className={s.beat}>
        <path
          d="M92 54a8 8 0 1 1 11 7.4c-2 .8-3 2.4-3 4.6v3"
          className={s.accent}
          strokeWidth="2.5"
        />
        <circle cx="100" cy="78" r="1.8" className={s.accentSolid} />
      </g>
    </>
  ),
  // A page that came back cracked.
  broken: (
    <>
      <path d="M56 28a8 8 0 0 1 8-8h40l-8 30 12 12-10 50H64a8 8 0 0 1-8-8z" className={s.paper} />
      <path d="M112 20h24a8 8 0 0 1 8 8v76a8 8 0 0 1-8 8h-20l10-48-12-12z" className={s.paper} />
      <Rules x={64} y={34} widths={[30, 26, 34, 22, 28]} gap={11} />
      <Rules x={122} y={34} widths={[14, 18, 12, 16, 10]} gap={11} />
      <path d="M108 20l-8 30 12 12-10 50" className={cx(s.accent, s.beat)} strokeWidth="2" />
    </>
  ),
};

export function Spot({ kind, width = 160 }: { kind: SpotKind; width?: number }) {
  return (
    <Box w={width} maw="100%">
      <Frame kind={kind}>{DRAWINGS[kind]}</Frame>
    </Box>
  );
}
