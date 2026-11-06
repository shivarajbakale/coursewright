# Explainers: a hand-drawn picture of the lesson's idea

You add one explainer to a lesson, sometimes two. An explainer is an Inkling drawing: a few lines of text
that become a hand-drawn diagram which draws itself step by step, right after the paragraph it pictures. It
is the picture a good teacher sketches on the board while saying that paragraph.

## When one, when two

- One is the normal case: the single idea the lesson is about.
- Two only when the lesson has two ideas a reader must see separately (a structure and then the order
  things happen in it; a before and an after). Never two pictures of the same idea.
- A lesson that is a list of facts still gets one: draw how the facts relate, not the list.

## Choose the layout from the idea, not from habit

Read the paragraph and ask what shape the idea has. Courses must not repeat one template; across a course
the layouts should vary because the ideas do.

| The idea is ... | Layout | Example |
| --- | --- | --- |
| things passing through steps, a decision, a system's parts and what flows between them | `flow` (default; `layout down` when tall) | a request through a server |
| who sends what to whom, in order | `sequence` | a model asks for a tool, the harness runs it, returns the result |
| something that repeats until a condition | `cycle` | think, act, look, repeat |
| layers, each built on the one below | `stack` | the app, the harness, the model |
| events or versions over time | `timeline` (prefer `layout down`-style short lists) | how a context window fills over a session |
| two or three approaches side by side | `compare` | streaming vs waiting for the whole reply |
| one idea and its parts | `mindmap` | what a system prompt contains |

`free` exists for exact positions; you will rarely need it.

## House rules

- Label in the course's own words: the names the lesson uses, never a term the lesson has not explained.
- 3 to 9 things. Labels two to four words; detail goes in a `note`.
- Steps tell the story in the order the paragraph tells it, 3 to 6 steps, each with a caption that says
  the idea in plain words ("The tool's result goes back to the model"), not a label ("Step 2").
- A step draws the things it names that no earlier step drew, plus every arrow whose two ends are then
  drawn. So each step must bring in at least one new thing; a step that only names things already drawn
  is empty and is dropped. Order the steps by when each thing first matters. In a `sequence`, where the
  messages are the story, use `steps auto` (one message per step) instead of step lines.
- One mark (`circle`, `highlight`, `underline`) on the single most important thing, if any.
- A `title` line that names the idea in a few words. No `paper`, `pen` or `hand` lines: the app picks the
  look from the reader's theme.
- It must read on a phone: at most about 5 boxes side by side; more and you use `layout down`.

## The language (Inkling)

One statement per line; `#` starts a comment.

```
title "How a tool call works"
layout down                       # right (default) or down, for flow
api: box "API"                    # name: shape "Label"; shapes: box round circle diamond cloud db sticky person text
db: db "Orders\nDB"               # \n breaks a label
cdn: icon cloud "CDN"             # icons: person server database cloud phone laptop lock key mail file folder gear chart globe clock bell cart card chat search star heart bolt bug rocket book camera code link check
big: box "Big idea" yellow        # fills: yellow pink green blue orange purple red gray
a -> b : "label"                  # arrow; --> dashed (a reply), ~> squiggly (eventually), <-> both ways
a -> b -> c                       # a chain
group backend "Backend" { api, db }
circle api                        # marks: circle underline strike highlight check cross
note api "slow!"                  # a margin note with an arrow
step 1: user, app "You ask to sign in"   # names, then the caption
steps auto                        # or: every node is a step, in source order
```

Layouts other than flow:

```
layout sequence                   # participants left to right, messages top to bottom
you: person "You"
app: box "App"
you -> app : "question"
app --> you : "answer"            # --> is a reply; a -> a is a loop on one lifeline
activate app                      # a narrow box on the lifeline until deactivate app
steps auto                        # one message per step: the usual choice here
```

```
layout cycle
center "the loop"
think: circle "Think"
act: circle "Act"
look: circle "Look"
cycle think, act, look            # arrows think->act->look->think
```

```
layout stack                      # top-level bullets are layers, top to bottom
- Your app
- The harness
  - Tools
  - Memory
- The model
brace your-app..the-harness "your code"    # ids are slugs of the bullet text
```

```
layout timeline
- 1: You ask
- 2: The model plans
- 3: A tool runs
span 2..3 "one turn"
```

```
layout compare
columns "Waiting", "Streaming"
row "First words": "after 8 s", "after 0.4 s"!   # a trailing ! circles the winner
row "Can stop early": no, yes                    # yes = tick, no = cross, partly = wavy tick
```

```
layout mindmap
- System prompt
  - Who the model is
  - The rules
  - The tools
```

Marks and steps work in every layout. Steps name nodes by their id (`step 1: think "..."`); in bullet
layouts the id is the slug of the text (`the-harness`), in compare `waiting`, `first-words`, `first-words.waiting`.

## Where it goes

`after` is the opening words of the paragraph the drawing follows, copied exactly from the lesson (eight
words or more, enough to find it). Pick the paragraph that explains the idea, not the introduction and not
the wrap-up. Never inside a code block, a list or a quote.

Writing a course folder yourself (through the MCP or by hand): put the drawing in the lesson's markdown as
a fence on its own lines, after that paragraph and a blank line:

````md
```inkling
title "The agent loop"
layout cycle
...
```
````

Check the body with check_inkling (or `check_course`) until it has no errors.
