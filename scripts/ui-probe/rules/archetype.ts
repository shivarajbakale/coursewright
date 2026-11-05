import type { Rule, Snapshot, SnapshotNode, Violation } from '../types';
import { ancestors, descendants, hint, ignoredBy, paints, visible } from '../tree';

/**
 * Module B — archetype conformance.
 *
 * Eight layout shapes, each a set of structural assertions. The archetype is
 * declared by PageShell rather than inferred, so the rules check the shape the
 * author asked for instead of guessing at the one they got.
 */

const MAX_FORM_WIDTH = 640;
const MAX_CARD_WIDTH = 480;
const ROW_TOLERANCE_PX = 2;
const CENTRE_TOLERANCE_X = 4;
const CENTRE_TOLERANCE_Y = 32;
const STRETCH_SLACK_PX = 96;
const SCROLLABLE = /^(auto|scroll)$/;

function rootFor(s: Snapshot, archetype: string): SnapshotNode | null {
  return s.nodes.find((n) => n.data.archetype === archetype && visible(n)) ?? null;
}

/** Panels with no panel ancestor inside `root` — the view's top-level panes. */
export function topLevelPanels(s: Snapshot, root: SnapshotNode): SnapshotNode[] {
  return descendants(s, root).filter((n) => {
    if (n.data.panel === undefined || !visible(n)) return false;
    return !ancestors(s, n).some((a) => a.id !== root.id && a.data.panel !== undefined);
  });
}

function violation(
  rule: string,
  node: SnapshotNode | null,
  message: string,
  detail: Violation['detail'] = {}
): Violation {
  return {
    rule,
    message,
    nodeId: node?.id ?? null,
    selectorHint: node ? hint(node) : 'view',
    detail,
  };
}

function inkHeight(s: Snapshot, panel: SnapshotNode): number {
  let bottom = panel.box.y;
  // The panel itself counts: a tile whose only content is its own text node
  // would otherwise measure as carrying no ink at all.
  for (const node of [panel, ...descendants(s, panel)]) {
    if (!paints(node)) continue;
    bottom = Math.max(bottom, node.box.y + node.box.height);
  }
  return bottom - panel.box.y;
}

/** Group panels that share a top edge — a visual row. */
function rowsOf(panels: SnapshotNode[]): SnapshotNode[][] {
  const rows: SnapshotNode[][] = [];
  for (const panel of [...panels].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)) {
    const row = rows.find((r) => Math.abs(r[0].box.y - panel.box.y) <= ROW_TOLERANCE_PX);
    if (row) row.push(panel);
    else rows.push([panel]);
  }
  return rows;
}

export const B1: Rule = {
  id: 'B1',
  title: 'list-detail archetype',
  check(s) {
    const root = rootFor(s, 'list-detail');
    if (!root || ignoredBy(s, root, 'B1')) return [];

    const panes = topLevelPanels(s, root).sort((a, b) => a.box.x - b.box.x);
    if (panes.length !== 2) {
      return [
        violation('B1', root, `list-detail needs exactly two panes, found ${panes.length}`, {
          panes: panes.length,
        }),
      ];
    }

    const [master, detail] = panes;
    const out: Violation[] = [];

    if (master.box.width < detail.box.width) {
      out.push(
        violation(
          'B1',
          root,
          `master pane (${Math.round(master.box.width)}px) is narrower than the detail pane (${Math.round(detail.box.width)}px)`,
          { masterWidth: master.box.width, detailWidth: detail.box.width }
        )
      );
    }

    const hasHandle = descendants(s, root).some(
      (n) => n.role === 'separator' || n.data.panelResizeHandleId !== undefined
    );
    if (!hasHandle) {
      out.push(violation('B1', root, 'no resize affordance between the panes'));
    }

    if (!descendants(s, detail).some(paints) && !paints(detail)) {
      out.push(violation('B1', detail, 'detail pane is blank — it needs a designed empty state'));
    }

    return out;
  },
};

