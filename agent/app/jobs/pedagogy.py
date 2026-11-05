"""Teaching rules that code can check: lesson titles, prose that assumes the learner knows the topic,
terms used before a lesson defines them, and the "your map so far" diagram every lesson ends with.

The pipeline (app/jobs/pipeline.py) uses these to send a lesson or an outline back; the teaching eval
(evals/teaching.py) uses the same functions to score a course, so a build and its measurement agree.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# ---- titles -----------------------------------------------------------------------------------------

NAME_WORDS = 5  # the concept's name: "The context window", "Tool calling"
PLAIN_WORDS = 9  # what it is, in plain words: "what the model can see at once"
# Slogans and teasers instead of a description: "State, not conversation", "From a pipeline to a loop",
# "Why X breaks", "Capstone: the service, reviewed", "Your first state graph".
SLOGAN = re.compile(
    r"^(from|why|beyond|meet|enter|inside|towards?|your first|putting it|the road|the art)\b"
    r"|,\s*not\b|\bvs\.?\b|\breviewed\b|\brevisited\b|\bdemystified\b|\bunder the hood\b"
    r"|\b(101|deep dive|crash course)\b|[?!]",
    re.I,
)


def _words(s: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9][\w'+.-]*", s)


def lesson_title(name: str, plain: str) -> str:
    """The one title shape: `<concept name>: <what it is in plain words>`."""
    name, plain = name.strip().rstrip(":"), plain.strip().rstrip(".")
    if plain and plain[0].isupper() and not plain[:2].isupper():  # "What the model sees" -> "what the model sees"
        plain = plain[0].lower() + plain[1:]
    return f"{name}: {plain}" if plain else name


def title_problems(title: str, concept: str | None = None) -> list[str]:
    """What is wrong with a lesson title, if anything. With `concept`, the title must start with it."""
    problems = []
    name, sep, plain = title.partition(":")
    if not sep and concept and _norm(title) == _norm(concept) and len(_words(title)) <= NAME_WORDS:
        pass  # the bare concept name is plain enough ("Tool calling")
    elif not sep or not plain.strip():
        problems.append(f'"{title}" is not "<concept>: <what it is in plain words>".')
    else:
        if len(_words(name)) > NAME_WORDS:
            problems.append(f'"{title}": the concept part has more than {NAME_WORDS} words.')
        if len(_words(plain)) > PLAIN_WORDS:
            problems.append(
                f'"{title}": the plain-words part has {len(_words(plain))} words; say it in at most {PLAIN_WORDS}.'
            )
    if SLOGAN.search(title):
        problems.append(f'"{title}" reads as a slogan or teaser; say plainly what the lesson explains.')
    if concept and not _norm(title).startswith(_norm(concept)):
        problems.append(f'"{title}" does not start with the concept it teaches, "{concept}".')
    return problems


def concept_name_problems(name: str) -> list[str]:
    """A name joining two ideas ("Tokens and the context window") is two lessons."""
    if re.search(r"\b(and|&|plus)\b|/", name, re.I):
        return [f'"{name}" names more than one concept: split it into one lesson per idea.']
    return []


def pace_lessons(pace: str) -> tuple[int, int]:
    """The lesson count a pace asks for: a few weeks 20-35, one to two months 35-60, three or more 60-90."""
    text = (pace or "").lower()
    months = re.search(r"(\d+(?:\.\d+)?)\s*(?:\+\s*)?months?", text)
    weeks = re.search(r"(\d+)\s*(?:\+\s*)?weeks?\b(?!\s*/)", text)
    span = float(months.group(1)) if months else (int(weeks.group(1)) / 4.3 if weeks else None)
    if span is None:
        return (0, 90)  # no pace given: only the course-wide bounds
    if span >= 3:
        return (60, 90)
    if span >= 1:
        return (35, 60)
    return (20, 35)


def module_title_problems(title: str) -> list[str]:
    if len(_words(title)) > 8:
        return [f'Module title "{title}" is over 8 words.']
    if SLOGAN.search(title) or ":" in title:
        return [f'Module title "{title}" reads as a slogan; say plainly what the module covers.']
    return []


# ---- prose that assumes the learner already knows the topic ----------------------------------------

ASSUMES = re.compile(
    r"\byou (already|probably|likely) (know|have|use|built|run|understand|shipped)\b"
    r"|\byou(?:'ve| have) (already )?(built|shipped|used|seen|deployed|run)\b"
    r"|\bas you know\b|\byour (existing|current) (pipeline|system|setup|stack|service|rag|index)\b"
    r"|\b(you are|you're) (already )?familiar with\b|\ba quick recap\b|\bas a refresher\b",
    re.I,
)


def assumes_experience(text: str) -> list[str]:
    """Each sentence that leans on the learner's experience instead of teaching."""
    out = []
    for m in ASSUMES.finditer(text):
        start = max(text.rfind(".", 0, m.start()), text.rfind("\n", 0, m.start())) + 1
        end = text.find(".", m.end())
        out.append(text[start: end + 1 if end >= 0 else len(text)].strip()[:200])
    return out


