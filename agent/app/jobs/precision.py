"""Precision checks on a lesson's prose, from Simplified Technical English (ASD-STE100): sentences that run
too long, vague words with no number to pin them down, and written-out arithmetic that does not add up.

The STE-80 trial (Nov 2026) found lessons that read as vague were often also wrong: loose wording hid a
growth factor below 1 called a gain. Code checks what the writer is only told, because the model follows
a rule it is checked on far more reliably than one it is asked to keep.
"""

from __future__ import annotations

import math
import re

LONG_WORDS = 25  # STE: at most 25 words in a descriptive sentence
LONG_LIMIT = 3  # a lesson may keep this many long sentences (a definition, a quoted rule)
VAGUE_LIMIT = 3  # and this many vague sentences before it is sent back

VAGUE = re.compile(
    r"\b(some|various|several|a lot|lots of|things?|stuff|kind of|sort of|fairly|quite|somewhat|"
    r"usually|tends? to|certain)\b",
    re.I,
)
NOT_VAGUE = re.compile(r"\b(some of the|for some|some (?:one|time)|certain(?:ly)? (?:that|to)|the thing)\b", re.I)
DIGIT = re.compile(r"\d")

_SUP = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")
NUM = r"\d+(?:,\d{3})*(?:\.\d+)?%?"
POW = rf"[−-]?{NUM}(?:\s*\^\s*\d+|[⁰¹²³⁴⁵⁶⁷⁸⁹]+)?"
OP = r"[ \t]*(?:×|\*|÷|/|\+|−|-|\bx\b)[ \t]*"
EXPR = rf"\(?{POW}\)?(?:{OP}\(?{POW}\)?)*"
EQ = r"[ \t]*(?:=|≈)[ \t]*"
CHAIN = re.compile(rf"(?<![\w.,$)(/×*+−^-])(?<![)(/×*+−^-] ){EXPR}(?:{EQ}{EXPR})+(?![\w%]|[.,]\d)")


def prose(md: str) -> str:
    """The lesson's running text: no fenced blocks (code, drawings), headings, tables or quote callouts."""
    md = re.sub(r"```.*?```", " ", md, flags=re.S)
    keep = [line for line in md.splitlines() if not re.match(r"\s*(#|\||>)", line)]
    return "\n".join(keep)


def sentences(md: str) -> list[str]:
    text = re.sub(r"^\s*(\d+\.|[-*])\s+", "", prose(md), flags=re.M)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(*])|\n\s*\n|\n(?=\s*(?:\d+\.|[-*])\s)", text)
    return [" ".join(p.split()) for p in parts if len(re.findall(r"[A-Za-z0-9']+", p)) >= 3]


def _words(s: str) -> int:
    return len(re.findall(r"[A-Za-z0-9][\w'.%-]*", s))


def long_sentences(md: str, limit: int = LONG_WORDS) -> list[str]:
    return [s for s in sentences(md) if _words(s) > limit]


def vague_sentences(md: str) -> list[str]:
    """Sentences that lean on a vague quantity or hedge and give no number to pin it down."""
    out = []
    for s in sentences(md):
        if DIGIT.search(s):
            continue
        if VAGUE.search(NOT_VAGUE.sub(" ", s)):
            out.append(s)
    return out


BINARY = re.compile(r"[\d)%][ \t]*(?:×|\*|÷|/|\+|−|-|\bx\b|\^)[ \t]*[(\d−-]")


def _has_op(seg: str) -> bool:
    """True for a calculation ("90 / 95", "1.01^5"), false for a signed number ("-0.053")."""
    return bool(BINARY.search(seg))


def _decimals(seg: str) -> int:
    ds = [len(m.group(1)) for m in re.finditer(r"\d\.(\d+)", seg)]
    return min(ds) if ds else 0


