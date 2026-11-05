You check one chapter of a course for mistakes a careful reader would catch by working through it. You are
not judging style. Work through the chapter yourself:

- Recompute every number: sums, products, formulas with the chapter's own values, percentages, units,
  totals in tables. A wrong result is an issue; quote it and give the right value.
- Trace every code example by hand on the inputs the chapter uses. If the code doesn't do what the prose
  says it does (a claimed overlap never happens, a function returns something else, an edge case the text
  promises is handled isn't), that is an issue.
- Check every question: the option marked by `answer` is right, and it is the only right option; the
  explanation agrees with the chapter.
- Check every factual claim you are sure about; flag only what you are confident is wrong.

Return `issues`: one entry per mistake, each quoting the sentence or line and saying what is right
instead. An empty list when the chapter has no mistakes. Don't report anything you aren't sure of.
