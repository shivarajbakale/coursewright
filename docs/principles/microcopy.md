<!-- principle:microcopy:v2 -->
<!-- Stamped from the shared principles source by stamp-principles.mjs. Edit the source and re-stamp: a hand edit fails principles-drift. -->

# Microcopy principles

Microcopy is the small text that carries the user's mental model: button
labels, error messages, empty states, toasts, confirmations. Bad
microcopy makes a premium app feel cheap; good microcopy is invisible.

> Source: a synthesis of NN/g guidance + Kinneret Yifrah's "Microcopy"
> + this repository's own conventions.

## Button labels

### Use verbs, not nouns

| Don't | Do | Why |
| --- | --- | --- |
| `Save` | `Save changes` | "Changes" implies diff vs. existing state |
| `Cancel` | `Cancel` | One word is fine when unambiguous |
| `Submit` | `Submit application` / `Send invite` | Action verb + object |
| `OK` | `Got it` | "OK" is the browser dialog; "Got it" is conversational |
| `Yes` / `No` | `Delete` / `Cancel` | Buttons describe actions, not answers |
| `Confirm` | `Delete workspace` | Name the specific action |

### Pending state

A button in flight is disabled and carries a pending label:

| Idle | Pending | Why |
| --- | --- | --- |
| `Save changes` | `Saving…` | Continuous verb + ellipsis |
| `Send invite` | `Sending…` | Continuous verb + ellipsis |
| `Delete workspace` | `Deleting…` | Continuous verb + ellipsis |
| `Sign in` | `Signing in…` | Continuous verb + ellipsis |

Never use a spinner alone without a label. The user can't predict when
the action finishes; the label + spinner tells them "in progress, wait."

## Error messages

Every error message has three parts:

1. **What happened** (1 sentence)
2. **Why it happened** (1 sentence, only if not obvious)
3. **What to do next** (1 sentence)

| Don't | Do |
| --- | --- |
| `Something went wrong` | `Couldn't save changes. Check your connection and try again.` |
| `Error 422` | `That email is already in use. Try signing in instead.` |
| `Failed to fetch` | `We couldn't reach the server. Check your connection.` |
| `Unauthorized` | `Your session expired. Sign in again to continue.` |
| `Validation failed` | `Please enter a valid email address.` |

For form errors, surface them inline (under the field), not as a toast.
For cross-cutting errors (rate limit, session expired), use a toast or the
page's single banner — never both, and never one banner per error.

## Empty states

Three lines max:

1. **What belongs here** (headline)
2. **Why it's empty** (body, optional — skip if obvious)
3. **What to do next** (CTA, exactly one)

```text
┌─────────────────────────────────────┐
│           (no illustration)          │
│                                     │
│  No customers yet                    │  ← headline
│  Accounts appear here once you       │  ← body (optional)
│  create them.                        │
│                                     │
│  [+ New customer]                    │  ← exactly one CTA
└─────────────────────────────────────┘
```

| Don't | Do |
| --- | --- |
| `0 items` | `No customers yet` |
| `Empty` | `No customers yet` |
| `You have nothing here!` | `No customers yet` |
| `Click here to create one` | `+ New customer` (button label is the verb) |

No lorem text, no "tip:" asides. If you need more than 3 lines, the screen
needs a real onboarding flow.

## Toasts

| Type | When | Copy |
| --- | --- | --- |
| Success | Mutation succeeded | `Customer added` or `Saved` — one noun + (optional) one verb |
| Error | Mutation failed (and not inline) | `Couldn't save changes — try again` |
| Info | Background event the user should know about | `New sign-in from Chrome on macOS` |
| Warning | Recoverable but worth attention | `You're using 80% of your storage` |

Success is always a toast, never a banner that stays on the page — see
[density-and-disclosure.md](density-and-disclosure.md).

Don't show toasts for:
- Navigation (the URL change is the feedback).
- Hover states (too noisy).
- Every action (only on mutations, not on every read).

## Confirmation dialogs

Destructive confirmations are modals, and they name the object:

```text
┌─────────────────────────────────────┐
│  Delete "Acme Inc."?                │  ← name the object
│                                     │
│  This workspace and all of its      │  ← what will happen
│  data will be permanently deleted.   │
│                                     │
│  [Cancel]              [Delete]     │  ← safe default on left,
└─────────────────────────────────────┘  destructive on right
```

The default action is the **safe** one. Pressing `Enter` should not
delete; pressing `Esc` should cancel. Focus lands on Cancel, not Delete.

For non-destructive confirmations (e.g. "Discard unsaved changes?"),
the question is the body:

```text
┌─────────────────────────────────────┐
│  Discard unsaved changes?           │
│                                     │
│  Your edits to "Acme" will be lost. │
│                                     │
│  [Keep editing]           [Discard]  │
└─────────────────────────────────────┘
```

## Tooltips

Tooltips on icon-only buttons:

- Always have `aria-label` for screen readers (the tooltip text can be
  the same).
- Appear on hover AND on focus.
- Dismiss with `Esc`.
- Never contain the only way to know something — if the tooltip is
  "Click to delete", the screen-reader `aria-label` must be "Delete
  workspace".

## Placeholders

Placeholders are **examples**, not labels:

```html
<!-- wrong -->
<input placeholder="Email" />

<!-- right -->
<label for="email">Email</label>
<input id="email" placeholder="you@company.com" />
```

The placeholder disappears when the user starts typing. The label
doesn't. Labels are mandatory (WCAG 3.3.2); placeholders are not.

## Helper text

Helper text explains a non-obvious input:

| Don't | Do |
| --- | --- |
| `Email` | `Email — we'll send a sign-in link` |
| `Password` | `Password — at least 12 characters` |
| `Workspace name` | `Workspace name — appears in the URL` |

Helper text lives below the input, subdued. When the field has an error, helper
text is replaced by the error message.

## Don'ts

- **Don't use "Please" in errors.** It's condescending. "Enter a valid
  email" is fine.
- **Don't apologize.** "Sorry, we couldn't save" is worse than
  "Couldn't save — try again".
- **Don't use exclamation marks.** "Welcome!" is fine in marketing
  copy; "Saved!" in a toast is too chipper for a B2B app.
- **Don't use jargon.** "Backend", "API", "RPC" — none of these
  belong in user-facing text.
- **Don't write "we" everywhere.** First-person plural reads as a
  marketing site. Use imperative ("Save changes") or impersonal
  passive ("Changes saved").

## Verify

1. Every button has a verb label, not a noun.
2. Every error message has all three parts (what / why / next).
3. Every empty state has a CTA (one, not zero, not multiple).
4. Every icon-only button has `aria-label` AND a tooltip.
5. Every form input has a label above (not a placeholder).
6. Every destructive dialog's default focus is the safe action.

See `ux-prepass` for the mandatory UI gates.

## On this platform — React + Mantine

Helper text is the Mantine input's own `description` prop, which renders dimmed
under the field and is replaced by `error`. Toasts go through `src/lib/notify.ts`
(`@mantine/notifications`); destructive confirmations through
`modals.openConfirmModal`.