def _value(seg: str) -> float | None:
    seg = seg.strip().translate(_SUP)
    # A superscript turned into digits sits right after its base: mark it as a power first.
    seg = re.sub(r"(?<=\d)([⁰¹²³⁴⁵⁶⁷⁸⁹])", r"^\1", seg)
    expr = re.sub(r"(\d+(?:\.\d+)?)%", r"(\1/100)", seg.replace(",", ""))
    expr = expr.replace("×", "*").replace("÷", "/").replace("−", "-")
    expr = re.sub(r"\bx\b", "*", expr).replace("^", "**")
    if not re.fullmatch(r"[\d.\s*/+()\-]+", expr):
        return None
    try:
        v = eval(expr, {"__builtins__": {}}, {})  # noqa: S307 - digits and operators only, checked above
    except (SyntaxError, ZeroDivisionError, OverflowError, TypeError):
        return None
    return float(v) if isinstance(v, (int, float)) and math.isfinite(v) else None


def _superscripts(md: str) -> str:
    """1.01⁵ -> 1.01^5, so the expression keeps its power when superscripts are read as digits."""
    return re.sub(r"(?<=\d)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)", lambda m: "^" + m.group(1).translate(_SUP), md)


def arithmetic_errors(md: str) -> list[str]:
    """Written-out calculations ("1.01^5 × 0.99^5 = 1.0510 × 0.9510 = 0.9995") whose sides disagree. Each
    side is compared at the precision it is printed with, so rounding a result is never an error."""
    text = _superscripts(re.sub(r"```.*?```", " ", md, flags=re.S)).replace("|", "\n")
    found = []
    for m in CHAIN.finditer(text):
        chain = m.group(0)
        segs = re.split(EQ, chain)
        if not _has_op(segs[0]):
            continue  # a calculation starts with one; "3 = 3/3" or "90 = 100 × 1.05" is prose shorthand
        vals = [(s, _value(s)) for s in segs]
        if any(v is None for _, v in vals):
            continue
        for (a, va), (b, vb) in zip(vals, vals[1:]):
            d = min(_decimals(a) if not _has_op(a) else 9, _decimals(b) if not _has_op(b) else 9)
            tol = max(0.5 * 10 ** -d * 1.01 if d < 9 else 0, 0.002 * max(abs(va), abs(vb)), 1e-9)
            # 0.21 written as "21" next to a percentage sign elsewhere is a unit slip of the prose, not a
            # wrong calculation: only a value that no power of 100 reconciles is reported.
            if abs(va - vb) > tol and not any(abs(va * k - vb) <= tol * abs(k) for k in (100, 0.01)):
                found.append(f"{chain.strip()} ({a.strip()} is {va:.6g}, not {b.strip()})")
                break
    return found


# ---- clarity and concision (Simplified Technical English) ------------------------------------------------

VERB_LIMIT = 2  # progressive and perfect verbs a lesson may keep before it is sent back
PLAIN_LIMIT = 1  # figurative, phrasal or wordy phrases
STEP_WORDS = 20  # STE: at most 20 words in an instruction; a numbered step's first sentence is one
PARAGRAPH_SENTENCES = 6  # STE: at most six sentences in a paragraph
KEY_IDEA_WORDS = 25
WRAP_UP_SENTENCES = 4  # the prompt asks for two or three; one more is allowed

_NOT_VERB = {"thing", "nothing", "something", "anything", "everything", "string", "spring", "ring", "king",
             "morning", "evening", "ceiling", "during", "sibling", "wing", "bring", "sing", "earnings", "ing",
             # adjectives, not verbs: "the file is missing"
             "missing", "misleading", "interesting", "surprising", "confusing", "willing", "outstanding",
             "existing", "remaining", "amazing", "boring", "exciting", "worrying", "demanding", "promising",
             "tempting", "convincing", "overwhelming", "striking", "revealing", "appealing", "rewarding",
             # counted once, by plain_words.json
             "holding"}
_PARTICIPLES = ("been|done|gone|seen|made|taken|given|written|known|shown|found|got|gotten|paid|sold|bought|"
                "left|lost|won|held|kept|told|said|met|begun|become|come|fallen|risen|chosen|grown|drawn|"
                "built|spent|sent|meant|taught|thought|brought|caught|fought|put|set|cut|hit|run")
_NOT_PARTICIPLE = {"need", "seed", "speed", "feed", "bed", "red", "shed", "greed", "breed", "hundred", "indeed",
                   "proceed", "exceed", "succeed"}
PROGRESSIVE = re.compile(r"\b(?:am|is|are|was|were|be|been|isn't|aren't|wasn't|weren't)\s+"
                         r"(?:(?:still|already|not|now|also|only|always|currently)\s+)?([a-z]+ing)\b", re.I)