# ---- terms ------------------------------------------------------------------------------------------


def _norm(s: str) -> str:
    """Lowercase words with plurals folded, so "Embeddings" matches "embedding" and "stores" "store"."""
    out = []
    for w in re.findall(r"[a-z0-9]+", s.lower()):
        if w in ("the", "a", "an"):
            continue
        if len(w) > 3 and w.endswith("ies"):
            w = w[:-3] + "y"
        elif len(w) > 3 and re.search(r"(ss|x|ch|sh|z)es$", w):
            w = w[:-2]
        elif len(w) > 3 and w.endswith("s") and not w.endswith(("ss", "us", "is")):
            w = w[:-1]
        out.append(w)
    return " ".join(out)


def is_distinctive(term: str) -> bool:
    """A term a newcomer can't read as an everyday word: several words, an acronym, or CamelCase.
    "state" and "tool" stay everyday words; "LangGraph", "RAG" and "context window" don't."""
    t = term.strip()
    return len(_words(t)) >= 2 or bool(re.search(r"[A-Z]{2,}|[a-z][A-Z]|\d", t))


@dataclass
class Glossary:
    """The terms the learner has met so far, in reading order."""

    terms: dict[str, str]  # normalised -> as written

    @classmethod
    def of(cls, terms: list[str]) -> "Glossary":
        return cls({_norm(t): t for t in terms if t.strip()})

    def knows(self, term: str) -> bool:
        n = _norm(term)
        if not n:
            return True
        if n in self.terms:
            return True
        # "vector store" is known once "vector stores" or "a vector store" is; a longer known term covers a
        # shorter one inside it only for single words ("embedding" inside "embedding model").
        return any(n == k or (" " not in n and re.search(rf"\b{re.escape(n)}\b", k)) for k in self.terms)

    def unknown(self, used: list[str]) -> list[str]:
        return [t for t in used if not self.knows(t)]


def mentions(text: str, term: str) -> bool:
    """Whether the prose (code blocks left out) names `term`."""
    prose = _norm(re.sub(r"```.*?```", " ", text, flags=re.S))
    n = _norm(term)
    return bool(n) and re.search(rf"(?<![a-z0-9]){re.escape(n)}(?![a-z0-9])", prose) is not None


def future_terms(text: str, later: list[str]) -> list[str]:
    """Distinctive names of concepts later lessons teach that this lesson already uses."""
    return [t for t in later if is_distinctive(t) and mentions(text, t)]


# ---- the map so far ---------------------------------------------------------------------------------


def _label(s: str) -> str:
    return s.replace('"', "'").replace("[", "(").replace("]", ")")


def map_so_far(lessons: list[tuple[str, str]], edges: list[tuple[str, str]], upto: int, limit: int = 12) -> str:
    """A Mermaid picture of what the learner has built: the lesson at `upto` (highlighted), the lessons
    before it in the same run, and the earlier ideas it rests on. `lessons` is (key, name) in reading
    order; `edges` is (prerequisite, concept)."""
    keys = [k for k, _ in lessons]
    names = dict(lessons)
    here = keys[upto]
    pos = {k: i for i, k in enumerate(keys)}
    before = {k for k in keys[: upto + 1]}
    # The new idea, what it rests on (two steps back), and the most recent lessons, capped.
    keep = [here]
    frontier = [here]
    for _ in range(2):
        frontier = [a for a, b in edges if b in frontier and a in before]
        keep += [k for k in frontier if k not in keep]
    for k in reversed(keys[:upto]):
        if len(keep) >= limit:
            break
        if k not in keep:
            keep.append(k)
    keep = sorted(keep[:limit], key=lambda k: pos[k])
    ids = {k: f"n{pos[k]}" for k in keep}
    lines = ["%% title: Your map so far", "flowchart LR"]
    for k in keep:
        lines.append(f'  {ids[k]}["{_label(names[k])}"]')
    drawn = False
    for a, b in edges:
        if a in ids and b in ids:
            lines.append(f"  {ids[a]} --> {ids[b]}")
            drawn = True
    if not drawn and len(keep) > 1:  # no edges among them: show the reading order instead
        for a, b in zip(keep, keep[1:]):
            lines.append(f"  {ids[a]} -.-> {ids[b]}")
    lines.append(f"  classDef new stroke-width:3px")
    lines.append(f"  class {ids[here]} new")
    return "\n".join(lines) + "\n"
