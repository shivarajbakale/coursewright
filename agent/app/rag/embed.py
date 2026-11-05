"""Embeddings: Voyage when VOYAGE_API_KEY is set, else a deterministic hashed bag-of-words embedder.

Both produce 1024-dim, L2-normalised float32 vectors so they fit the same vec0 table. Switching between
them changes `embed_model` on new chunks; startup schedules a reindex when stored chunks disagree.
"""

from __future__ import annotations

import hashlib
import math
import re

from app import config

_TOKEN = re.compile(r"[a-z0-9]+")
_STOP = frozenset(
    "a an and are as at be by for from has have how in is it its of on or that the this to was what when "
    "where which who why will with does do can you your i we our they".split()
)


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if t not in _STOP]


def _stem(t: str) -> str:
    for suf in ("ing", "ions", "ion", "es", "ed", "s"):
        if len(t) > len(suf) + 3 and t.endswith(suf):
            return t[: -len(suf)]
    return t


def _bucket(feature: str) -> tuple[int, float]:
    h = hashlib.blake2b(feature.encode(), digest_size=8).digest()
    n = int.from_bytes(h, "little")
    return n % config.EMBED_DIMS, (1.0 if (n >> 63) & 1 else -1.0)


def local_embed(text: str) -> list[float]:
    vec = [0.0] * config.EMBED_DIMS
    toks = [_stem(t) for t in tokenize(text)]
    counts: dict[str, int] = {}
    for t in toks:
        counts[t] = counts.get(t, 0) + 1
    for a, b in zip(toks, toks[1:]):
        key = f"{a}_{b}"
        counts[key] = counts.get(key, 0) + 1
    for feat, c in counts.items():
        idx, sign = _bucket(feat)
        weight = 1.0 + math.log(c)
        if "_" in feat:
            weight *= 0.7
        vec[idx] += sign * weight
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


async def embed_documents(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    if config.voyage_key():
        import voyageai

        client = voyageai.AsyncClient(api_key=config.voyage_key())
        out: list[list[float]] = []
        for i in range(0, len(texts), 64):
            res = await client.embed(
                texts[i : i + 64],
                model=config.VOYAGE_EMBED_MODEL,
                input_type="document",
                output_dimension=config.EMBED_DIMS,
            )
            out.extend(res.embeddings)
        return out
    return [local_embed(t) for t in texts]


async def embed_query(text: str) -> list[float]:
    if config.voyage_key():
        import voyageai

        client = voyageai.AsyncClient(api_key=config.voyage_key())
        res = await client.embed(
            [text], model=config.VOYAGE_EMBED_MODEL, input_type="query", output_dimension=config.EMBED_DIMS
        )
        return res.embeddings[0]
    return local_embed(text)


async def rerank(query: str, docs: list[str], top_k: int) -> list[tuple[int, float]] | None:
    """Returns [(index, score)] or None when reranking is unavailable (no Voyage key)."""
    if not config.voyage_key() or not docs:
        return None
    import voyageai

    client = voyageai.AsyncClient(api_key=config.voyage_key())
    res = await client.rerank(query, docs, model=config.VOYAGE_RERANK_MODEL, top_k=top_k)
    return [(r.index, float(r.relevance_score)) for r in res.results]