export const B2: Rule = {
  id: 'B2',
  title: 'dashboard-grid archetype',
  check(s) {
    const root = rootFor(s, 'dashboard-grid');
    if (!root || ignoredBy(s, root, 'B2')) return [];

    const panels = topLevelPanels(s, root);
    const rows = rowsOf(panels);
    const out: Violation[] = [];

    const kpiRow = rows.find((row) => row.length >= 2);
    if (!kpiRow) {
      out.push(
        violation('B2', root, 'dashboard-grid has no KPI row — expected a row of 2-4 equal tiles')
      );
    } else {
      if (kpiRow.length > 4) {
        out.push(
          violation('B2', root, `KPI row has ${kpiRow.length} tiles; the archetype allows 2-4 tiles`, {
            tiles: kpiRow.length,
          })
        );
      }
      const widths = kpiRow.map((p) => p.box.width);
      if (Math.max(...widths) - Math.min(...widths) > 1) {
        out.push(
          violation('B2', root, `KPI tiles are not equal width (${widths.map(Math.round).join(', ')})`, {
            widths: widths.map(Math.round).join(','),
          })
        );
      }
    }

    for (const row of rows) {
      if (row.length < 2) continue;
      const tallest = Math.max(...row.map((p) => p.box.height));
      for (const panel of row) {
        if (Math.abs(panel.box.height - tallest) > 1) continue;
        const slack = panel.box.height - inkHeight(s, panel);
        if (slack > STRETCH_SLACK_PX) {
          out.push(
            violation(
              'B2',
              panel,
              `panel is stretched to its tallest sibling and carries ${Math.round(slack)}px of nothing — size it to its content`,
              { slackPx: slack, rowHeight: tallest }
            )
          );
        }
      }
    }

    const fills = panels.filter((p) => p.data.fill !== undefined);
    if (fills.length > 1) {
      out.push(
        violation('B2', root, `${fills.length} panels declare data-fill; at most one may absorb leftover height`, {
          fills: fills.length,
        })
      );
    }

    return out;
  },
};

export const B3: Rule = {
  id: 'B3',
  title: 'form archetype',
  check(s) {
    const root = rootFor(s, 'form');
    if (!root || ignoredBy(s, root, 'B3')) return [];

    const inside = descendants(s, root);
    const form = inside.find((n) => n.tag === 'form' && visible(n));
    if (!form) return [violation('B3', root, 'form archetype with no <form> element')];

    const out: Violation[] = [];

    if (form.box.width > MAX_FORM_WIDTH) {
      out.push(
        violation(
          'B3',
          form,
          `form column is ${Math.round(form.box.width)}px wide; the archetype caps it at ${MAX_FORM_WIDTH}px`,
          { width: form.box.width }
        )
      );
    }

    const submits = descendants(s, form).filter(
      (n) =>
        visible(n) &&
        (n.data.submit !== undefined || n.data.variant === 'default') &&
        (n.tag === 'button' || n.role === 'button')
    );
    if (submits.length !== 1) {
      out.push(
        violation('B3', form, `expected one submit action, found ${submits.length}`, {
          submits: submits.length,
        })
      );
    }

    const controls = descendants(s, form).filter(
      (n) => ['input', 'select', 'textarea'].includes(n.tag) && visible(n)
    );
    for (const label of descendants(s, form).filter((n) => n.tag === 'label' && visible(n))) {
      const beside = controls.find(
        (c) =>
          c.box.y < label.box.y + label.box.height &&
          label.box.y < c.box.y + c.box.height &&
          c.box.x >= label.box.x + label.box.width
      );
      if (beside) {
        out.push(
          violation('B3', label, `label "${label.text}" sits beside its control; labels go above`, {
            labelX: label.box.x,
            controlX: beside.box.x,
          })
        );
      }
    }

    return out;
  },
};

export const B4: Rule = {
  id: 'B4',
  title: 'centered-card archetype',
  check(s) {
    const root = rootFor(s, 'centered-card');
    if (!root || ignoredBy(s, root, 'B4')) return [];

    const cards = topLevelPanels(s, root);
    if (cards.length !== 1) {
      return [
        violation('B4', root, `centered-card needs exactly one card, found ${cards.length}`, {
          cards: cards.length,
        }),
      ];
    }

    const [card] = cards;
    const out: Violation[] = [];

    if (card.box.width > MAX_CARD_WIDTH) {
      out.push(
        violation(
          'B4',
          card,
          `card is ${Math.round(card.box.width)}px wide; the archetype caps it at ${MAX_CARD_WIDTH}px`,
          { width: card.box.width }
        )
      );
    }

    const dx = Math.abs(card.box.x + card.box.width / 2 - (root.box.x + root.box.width / 2));
    const dy = Math.abs(card.box.y + card.box.height / 2 - (root.box.y + root.box.height / 2));
    if (dx > CENTRE_TOLERANCE_X || dy > CENTRE_TOLERANCE_Y) {
      out.push(
        violation('B4', card, `card is not centred (off by ${Math.round(dx)}px across, ${Math.round(dy)}px down)`, {
          dx,
          dy,
        })
      );
    }

    const scroller = descendants(s, root).find(
      (n) =>
        visible(n) &&
        ((SCROLLABLE.test(n.style.overflowY) && n.scrollHeight - n.clientHeight > 1) ||
          (SCROLLABLE.test(n.style.overflowX) && n.scrollWidth - n.clientWidth > 1))
    );
    if (scroller) {
      out.push(violation('B4', scroller, 'a centred card view must not scroll'));
    }

    return out;
  },
};

