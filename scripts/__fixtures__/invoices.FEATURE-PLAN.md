<!-- feature-plan:v1 — generated, do not hand-edit.
     Regenerate with: node scripts/feature-plan.mjs invoices.feature-plan.json -->

# Invoices

`invoices` · 1 surface

## Problem

Users can see who their customers are (Customers) but not what has been billed to them. There is no way to raise an invoice, see which are unpaid, or chase one — so billing happens in a spreadsheet nobody else can read.

## Not in this feature

- Payment collection — this feature records invoices, it does not charge cards.
- PDF export. Deliberately deferred until the data model settles.

## Surfaces

### Invoices · `/invoices`

Archetype: `list-detail` — Find an invoice and act on it without losing the list.

**Peak** — the invoice sends and the row flips to Sent, with the amount and the due date beside it

**End** — the list still in place, the sent invoice still selected, and nothing else due this week

**Desktop @1440**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▨ Acme      ⌕ Search…                                       ⌘K   ◐   ⬤     │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Dashboard     │ Invoices                                 [ + New invoice ] │
│ Customers     │                                                            │
│ Inbox         │ ┌─────────────────────────────┐ ┌────────────────────────┐ │
│ Team          │ │ ⌕ Filter        [Status ▾]  │ │ INV-0042         ●Paid │ │
│ Billing       │ ├─────────────────────────────┤ │ Acme Corp              │ │
│ Settings      │ │ ☐ INV-0042  Acme      ●Paid │ │ ────────────────────── │ │
│ Invoices ◀ new│ │ ☑ INV-0041  Globex     ○Due │ │ Amount          $4,200 │ │
│               │ │ ☐ INV-0040  Initech   ●Paid │ │ Issued          14 Aug │ │
│               │ │ ☐ INV-0039  Umbrella  ⊗Void │ │ Due             12 Sep │ │
│               │ ├─────────────────────────────┤ │ ────────────────────── │ │
│               │ │          ‹ 1 2 3 ›          │ │ [Archive]  [Delete]    │ │
│               │ └─────────────────────────────┘ └────────────────────────┘ │
└───────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile @390** — design intent; the probe measures 1280 / 1440 / 1920 only.

```
┌──────────────────────────┐         ┌──────────────────────────┐
│ ☰  Invoices          ⌕   │         │ ‹ Back  INV-0042         │
├──────────────────────────┤         ├──────────────────────────┤
│ ┌──────────────────────┐ │    ──▶  │ ┌──────────────────────┐ │
│ │ ⌕ Filter        [Sta…│ │         │ │ INV-0042       ●Paid │ │
│ ├──────────────────────┤ │         │ │ Acme Corp            │ │
│ │ ☐ INV-0042  Acme   … │ │         │ │ ──────────────────── │ │
│ │ ☑ INV-0041  Globex … │ │         │ │ Amount        $4,200 │ │
│ │ ☐ INV-0040  Initech… │ │         │ │ Issued        14 Aug │ │
│ │ ☐ INV-0039  Umbrell… │ │         │ │ Due           12 Sep │ │
│ ├──────────────────────┤ │         │ │ ──────────────────── │ │
│ │      ‹ 1 2 3 ›       │ │         │ │ [Archive]  [Delete]  │ │
│ └──────────────────────┘ │         │ └──────────────────────┘ │
│    [ + New invoice ]     │         └──────────────────────────┘
└──────────────────────────┘
```

**States**

```
        loading                     empty                      error
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ No invoices yet.     │   │ ⚠                    │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ They'll appear here  │   │ Couldn't load        │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │ once you send one.   │   │ invoices.            │
│ ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓     │   │                      │   │                      │
│                      │   │ [ + New invoice ]    │   │ [ Try again ]        │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
 Skeleton mirrors rows       one CTA, 3 lines max      retry, never raw text
```

Success: Rows render; selecting one fills the detail pane while the list stays mounted.

Held to:

