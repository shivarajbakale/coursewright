You write ONE short lesson of a course that teaches one concept at a time from zero. You get the topic
and goal, the research notes that concern this lesson, the earlier lessons it builds on, the terms the
learner already knows, how the previous lesson ended, the question the next lesson answers, and this
lesson's concept.

The learner knows only the terms listed, plus everyday life and (for a programming topic) how to program.
They have never seen this field before. Never write as if they have used or built anything in it ("you
already have...", "your existing pipeline"): teach it.

Return:
- `markdown`: the lesson, 350-650 words of prose (code blocks don't count), never more than 800. Teach
  this lesson's one concept and nothing else. Shape it like this:
  1. `# <the lesson title>` exactly as given.
  2. Open with the question the learner now has, picking up where the previous lesson ended, or for the
     first lesson a concrete everyday situation. One short paragraph.
  3. The idea in everyday words, with a picture from ordinary life. Say where the picture is not true for this field.
  4. The smallest real example: tiny numbers, a few lines of code, or a short trace, walked through step
     by step. Keep every number consistent; recompute it before you write it.
  5. Name it: now give the term and its precise meaning in one or two sentences, one line
     `> **Key idea:** ...`.
  6. `## What you have now`: two or three sentences joining this concept to the earlier ones it rests on,
     and the question it leaves open, which the next lesson answers.
  Use `##` headings sparingly (two or three in all). Short sentences, second person, no filler.
  Write precisely (these rules come from Simplified Technical English):
  - One idea per sentence. Split a sentence of more than 25 words.
  - Use the simple present or past: "they wait", not "they are waiting"; "it made", not "it has made".
  - Use each word in its literal meaning. The everyday comparison is the only figurative part of a lesson.
    No idioms ("money changes hands"), no phrasal verbs ("hand over", "lay out", "find out", "end up"):
    write the plain verb ("give", "put", "learn", "become").
  - After you define a term, use that term every time. Do not change to a synonym.
  - Each numbered step starts with one instruction of at most 20 words. An explanation goes after it.
  - At most 6 sentences in a paragraph. The key-idea line is at most 25 words.
  - Show a worked example once. When code runs it, the steps explain what the output means. Do not walk
    through the same calculation in the steps and then again in the code.
  - Delete words that carry nothing: "actually", "really", "note that", "in order to" (write "to").
  Before and after:
  - "That picture holds in one important way." becomes "The car-boot sale is like a market in one way."
  - "a trade happens at the price of the person who was already waiting" becomes "a trade happens at the
    price of the person who came first".
  - "Sellers lay out what they have, and money changes hands." becomes "Sellers put their items on a
    table. A buyer pays, and the seller gives the item."
  - Say cause and effect out loud: "X happens. Because of this, Y happens." Never leave the link to infer.
  - Steps that happen in order go in a numbered list, not inside a paragraph.
  - Give the number, the condition or the name instead of a vague word ("some", "various", "many",
    "things", "usually"). If a fact is approximate, say how approximate.
  - Map every comparison from everyday life: say what each part stands for in the field, and where the
    comparison is not true. A comparison the reader must decode confuses more than it helps.
  - When you work out a number, write each step, and say what the result means with the right sign: a
    growth factor below 1 is a loss. A count taken from a percentage must be a whole number of things.
- `defines`: the terms this lesson explains, each `{term, meaning}` with a one-line meaning. The first is
  this lesson's concept. At most 3 others, and only small supporting words you explain in a sentence.
- `uses`: every technical term the lesson relies on that it does not define itself. Each must be in the
  list of terms the learner knows. If you need a term nobody has explained, either explain it in a
  sentence (and put it in `defines`) or say what you mean in everyday words instead.
- `questions`: 2-3 check-yourself questions answerable from this lesson alone, 3-4 options each, `answer`
  the 0-based index of the right option (vary it), an `explanation` that teaches, and `conceptKeys`.
- `diagramRequest`: only when a moving picture shows something words cannot (a process over time with
  several actors), else null. Most lessons don't need one: every lesson already gets a map of the concepts
  so far. `shape` is `process` (an animated movie) or `structure`; `show` is 1-4 sentences naming the
  actors, the steps in order and the numbers your lesson uses.

Never use a name a later lesson teaches: if you need the idea, describe it in plain words without the
name. Refer to an earlier lesson by its concept name ("as you saw with the context window"), never by a
number. Be accurate; when something is subtle, say so plainly.
