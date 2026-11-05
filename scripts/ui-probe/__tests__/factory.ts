import type { Box, NodeStyle, Snapshot, SnapshotNode } from '../types';

const DEFAULT_STYLE: NodeStyle = {
  display: 'block',
  position: 'static',
  overflowX: 'visible',
  overflowY: 'visible',
  flexDirection: 'row',
  fontSize: 16,
  fontWeight: 400,
  color: 'rgb(255, 255, 255)',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  borderTopWidth: 0,
  borderRightWidth: 0,
  borderBottomWidth: 0,
  borderLeftWidth: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  rowGap: 0,
  columnGap: 0,
  textOverflow: 'clip',
  opacity: 1,
  visibility: 'visible',
};

/**
 * What a test declares about one node. `style` and `box` are partial because a
 * rule test cares about one or two properties and should not have to restate
 * the other twenty.
 */
export type NodeSpec = Partial<Omit<SnapshotNode, 'style' | 'box'>> & {
  style?: Partial<NodeStyle>;
  box?: Partial<Box>;
};

/**
 * Build one node. `box` defaults to a 100x20 rect at the origin so a node is
 * visible unless a test says otherwise — the common case in rule tests.
 */
export function makeNode(partial: NodeSpec = {}): SnapshotNode {
  const { style, box: boxSpec, ...rest } = partial;
  const box: Box = { x: 0, y: 0, width: 100, height: 20, ...(boxSpec ?? {}) };
  return {
    id: 0,
    parent: null,
    children: [],
    tag: 'div',
    role: null,
    testId: null,
    text: '',
    box,
    clientWidth: box.width,
    clientHeight: box.height,
    scrollWidth: box.width,
    scrollHeight: box.height,
    data: {},
    mantine: null,
    ...rest,
    style: { ...DEFAULT_STYLE, ...(style ?? {}) },
  };
}

/**
 * Build a snapshot from nodes given in pre-order. Ids and `children` links are
 * derived from each node's `parent`, so a test only declares the shape it cares
 * about.
 */
export function makeSnapshot(nodes: NodeSpec[], partial: Partial<Snapshot> = {}): Snapshot {
  const built = nodes.map((n, i) => makeNode({ ...n, id: i, children: [] }));
  built.forEach((n) => {
    if (n.parent !== null && built[n.parent]) built[n.parent].children.push(n.id);
  });
  return {
    label: 'test',
    viewport: { width: 1440, height: 900 },
    nodes: built,
    bodyBackground: 'rgb(0, 0, 0)',
    scroll: { scrollWidth: 1440, clientWidth: 1440, scrollHeight: 900, clientHeight: 900 },
    ...partial,
  };
}