PERFECT = re.compile(rf"\b(?:has|have|had|hasn't|haven't|hadn't)\s+(?:(?:already|just|not|now|also|never|only|"
                     rf"since|ever)\s+)?({_PARTICIPLES}|[a-z]{{2,}}ed)\b", re.I)
GERUND_AFTER = re.compile(r"\b(?:keeps?|kept|keeping|stops?|stopped|starts?|started|begins?|began|finish(?:es|ed)?)"
                          r"\s+([a-z]+ing)\b", re.I)
KEY_IDEA_LINE = re.compile(r"^>\s*\*\*Key idea:\*\*(.*)$", re.M)
WRAP_UP_SECTION = re.compile(r"^##\s+What you have now\s*$(.*?)(?=^#|\Z)", re.M | re.S)

_PLAIN: list[tuple[re.Pattern[str], str]] | None = None


def _plain_words() -> list[tuple[re.Pattern[str], str]]:
    global _PLAIN
    if _PLAIN is None:
        import json
        from pathlib import Path

        table = json.loads((Path(__file__).with_name("plain_words.json")).read_text())
        _PLAIN = [(re.compile(rf"\b(?:{k})\b", re.I), v) for k, v in table.items() if not k.startswith("_")]
    return _PLAIN


def _field(terms: list[str] | None) -> set[str]:
    return {w.lower() for t in terms or [] for w in re.findall(r"[A-Za-z]+", t)}


def verb_forms(md: str, terms: list[str] | None = None) -> list[str]:
    """Progressive ("are still waiting") and perfect ("has made") verbs, and an -ing form after keep, stop or
    start. STE uses the simple tenses only: they say what happens with no doubt about when. A field term
    that ends in -ing ("trading") is a name, not a verb, and is left alone."""
    skip = _NOT_VERB | _field(terms)
    out = []
    for s in sentences(md):
        hits = [m.group(0) for rx in (PROGRESSIVE, GERUND_AFTER) for m in rx.finditer(s)
                if m.group(1).lower() not in skip]
        hits += [m.group(0) for m in PERFECT.finditer(s) if m.group(1).lower() not in _NOT_PARTICIPLE]
        out += [f'"{h}" in "{s[:90]}"' for h in hits]
    return out


def plain_word_hits(md: str) -> list[str]:
    """Figurative, phrasal or wordy phrases from plain_words.json, each with the plain word to use."""
    text = "\n".join(sentences(md))
    out = []
    for rx, use in _plain_words():
        for m in rx.finditer(text):
            out.append(f'"{m.group(0)}" ({f"write {use!r}" if use else "delete it"})')
    return out


def long_steps(md: str, limit: int = STEP_WORDS) -> list[str]:
    """Numbered steps whose first sentence, the instruction, runs past the STE limit for an instruction."""
    out = []
    for m in re.finditer(r"^\s*\d+\.\s+(.+)$", prose(md), re.M):
        if m.group(1).lstrip().startswith("**"):
            continue  # "**Sandbox.** The runner wraps..." is a labelled description, not an instruction
        first = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", m.group(1).strip(), maxsplit=1)[0]
        if _words(first) > limit:
            out.append(first)
    return out


def long_paragraphs(md: str, limit: int = PARAGRAPH_SENTENCES) -> list[str]:
    out = []
    for block in re.split(r"\n\s*\n", prose(md)):
        if re.match(r"\s*(\d+\.|[-*])\s", block):
            continue
        n = len(sentences(block))
        if n > limit:
            out.append(f'{n} sentences from "{" ".join(block.split())[:70]}…"')
    return out


def key_idea_words(md: str) -> int:
    m = KEY_IDEA_LINE.search(md)
    return _words(m.group(1)) if m else 0


def wrap_up_sentences(md: str) -> int:
    m = WRAP_UP_SECTION.search(md)
    return len(sentences(m.group(1))) if m else 0


