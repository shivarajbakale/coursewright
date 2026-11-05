<!-- principle:density-and-disclosure:v1 -->
<!-- Stamped from the shared principles source by stamp-principles.mjs. Edit the source and re-stamp: a hand edit fails principles-drift. -->

# Density and disclosure

A page that passes every other gate can still be a long scroll: a title, then
card after card after banner after card, each one reasonable, the whole thing
three screens tall. Users call that "scrolly", and they mean the app never
decided what matters. This document is the budget, and the patterns that keep
a page inside it.

## The failure this prevents

**The page as a stack.** Every section gets its own card, every message gets its
own banner, every option is visible at once, and the primary action sits at the
bottom of it all. Nothing is wrong on its own. Together, the user has to scroll
to find out what the page is for and scroll again to act on it.

The cause is almost always *adding* without *placing*: a new setting becomes a
new card at the bottom, a new warning becomes a new banner at the top. Density
is not about packing more in — it is about deciding, for each new thing, whether
it belongs in the main column, the sidebar, a tab, a collapsed section, a toast
or a modal.

## The budget

| Measure | Budget | Why |
| --- | --- | --- |
| Page height | **≤ 2.5 viewports** at a desktop viewport 1040px tall | past that, the user stops reading and starts hunting |
| Primary action | **inside the first viewport** | the thing the page is for is visible without scrolling |
| Banners | **at most one at a time**, the highest priority wins | two banners make the page about its problems |
| Stacked cards in the main column | **≤ 5**, unless a sidebar, tabs or a table carry the rest | past five, sections need a structure, not a longer page |
| Dashboard panels | **≤ 6** | pick the ones that answer "is anything wrong?" |
| Line length | **≤ ~80 characters** of body copy | long lines are read once and skimmed forever |

A page that genuinely needs more is two pages, or one page with tabs.

## Where each kind of thing goes

| The thing is… | It goes in… | Not in… |
| --- | --- | --- |
| the reason the page exists | the main column, first viewport | below the fold |
| supporting facts about the subject (status, owner, dates, summary) | a **sidebar**, one third of the width | a card between the main sections |
| an independent section of equal weight | a **tab** | the next card down |
| advanced or rarely-changed options | a **collapsible** section, closed by default | always-open fields |
| confirmation that something worked | a **toast** | a success banner that stays on the page |
| a question the user must answer before continuing ("Delete 'Acme'?") | a **modal** | a banner with Confirm / Cancel buttons |
| a persistent condition the user must act on (billing failed, setup incomplete) | **one banner**, top of the page | several banners, or a banner per section |
| a field-level problem | inline under the field | a banner |

### Banners are a queue, not a list

Conditions compete for the one banner slot in priority order:

1. critical — the page cannot do its job (load failed, permission missing)
2. warning — the user is about to lose something (plan limit, expiring token)
3. info — something they should know, but can ignore

Show the highest. The rest are either resolved by fixing the first, or belong
in a notification centre, a sidebar card, or the relevant field.

### Success is a toast

Success is momentary. A success banner stays on the page after the moment has
passed, pushes the content down, and teaches the user to ignore banners — so the
critical one gets ignored too. Show a toast, and let the page's new state be the
lasting confirmation.

### Confirmation is a modal

A banner cannot stop the user from doing something else, so it cannot be a
confirmation. If the action needs a yes before it happens, it is a modal that
names the object and puts the safe action on the default focus — see
[microcopy.md](microcopy.md).

## Settings pages: title left, card right

A settings page is a list of groups, and the group's explanation is not content.
Put each group's title and one-line description in a narrow left column and its
controls in a card on the right. The page halves in height compared with a card
per group that repeats its own heading, and the user scans titles down the left
edge instead of reading every card.

## Forms: the save action stays reachable

A long form whose Save button sits at the bottom forces a scroll to finish every
edit. Keep the save action in a persistent place — a contextual save bar that
appears when the form is dirty, or a header action — so the primary action never
leaves the first viewport.

## How to fix a scrolly page

Walk it in this order, measuring after each step:

1. **Delete.** Anything that does not serve the page's one job.
2. **Collapse the banners** to one, and turn success banners into toasts.
3. **Move facts to a sidebar.** Status, summary and metadata cards.
4. **Split equal sections into tabs**, or into separate routes.
5. **Collapse the advanced options.**
6. **Re-shape settings** into title-left / card-right.

## How this is checked

The platform section below names the gates. The page-height, banner, card-stack
and first-viewport rules are measured in a real browser by `ui-probe` wherever
the platform ships one; the banner-as-confirmation and success-banner rules are
read from source by `ui-lint`.
