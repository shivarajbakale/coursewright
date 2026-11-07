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
