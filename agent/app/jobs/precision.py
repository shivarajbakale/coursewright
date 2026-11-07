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


def problems(md: str) -> list[str]:
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
    return out