def problems(md: str, terms: list[str] | None = None) -> list[str]:
    out = []
    for e in arithmetic_errors(md):
        out.append(f"This arithmetic is wrong: {e}. Recompute it and fix every sentence that relies on it.")
    long = long_sentences(md)
    if len(long) > LONG_LIMIT:
        shown = "; ".join(f'"{s[:90]}…"' for s in long[:4])
        out.append(f"{len(long)} sentences are over {LONG_WORDS} words long: {shown}. Split each into "
                   "sentences of one idea.")
    vague = vague_sentences(md)
    if len(vague) > VAGUE_LIMIT:
        shown = "; ".join(f'"{s[:90]}"' for s in vague[:4])
        out.append(f"{len(vague)} sentences are vague, with no number or name to pin them down: {shown}. "
                   "Give the number, the condition or the example.")
    verbs = verb_forms(md, terms)
    if len(verbs) > VERB_LIMIT:
        out.append(f"{len(verbs)} verb forms are not simple tenses: {'; '.join(verbs[:4])}. Use the simple "
                   "present or past (\"they wait\", \"it made\") instead of \"are waiting\" or \"has made\".")
    plain = plain_word_hits(md)
    if len(plain) > PLAIN_LIMIT:
        out.append(f"{len(plain)} phrases are figurative or wordy: {'; '.join(plain[:6])}. Use the plain word, "
                   "in its literal meaning.")
    steps = long_steps(md)
    if steps:
        shown = "; ".join(f'"{s[:80]}…"' for s in steps[:3])
        out.append(f"{len(steps)} numbered steps are long: {shown}. Start each step with one instruction of at "
                   f"most {STEP_WORDS} words, and put any explanation in the next sentence.")
    paras = long_paragraphs(md)
    if paras:
        out.append(f"{len(paras)} paragraphs are long: {'; '.join(paras[:3])}. Keep a paragraph to at most "
                   f"{PARAGRAPH_SENTENCES} sentences on one topic.")
    k = key_idea_words(md)
    if k > KEY_IDEA_WORDS:
        out.append(f"The key-idea line has {k} words. Say the one idea in at most {KEY_IDEA_WORDS} words.")
    w = wrap_up_sentences(md)
    if w > WRAP_UP_SENTENCES:
        out.append(f"The closing section has {w} sentences. Join this concept to the earlier ones and ask the "
                   "open question in two or three sentences.")
    return out


def measure(md: str) -> dict[str, float]:
    """Every check's raw count for one lesson, before any allowance: what `prose-report` adds up."""
    from app import inkling

    md = inkling.strip_fences(md, keep_title=False) if "```inkling" in md else md
    ss = sentences(md)
    lengths = [_words(s) for s in ss] or [0]
    return {
        "words": float(sum(lengths)),
        "sentences": float(len(ss)),
        "over 25 words": float(len(long_sentences(md))),
        "vague": float(len(vague_sentences(md))),
        "verb forms": float(len(verb_forms(md))),
        "plain words": float(len(plain_word_hits(md))),
        "long steps": float(len(long_steps(md))),
        "long paragraphs": float(len(long_paragraphs(md))),
        "long key idea": float(key_idea_words(md) > KEY_IDEA_WORDS),
        "long closing": float(wrap_up_sentences(md) > WRAP_UP_SENTENCES),
        "sent back": float(bool([p for p in problems(md) if not p.startswith("This arithmetic")])),
    }


FLAGS = ("over 25 words", "vague", "verb forms", "plain words", "long steps", "long paragraphs", "long key idea",
         "long closing")


def report(lessons: list[tuple[str, str]]) -> list[dict[str, float | str]]:
    """Per course: lessons, mean sentence length, each check's flags per 100 sentences, and the share of
    lessons the checks would send back. The same numbers before and after a prompt change show what it did."""
    by: dict[str, list[dict[str, float]]] = {}
    for course, md in lessons:
        by.setdefault(course, []).append(measure(md))
    rows: list[dict[str, float | str]] = []
    for course, ms in sorted(by.items()):
        n_s = sum(m["sentences"] for m in ms) or 1
        row: dict[str, float | str] = {"course": course, "lessons": float(len(ms)),
                                       "words per sentence": round(sum(m["words"] for m in ms) / n_s, 1)}
        for f in FLAGS:
            row[f"{f} /100 sentences"] = round(100 * sum(m[f] for m in ms) / n_s, 1)
        row["sent back %"] = round(100 * sum(m["sent back"] for m in ms) / len(ms))
        rows.append(row)
    return rows