/** Vertically scrollable and actually overflowing — a scroll viewport with
 *  nothing to scroll is not a scroll region the user can find. */
function scrollsVertically(n: SnapshotNode): boolean {
  return SCROLLABLE.test(n.style.overflowY) && n.scrollHeight - n.clientHeight > 1;
}

/** Buttons the form treats as its submit. Mirrors B3's definition so the two
 *  rules cannot disagree about what a submit is. */
function submitsIn(s: Snapshot, root: SnapshotNode): SnapshotNode[] {
  return descendants(s, root).filter(
    (n) =>
      visible(n) &&
      (n.data.submit !== undefined || n.data.variant === 'default') &&
      (n.tag === 'button' || n.role === 'button')
  );
}

export const B5: Rule = {
  id: 'B5',
  title: 'detail archetype',
  check(s) {
    const root = rootFor(s, 'detail');
    if (!root || ignoredBy(s, root, 'B5')) return [];

    const inside = descendants(s, root);
    const out: Violation[] = [];

    // The subject's name is the page's headline. A detail view that spends its
    // h1 on the category the nav rail already showed has no headline at all,
    // and two h1s means the page is two subjects.
    const headings = inside.filter((n) => n.tag === 'h1' && visible(n));
    if (headings.length !== 1) {
      out.push(
        violation('B5', root, `detail needs exactly one <h1> naming its subject, found ${headings.length}`, {
          headings: headings.length,
        })
      );
    }

    // Titled sections are what make a record skimmable. One wall of content is
    // content nobody skips through, and skipping is how records get read.
    const sections = inside.filter((n) => n.data.section !== undefined && visible(n));
    if (sections.length < 2) {
      out.push(
        violation(
          'B5',
          root,
          `detail content is in ${sections.length} declared section(s); it needs at least two (mark them data-section)`,
          { sections: sections.length }
        )
      );
    }

    const primaries = inside.filter((n) => n.data.primaryAction !== undefined && visible(n));
    if (primaries.length > 1) {
      out.push(
        violation('B5', root, `${primaries.length} elements declare data-primary-action; a detail view has one`, {
          primaries: primaries.length,
        })
      );
    }
    // The action the page exists for must survive a scroll. Inside the scroller
    // it is reachable only from wherever the user happens to have stopped.
    for (const primary of primaries) {
      if (ancestors(s, primary).some((a) => a.id !== root.id && scrollsVertically(a))) {
        out.push(
          violation('B5', primary, 'the primary action scrolls away — pin it outside the scroll region')
        );
      }
    }

    return out;
  },
};

export const B6: Rule = {
  id: 'B6',
  title: 'settings archetype',
  check(s) {
    const root = rootFor(s, 'settings');
    if (!root || ignoredBy(s, root, 'B6')) return [];

    const inside = descendants(s, root);
    const out: Violation[] = [];

    // The rail (or, narrow, the tab strip) is what makes settings navigable.
    // Without one the page is a single long scroll the user has to hunt.
    const rail = inside.find(
      (n) => visible(n) && (n.role === 'navigation' || n.role === 'tablist' || n.tag === 'nav')
    );
    if (!rail) {
      out.push(
        violation('B6', root, 'settings has no section rail — expected a <nav>, role=navigation, or a tab strip')
      );
    }

    // One scroll region, and it is not the page. The rail stays put so that
    // switching sections does not lose the user's place.
    if (scrollsVertically(root)) {
      out.push(violation('B6', root, 'the settings page scrolls as a whole; the content column owns the scroll'));
    }
    const scrollers = inside.filter((n) => visible(n) && scrollsVertically(n));
    if (scrollers.length > 1) {
      out.push(
        violation('B6', root, `${scrollers.length} vertical scroll regions; settings has one — the content column`, {
          scrollers: scrollers.length,
        })
      );
    }

    // A switch means the change applied when it moved. One that waits for Save
    // has told the user something that is not true.
    for (const form of inside.filter((n) => n.tag === 'form' && visible(n))) {
      const toggles = descendants(s, form).filter((n) => n.role === 'switch' && visible(n));
      if (toggles.length && submitsIn(s, form).length) {
        out.push(
          violation(
            'B6',
            toggles[0],
            'a switch sits inside a form with a submit — a control that needs Save is a checkbox, not a switch',
            { switches: toggles.length }
          )
        );
      }
    }

    return out;
  },
};

