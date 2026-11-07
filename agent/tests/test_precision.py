"""Precision checks from Simplified Technical English: long sentences, vague wording, wrong arithmetic,
and the median beginner reading."""

from app.jobs import pipeline, precision
from app.jobs.pipeline import ReaderOut, Stuck


def test_written_out_arithmetic_is_recomputed_at_the_precision_it_is_printed():
    assert precision.arithmetic_errors("So 1.01⁵ × 0.99⁵ = 1.0510 × 0.9510 = 0.9995 overall.") == []
    wrong = precision.arithmetic_errors("So 1.01⁵ × 0.99⁵ = 1.0510 × 0.9510 = 1.0995 overall.")
    assert len(wrong) == 1 and "0.999501" in wrong[0]
    assert precision.arithmetic_errors("| 6 | 1.01⁶ × 0.99⁴ = 1.0615 × 0.9606 = 1.0197 |") == []
    assert precision.arithmetic_errors("Ten trades cost 10 × 0.15% = 1.5%, and 4,000 × 0.25 = 1,000.") == []
    assert precision.arithmetic_errors("Signal return = (90 / 95) - 1 ≈ -0.053, negative.") == []
    assert len(precision.arithmetic_errors("So 3 × 4 = 13.")) == 1


def test_prose_shorthand_and_code_are_not_read_as_calculations():
    assert precision.arithmetic_errors("Its fitted returns are −0.5 + 1.5 = 1 and −0.5 − 1.5 = −2.") == []
    assert precision.arithmetic_errors("(1.5 × 1.5 + (−1.5) × (−1.5)) / (1.5^2 + 1.5^2) = 4.5 / 4.5 = 1.") == []
    assert precision.arithmetic_errors("`100 × e^(-0.05) = 95.1229`") == []
    assert precision.arithmetic_errors("Hits: 3 = 3/3, and 90 = 100 × 1.05 is not it.") == []
    assert precision.arithmetic_errors("```python\nx = 2 * 3 = 7\n```") == []


def test_long_and_vague_sentences_are_counted_outside_code_tables_and_headings():
    long = "Word " + " ".join(["word"] * 29) + "."
    md = f"# Title\n\n{long} {long}\n\n```\n{long}\n```\n\n| {long} |\n\nShort one here."
    assert len(precision.long_sentences(md)) == 2
    vague = "Some orders cannot be filled. Various things push prices. It usually tends to work. 55% of trades win."
    assert len(precision.vague_sentences(vague)) == 3


def test_the_problems_name_the_sentences_and_only_past_the_allowance():
    long = "Word " + " ".join(["word"] * 29) + "."
    assert precision.problems(" ".join([long] * precision.LONG_LIMIT)) == []
    found = precision.problems(" ".join([long] * (precision.LONG_LIMIT + 1)))
    assert len(found) == 1 and "over 25 words" in found[0]
    assert pipeline.problem_kind(found[0]) in pipeline.SOFT_KINDS
    wrong = precision.problems("So 3 × 4 = 13.")
    assert pipeline.problem_kind(wrong[0]) == "arithmetic is wrong"
    assert "arithmetic is wrong" not in pipeline.SOFT_KINDS  # a wrong number is never allowed to stay


def test_the_median_reading_is_kept():
    def r(n):
        return ReaderOut(stuck=[Stuck(quote=str(i)) for i in range(n)])
    assert len(pipeline.median_read([r(0), r(10), r(8)]).stuck) == 8
    assert len(pipeline.median_read([r(4)]).stuck) == 4
    assert len(pipeline.median_read([r(2), r(6)]).stuck) == 2


def test_progressive_and_perfect_verbs_are_found_but_adjectives_and_field_terms_are_not():
    md = ("The buyer at 30 is still waiting. The order has filled. You have learned it. Keep going until it ends. "
          "The file is missing. There is nothing more. The desk is trading, and a model finished training.")
    hits = " ".join(precision.verb_forms(md, ["trading", "model training"]))
    for h in ("is still waiting", "has filled", "have learned", "Keep going"):
        assert h in hits
    for h in ("is missing", "is nothing", "is trading", "finished training"):
        assert h not in hits
    assert precision.verb_forms("The need has a seed. They had a hundred.") == []


def test_figurative_and_wordy_phrases_name_the_plain_word():
    hits = precision.plain_word_hits("Sellers lay out what they have and money changes hands. That picture "
                                     "stops holding here. In order to sell, she hands over the ticket.")
    text = " ".join(hits)
    assert len(hits) == 5 and "write 'give'" in text and "write 'to'" in text and "stops holding" in text
    assert precision.plain_word_hits("Sellers put their items on a table. The layout is clear.") == []


def test_steps_paragraphs_key_idea_and_closing_are_measured():
    long_step = "Sort " + " ".join(["the"] * 21) + " buyers. Then wait."
    md = (f"1. {long_step}\n2. Pair them.\n3. **Sandbox.** {' '.join(['word'] * 30)}.\n\n"
          + "One is here. Two is here. Three is here. Four is here. Five is here. Six is here. Seven is here.\n\n"
          + "> **Key idea:** " + " ".join(["idea"] * 26) + ".\n\n## What you have now\n\n"
          + "First one here. Second one here. Third one here. Fourth one here. Fifth one here.\n")
    assert precision.long_steps(md) == [long_step.split(" Then")[0]]
    assert len(precision.long_paragraphs(md)) == 1
    assert precision.key_idea_words(md) == 26
    assert precision.wrap_up_sentences(md) == 5
    kinds = {pipeline.problem_kind(p) for p in precision.problems(md)}
    assert {"steps are long", "paragraphs are long", "key-idea line", "closing section"} <= kinds
    assert kinds <= pipeline.SOFT_KINDS  # style is revised once, never a reason to throw a lesson away


def test_a_clean_lesson_passes_and_the_report_counts_per_course():
    clean = ("# A market\n\nA market matches buyers with sellers. Each match is a trade.\n\n"
             "> **Key idea:** A market matches buyers with sellers.\n\n## What you have now\n\n"
             "You know what a trade is. What is a share?\n")
    assert precision.problems(clean) == []
    rows = precision.report([("c", clean), ("c", clean + "They are waiting. It has gone. We are going.")])
    assert rows[0]["lessons"] == 2 and rows[0]["verb forms /100 sentences"] > 0 and rows[0]["sent back %"] == 50
