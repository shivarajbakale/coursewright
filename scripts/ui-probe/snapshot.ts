import type { Snapshot, SnapshotNode } from './types';

/**
 * The only file in the probe that touches a DOM.
 *
 * Everything downstream is a pure function over the value this returns, which
 * is what lets rules be unit-tested without a browser and lets a different
 * driver (a CDP snapshot of the running app, say) feed the same rules later.
 */

const num = (value: string): number => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * `mantine-SegmentedControl-root` -> `SegmentedControl-root`.
 *
 * Mantine puts a stable, readable class on every part it renders, alongside the
 * hashed one that carries the styles. Only the readable half is captured: the
 * hash changes between releases and would make a rule that reads it a rule that
 * breaks on upgrade.
 */
function mantinePart(el: Element): string | null {
  const raw = typeof el.className === 'string' ? el.className : el.getAttribute('class');
  const match = (raw ?? '').match(/\bmantine-([A-Za-z]+-[A-Za-z]+)\b/);
  return match ? match[1] : null;
}

function ownText(el: Element): string {
  let out = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === 3) out += node.textContent ?? '';
  });
  return out.replace(/\s+/g, ' ').trim();
}

export function snapshot(root: Element, label: string): Snapshot {
  const doc = root.ownerDocument;
  const win = doc?.defaultView;
  if (!win || !doc.contains(root)) {
    throw new Error('snapshot: element is not attached to a rendered document');
  }

  const nodes: SnapshotNode[] = [];

  const visit = (el: Element, parent: number | null): number => {
    const cs = win.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const data: Record<string, string> = {};
    const dataset = (el as HTMLElement).dataset ?? {};
    for (const key of Object.keys(dataset)) {
      const value = dataset[key];
      if (value !== undefined) data[key] = value;
    }

    const id = nodes.length;
    const node: SnapshotNode = {
      id,
      parent,
      children: [],
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      testId: el.getAttribute('data-testid'),
      text: ownText(el),
      box: { x: r.x, y: r.y, width: r.width, height: r.height },
      clientWidth: (el as HTMLElement).clientWidth ?? 0,
      clientHeight: (el as HTMLElement).clientHeight ?? 0,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      data,
      mantine: mantinePart(el),
      style: {
        display: cs.display,
        position: cs.position,
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
        flexDirection: cs.flexDirection,
        fontSize: num(cs.fontSize),
        fontWeight: num(cs.fontWeight) || 400,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderTopWidth: num(cs.borderTopWidth),
        borderRightWidth: num(cs.borderRightWidth),
        borderBottomWidth: num(cs.borderBottomWidth),
        borderLeftWidth: num(cs.borderLeftWidth),
        paddingTop: num(cs.paddingTop),
        paddingRight: num(cs.paddingRight),
        paddingBottom: num(cs.paddingBottom),
        paddingLeft: num(cs.paddingLeft),
        rowGap: num(cs.rowGap),
        columnGap: num(cs.columnGap),
        textOverflow: cs.textOverflow,
        opacity: cs.opacity === '' ? 1 : num(cs.opacity),
        visibility: cs.visibility,
      },
    };
    nodes.push(node);

    for (const child of Array.from(el.children)) {
      node.children.push(visit(child, id));
    }
    return id;
  };

  visit(root, null);

  const scroller = doc.scrollingElement ?? doc.documentElement;
  // When the document scrolls, name the outermost elements that reach below the viewport, so a report says
  // what pushed it rather than only by how much (the overflow can depend on the machine's fonts).
  const overflowing: string[] = [];
  if (scroller.scrollHeight - scroller.clientHeight > 1) {
    const limit = win.innerHeight + 1;
    for (const el of Array.from(doc.body.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect();
      const parent = el.parentElement?.getBoundingClientRect();
      if (r.bottom > limit && r.height > 0 && (!parent || parent.bottom <= limit || el.parentElement === doc.body)) {
        const attrs = Array.from(el.attributes)
          .filter((a) => a.name.startsWith('data-') || ['class', 'id', 'aria-label', 'style', 'role'].includes(a.name))
          .map((a) => `${a.name}="${a.value.slice(0, 40)}"`)
          .join(' ');
        const inside = Array.from(el.children).slice(0, 3).map((c) => `${c.tagName.toLowerCase()}${c.id ? '#' + c.id : ''}${c.getAttribute('data-section') ? '[' + c.getAttribute('data-section') + ']' : ''}`);
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
        overflowing.push(`<${el.tagName.toLowerCase()} ${attrs}> top ${Math.round(r.top)}px bottom ${Math.round(r.bottom)}px, holds ${inside.join(' ') || 'nothing'}${text ? ` "${text}"` : ''}`);
        if (overflowing.length >= 5) break;
      }
    }
  }
  return {
    label,
    viewport: { width: win.innerWidth, height: win.innerHeight },
    nodes,
    bodyBackground: win.getComputedStyle(doc.body).backgroundColor,
    scroll: {
      scrollWidth: scroller.scrollWidth,
      clientWidth: scroller.clientWidth,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
      overflowing,
    },
  };
}
