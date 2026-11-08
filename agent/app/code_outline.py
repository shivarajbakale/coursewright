"""An outline of a source file by tree-sitter: its classes, functions, methods and types with their lines.

The tutor uses it to find its way around a large file without reading all of it, and to find where a name
is defined. Grammars are the per-language tree-sitter wheels (Python, JavaScript, TypeScript and TSX, Go,
Rust, Java); a file in another language has no outline.
"""

from __future__ import annotations

from functools import cache

SUPPORTED = ("Python", "JavaScript", "TypeScript", "Go", "Rust", "Java")
_EXT = {
    ".py": "python", ".pyi": "python",
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".ts": "typescript", ".mts": "typescript", ".cts": "typescript", ".tsx": "tsx",
    ".go": "go", ".rs": "rust", ".java": "java",
}

# node type -> kind, per grammar family. A node of these types is a definition when it has a name.
_KINDS = {
    "python": {"class_definition": "class", "function_definition": "function"},
    "js": {
        "class_declaration": "class", "abstract_class_declaration": "class", "class": "class",
        "function_declaration": "function", "generator_function_declaration": "function",
        "method_definition": "method", "interface_declaration": "interface",
        "type_alias_declaration": "type", "enum_declaration": "enum", "variable_declarator": "function",
        "abstract_method_signature": "method", "internal_module": "namespace",
    },
    "go": {"function_declaration": "function", "method_declaration": "method", "type_spec": "type"},
    "rust": {
        "function_item": "function", "function_signature_item": "function", "struct_item": "struct",
        "enum_item": "enum", "trait_item": "trait", "impl_item": "impl", "mod_item": "module",
        "type_item": "type", "macro_definition": "macro",
    },
    "java": {
        "class_declaration": "class", "interface_declaration": "interface", "enum_declaration": "enum",
        "record_declaration": "record", "method_declaration": "method", "constructor_declaration": "constructor",
    },
}
_FAMILY = {"python": "python", "javascript": "js", "typescript": "js", "tsx": "js", "go": "go", "rust": "rust", "java": "java"}
_FUNCTION_VALUES = {"arrow_function", "function_expression", "function", "generator_function"}


def language_for(path: str) -> str | None:
    dot = path.rfind(".")
    return _EXT.get(path[dot:].lower()) if dot >= 0 else None


@cache
def _parser(lang: str):
    import tree_sitter as ts

    if lang == "python":
        import tree_sitter_python as m

        capsule = m.language()
    elif lang == "javascript":
        import tree_sitter_javascript as m

        capsule = m.language()
    elif lang in ("typescript", "tsx"):
        import tree_sitter_typescript as m

        capsule = m.language_tsx() if lang == "tsx" else m.language_typescript()
    elif lang == "go":
        import tree_sitter_go as m

        capsule = m.language()
    elif lang == "rust":
        import tree_sitter_rust as m

        capsule = m.language()
    else:
        import tree_sitter_java as m

        capsule = m.language()
    return ts.Parser(ts.Language(capsule))


def _text(node, src: bytes) -> str:
    return src[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _name(node, family: str, src: bytes) -> str | None:
    if family == "rust" and node.type == "impl_item":
        t, tr = node.child_by_field_name("type"), node.child_by_field_name("trait")
        if t is None:
            return None
        return f"{_text(tr, src)} for {_text(t, src)}" if tr is not None else _text(t, src)
    if family == "js" and node.type == "variable_declarator":
        value = node.child_by_field_name("value")
        if value is None or value.type not in _FUNCTION_VALUES:
            return None
    n = node.child_by_field_name("name")
    if n is None:
        return None
    if family == "go" and node.type == "method_declaration":
        recv = node.child_by_field_name("receiver")
        owner = _go_receiver(recv, src) if recv is not None else ""
        return f"{owner}.{_text(n, src)}" if owner else _text(n, src)
    return _text(n, src)


def _go_receiver(params, src: bytes) -> str:
    """`(s *Server[T])` -> `Server`."""
    import re

    m = re.search(r"\*?\s*([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*\)\s*$", _text(params, src))
    return m.group(1) if m else ""


def _container(node, family: str, name: str, src: bytes) -> str:
    """The name nested definitions are qualified by: an impl's type, not "Trait for Type"."""
    if family == "rust" and node.type == "impl_item":
        return _text(node.child_by_field_name("type"), src)
    return name


def outline(path: str, text: str) -> list[dict]:
    """[{"name", "kind", "line", "endLine", "depth", "signature"}] in source order; names of nested
    definitions are qualified by their container (`Agent.run`)."""
    lang = language_for(path)
    if not lang:
        return []
    family = _FAMILY[lang]
    kinds = _KINDS[family]
    src = text.encode("utf-8")
    root = _parser(lang).parse(src).root_node
    out: list[dict] = []

    def walk(node, parents: list[str]) -> None:
        for child in node.named_children:
            kind = kinds.get(child.type)
            name = _name(child, family, src) if kind else None
            if name:
                qual = ".".join([*parents, name])
                first = _text(child, src).splitlines()[0].strip() if child.end_byte > child.start_byte else ""
                out.append({
                    "name": qual, "kind": kind, "line": child.start_point[0] + 1, "endLine": child.end_point[0] + 1,
                    "depth": len(parents), "signature": first[:160],
                })
                inner = parents if family == "js" and kind == "function" else [*parents, _container(child, family, name, src)]
                walk(child, inner)
            else:
                walk(child, parents)

    walk(root, [])
    return out
