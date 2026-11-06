/**
 * The probe's data contract.
 *
 * A `Snapshot` is fully serializable: no DOM handles, no functions, no cycles
 * beyond integer ids. That is deliberate — it is what lets every rule be a pure
 * function, unit-tested in jsdom, and what would let a future CDP driver point
 * the same rules at a live app without touching them.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NodeStyle {
  display: string;
  position: string;
  overflowX: string;
  overflowY: string;
  flexDirection: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string;
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  rowGap: number;
  columnGap: number;
  textOverflow: string;
  opacity: number;
  visibility: string;
}

export interface SnapshotNode {
  /** Index into `Snapshot.nodes`. Pre-order; the root is 0. */
  id: number;
  parent: number | null;
  children: number[];
  tag: string;
  role: string | null;
  testId: string | null;
  /** Direct text-node children only, whitespace-collapsed. */
  text: string;
  /** Viewport-relative, from getBoundingClientRect. */
  box: Box;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  /** `dataset`, camelCase keys, e.g. `data-scroll-x` -> `scrollX`. */
  data: Record<string, string>;
  /**
   * The Mantine component and part this element is, read off its class list:
   * `mantine-SegmentedControl-root` becomes `SegmentedControl-root`. Null for
   * anything the library did not render.
   *
   * It is the only string in the snapshot that names a *library* rather than
   * this app, and it is here for one reason: a rule cannot ask whether a
   * surface is meant to be raised without knowing what the surface is. The app
   * cannot answer that either — the elements in question are rendered inside
   * Mantine, where no page can put a `data-` attribute on them.
   */
  mantine: string | null;
  style: NodeStyle;
}

export interface Snapshot {
  /** Human label for reports, e.g. "Dashboard @1440". */
  label: string;
  viewport: { width: number; height: number };
  nodes: SnapshotNode[];
  /**
   * `document.body`'s computed background.
   *
   * The snapshot root is the app's own element, and every wrapper between it
   * and the page is transparent — so "what is the colour behind this?" runs off
   * the top of the tree and lands here. Without it a rule that compares a
   * surface to its ground compares it to `rgba(0, 0, 0, 0)` and passes
   * everything, which is how C7 first shipped measuring nothing.
   */
  bodyBackground: string;
  scroll: {
    scrollWidth: number;
    clientWidth: number;
    scrollHeight: number;
    clientHeight: number;
    /** When the document scrolls: the outermost elements reaching below the viewport. */
    overflowing?: string[];
  };
}

export interface Violation {
  /** One of A1..A5, B1..B4, C1..C6, D1..D3. */
  rule: string;
  message: string;
  nodeId: number | null;
  /** Enough to find the element by eye, e.g. `<div data-panel> @24,180`. */
  selectorHint: string;
  detail: Record<string, number | string>;
}

export interface Rule {
  id: string;
  title: string;
  check(snapshot: Snapshot): Violation[];
}
