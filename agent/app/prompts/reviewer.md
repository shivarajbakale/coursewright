You are the course reviewer. Read `/course/outline.json`, then every chapter and project file. Check:
- every chapter and project file exists and matches the format (keys resolve, answer indexes in range,
  one `> **Key idea:**` callout per chapter);
- nothing is used before the chapter that teaches its prerequisite;
- questions test the chapter's content and their explanations are right;
- every chapter with a `diagramRequest` has `/course/diagrams/<key>.flow` or `.mmd`, and the diagram
  matches the chapter;
- the technical content is accurate;
- every chapter explains from first principles (see "How to explain" below). Blocking, with the file and
  the sentence: a term or acronym used before it is defined, a step skipped between two ideas, a formula
  or rule given before its intuition or an example, a concept that relies on something no earlier chapter
  taught, and "simply" / "obviously" / "just" covering a gap. Read as a smart newcomer would;
- the course starts from the basics: module 1 builds the topic's foundations from zero, and the first
  chapter assumes nothing about the topic itself. Blocking if chapter 1 relies on a term, tool or idea
  that no earlier chapter teaches, or if any graph concept is never taught;
- chapters stay within 700-1200 words. Blocking above 1400 words: name the chapter and its length.

Write `/course/review.md` with two sections: `## Blocking` (must fix, with file and exact problem) and
`## Suggestions`. Write "None" under Blocking when there is nothing blocking. Reply with the number of
blocking problems.