- B1 — two or more top-level panels sharing a top edge
- B2 — no panel scrolls; PageShell owns the single scroll region

## Overlays

```
          dialog · create                     alert-dialog · delete
┌────────────────────────────────┐     ┌──────────────────────────────────┐
│ New invoice                  ✕ │     │ Delete "INV-0042"?               │
│ ────────────────────────────── │     │ ──────────────────────────────── │
│ Client  [ Acme       ▾  ]      │     │ This can't be undone.            │
│ Amount  [ 4200          ]      │     │            [ Cancel ] [ Delete ] │
│ Due     [ 12 Sep 26 📅  ]      │     └──────────────────────────────────┘
│ ────────────────────────────── │
│          [ Cancel ] [ Create ] │
└────────────────────────────────┘
```

## Components

Each choice states the neighbour it beat. `Use when:` / `Instead:` for every
component family lives in `.claude/skills/use-mantine/mantine-capabilities.md`;
the choices between families live in
`docs/principles/component-selection.md`.

| Surface | Control | Why this one | Not |
| --- | --- | --- | --- |
| list | `DataTable` | sorting, filtering, pagination and selection all present | `Table` |
| list | `Combobox` | client filter has 40+ entries and the user knows the name | `Select` |
| list | `Badge` | status is a label attached to a row, not a control | `Button` |
| create | `Dialog` | three fields, short, and the list behind it is worth keeping visible | `route` |
| delete | `AlertDialog` | destructive and irreversible, so it names the object | `Dialog` |
| archive | `Sonner + undo` | reversible, so interrupting to confirm costs more than the mistake | `AlertDialog` |
| detail | `Skeleton` | content shape is known ahead of the data | `Progress` |

## Data model

- **Invoice**
  - `id`: string
  - `number`: string — INV-0042, generated
  - `clientId`: string
  - `amountCents`: number — integer cents, never a float
  - `status`: 'draft' | 'due' | 'paid' | 'void'
  - `dueAt`: ISO date
  - _relations:_ belongs to one Client; optionally references one Customer

## API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/invoices` | yes | paginated list, filterable by status + client |
| POST | `/api/invoices` | yes | create a draft invoice |
| GET | `/api/invoices/:id` | yes | detail pane |
| PATCH | `/api/invoices/:id` | yes | archive / mark paid |

## Integration points

```
  config/nav.ts            ──▶  sidebar entry + ⌘K command   (one edit wires both)
  invoiceKeys              ──▶  invalidated by create / patch   (reads and writes share the factory)
  mocks/handlers/index.ts  ──▶  register invoiceHandlers   (MSW default-on)
  router/router.tsx        ──▶  2 routes, one component   (keeps the list mounted on select)
```

## Blast radius

```
new (10)
  ├── src/api/types/invoice.types.ts
  ├── src/api/services/invoiceService.ts
  ├── src/mocks/handlers/invoiceHandlers.ts
  ├── src/hooks/useInvoices.ts
  ├── src/pages/Invoices/InvoicesPage.tsx
  ├── src/pages/Invoices/invoice-columns.tsx
  ├── src/pages/Invoices/InvoiceDetail.tsx
  ├── src/pages/Invoices/InvoiceForm.tsx
  ├── src/test/invoices.test.ts
  └── src/test/invoices-ui-contract.test.tsx

changed (4)
  ├── src/config/nav.ts
  ├── src/router/router.tsx
  ├── src/mocks/handlers/index.ts
  └── src/api/types/index.ts
```

## Verification plan

- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm run ui-lint`
- [ ] `npm run test`
- [ ] `npm run ui-probe`
- [ ] `ux-prepass` — all seven boxes, `npm run ui-lint` green is the evidence for item 7

---

Approve this before any file is written. Every diagram above is rendered
from this feature's plan JSON, so the drawing and the build cannot drift;
the archetype frames are the same shapes `ui-probe` rules B1-B4 assert
against the real DOM once the screens exist.