export const B7: Rule = {
  id: 'B7',
  title: 'sequence archetype',
  check(s) {
    const root = rootFor(s, 'sequence');
    if (!root || ignoredBy(s, root, 'B7')) return [];

    const inside = descendants(s, root);
    const out: Violation[] = [];

    // Steps rendered together and hidden with opacity are a long form that
    // scrolls badly. One decision per screen means one step on screen.
    const steps = inside.filter((n) => n.data.step !== undefined && visible(n));
    if (steps.length !== 1) {
      out.push(
        violation('B7', root, `sequence shows ${steps.length} steps; exactly one is on screen at a time`, {
          steps: steps.length,
        })
      );
    }

    // Progress at the top, primary at the bottom. Sharing the bottom edge is
    // how a progress bar ends up under a keyboard on a narrow viewport.
    const progress = inside.find(
      (n) => visible(n) && (n.role === 'progressbar' || n.data.progress !== undefined)
    );
    if (!progress) {
      out.push(violation('B7', root, 'sequence declares no progress — the user cannot tell how long this is'));
    } else if (progress.box.y + progress.box.height / 2 > root.box.y + root.box.height / 2) {
      out.push(violation('B7', progress, 'progress sits in the lower half; it belongs at the top of the step'));
    }

    // Back that costs nothing is the rule users notice being broken fastest.
    if (!inside.some((n) => n.data.back !== undefined && visible(n))) {
      out.push(violation('B7', root, 'sequence has no back affordance (mark it data-back)'));
    }

    return out;
  },
};

export const B8: Rule = {
  id: 'B8',
  title: 'list archetype',
  check(s) {
    const root = rootFor(s, 'list');
    if (!root || ignoredBy(s, root, 'B8')) return [];

    const inside = descendants(s, root);
    const out: Violation[] = [];

    // The collection's name is the page's headline, and there is one of it. Two
    // h1s means the page is two collections and should be two routes.
    const headings = inside.filter((n) => n.tag === 'h1' && visible(n));
    if (headings.length !== 1) {
      out.push(
        violation('B8', root, `list needs exactly one <h1> naming the collection, found ${headings.length}`, {
          headings: headings.length,
        })
      );
    }

    // A collection with no rows region is a page that promised a list and drew
    // something else. An *empty* collection is fine — the region still exists,
    // and its empty state is content.
    const collection = inside.find(
      (n) => visible(n) && (n.tag === 'table' || n.tag === 'ul' || n.tag === 'ol' || n.role === 'list')
    );
    if (!collection) {
      out.push(violation('B8', root, 'list has no collection region — no <table>, <ul>, <ol> or role="list"'));
    }

    // Filtering is what makes a collection usable past twenty rows, and it is
    // either a search box or a scope control. A radiogroup counts: a
    // SegmentedControl scoping the list is a filter, not decoration.
    const filters = inside.filter(
      (n) =>
        visible(n) &&
        (n.tag === 'input' || n.role === 'searchbox' || n.role === 'textbox' || n.role === 'radiogroup')
    );
    if (filters.length === 0) {
      out.push(
        violation('B8', root, 'list has no filter or scope control — a collection the user cannot narrow')
      );
    }

    // A filter inside the rows scroller scrolls away with the rows, which is
    // the one place it must never be: the user reaches for it precisely when
    // they have scrolled far enough to be lost.
    for (const filter of filters) {
      if (ancestors(s, filter).some((a) => a.id !== root.id && scrollsVertically(a))) {
        out.push(
          violation('B8', filter, 'the filter scrolls away with the rows — pin it above the scroll region')
        );
      }
    }

    // Same contract as B5: one primary, and it survives a scroll.
    const primaries = inside.filter((n) => n.data.primaryAction !== undefined && visible(n));
    if (primaries.length > 1) {
      out.push(
        violation('B8', root, `${primaries.length} elements declare data-primary-action; a list has one`, {
          primaries: primaries.length,
        })
      );
    }
    for (const primary of primaries) {
      if (ancestors(s, primary).some((a) => a.id !== root.id && scrollsVertically(a))) {
        out.push(
          violation('B8', primary, 'the primary action scrolls away — pin it outside the scroll region')
        );
      }
    }

    return out;
  },
};
