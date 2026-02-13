from __future__ import annotations

import json
from typing import Any, Dict, Iterable, List, Optional


def to_data(chart: Any) -> Dict[str, Any]:
    """
    Convert an iztro-py chart object into a plain dict.
    """
    if chart is None:
        raise ValueError("chart is None")

    # Pydantic v2
    model_dump = getattr(chart, "model_dump", None)
    if callable(model_dump):
        return model_dump()

    # Pydantic v1
    to_dict = getattr(chart, "dict", None)
    if callable(to_dict):
        return to_dict()

    # Fallback
    d = getattr(chart, "__dict__", None)
    if isinstance(d, dict):
        return d

    raise TypeError("chart object is not serializable")


def _format_star(star: Dict[str, Any]) -> str:
    name = str(star.get("name", "")).strip()
    if not name:
        return ""
    brightness = str(star.get("brightness", "") or "").strip()
    if brightness:
        return f"{name}({brightness})"
    return name


def _format_star_list(stars: Optional[Iterable[Dict[str, Any]]]) -> str:
    if not stars:
        return "-"
    items = [_format_star(s) for s in stars]
    items = [x for x in items if x]
    return ", ".join(items) if items else "-"


def _t(obj: Any, method: str, language: str) -> str:
    fn = getattr(obj, method, None)
    if not callable(fn):
        return ""
    try:
        v = fn(language)
    except TypeError:
        v = fn()
    if v is None:
        return ""
    return str(v).strip()


def _render_stars(stars: Iterable[Any], language: str) -> str:
    items: List[str] = []
    for s in stars:
        name = _t(s, "translate_name", language) or str(getattr(s, "name", "")).strip()
        brightness = _t(s, "translate_brightness", language)
        if brightness:
            items.append(f"{name}({brightness})")
        elif name:
            items.append(name)
    return ", ".join([x for x in items if x]) if items else "-"


def render_chart(chart: Any, language: str) -> str:
    """
    Prefer rendering from the iztro-py model objects directly so we can translate
    internal IDs into localized palace/star names.
    """
    lines: List[str] = []

    def add_kv(label: str, value: Any) -> None:
        if value is None:
            return
        s = str(value).strip()
        if not s:
            return
        lines.append(f"{label}: {s}")

    add_kv("Solar", getattr(chart, "solar_date", None))
    add_kv("Lunar", getattr(chart, "lunar_date", None))
    add_kv("Ganzhi", getattr(chart, "chinese_date", None))
    add_kv("Time", getattr(chart, "time", None))
    add_kv("TimeRange", getattr(chart, "time_range", None))
    add_kv("Zodiac", getattr(chart, "zodiac", None))
    add_kv("Sign", getattr(chart, "sign", None))
    add_kv("FiveElementsClass", getattr(chart, "five_elements_class", None))

    # Soul/Body palace names (localized)
    get_soul_palace = getattr(chart, "get_soul_palace", None)
    get_body_palace = getattr(chart, "get_body_palace", None)
    if callable(get_soul_palace):
        sp = get_soul_palace()
        add_kv("SoulPalace", _t(sp, "translate_name", language))
    if callable(get_body_palace):
        bp = get_body_palace()
        add_kv("BodyPalace", _t(bp, "translate_name", language))

    lines.append("")
    lines.append("Palaces:")

    palaces = getattr(chart, "palaces", None)
    if not palaces:
        lines.append("- (none)")
        return "\n".join(lines).rstrip() + "\n"

    for p in palaces:
        name = _t(p, "translate_name", language) or str(getattr(p, "name", "")).strip() or "?"
        hs = _t(p, "translate_heavenly_stem", language) or ""
        eb = _t(p, "translate_earthly_branch", language) or ""

        flags: List[str] = []
        if getattr(p, "is_body_palace", False):
            flags.append("body")
        if getattr(p, "is_original_palace", False):
            flags.append("origin")
        flag_txt = f" [{' '.join(flags)}]" if flags else ""

        lines.append(f"- {name} {hs}{eb}{flag_txt}".rstrip())

        lines.append(f"  major: {_render_stars(getattr(p, 'major_stars', []) or [], language)}")
        lines.append(f"  minor: {_render_stars(getattr(p, 'minor_stars', []) or [], language)}")
        adj = getattr(p, "adjective_stars", None) or []
        if adj:
            lines.append(f"  misc: {_render_stars(adj, language)}")

    return "\n".join(lines).rstrip() + "\n"


def render_text(data: Dict[str, Any]) -> str:
    lines: List[str] = []

    def add_kv(key: str, label: str) -> None:
        val = data.get(key, None)
        if val is None:
            return
        s = str(val).strip()
        if not s:
            return
        lines.append(f"{label}: {s}")

    add_kv("solarDate", "Solar")
    add_kv("lunarDate", "Lunar")
    add_kv("chineseDate", "Ganzhi")
    add_kv("time", "Time")
    add_kv("timeRange", "TimeRange")
    add_kv("zodiac", "Zodiac")
    add_kv("sign", "Sign")
    add_kv("earthlyBranchOfSoulPalace", "SoulPalace")
    add_kv("earthlyBranchOfBodyPalace", "BodyPalace")
    add_kv("soul", "SoulStar")
    add_kv("body", "BodyStar")
    add_kv("fiveElementsClass", "FiveElementsClass")

    palaces = data.get("palaces", [])
    if isinstance(palaces, list) and palaces:
        lines.append("")
        lines.append("Palaces:")

        for p in palaces:
            if not isinstance(p, dict):
                continue
            name = str(p.get("name", "")).strip() or "?"
            hs = str(p.get("heavenlyStem", "")).strip()
            eb = str(p.get("earthlyBranch", "")).strip()
            flags: List[str] = []
            if p.get("isBodyPalace"):
                flags.append("body")
            if p.get("isOriginalPalace"):
                flags.append("origin")
            flag_txt = f" [{' '.join(flags)}]" if flags else ""
            lines.append(f"- {name} {hs}{eb}{flag_txt}")

            lines.append(f"  major: {_format_star_list(p.get('majorStars'))}")
            lines.append(f"  minor: {_format_star_list(p.get('minorStars'))}")

            adjective = p.get("adjectiveStars")
            if adjective:
                # adjective stars don't have brightness
                adj_names = [str(s.get("name", "")).strip() for s in adjective if isinstance(s, dict)]
                adj_names = [x for x in adj_names if x]
                lines.append(f"  misc: {', '.join(adj_names) if adj_names else '-'}")

            cs12 = str(p.get("changsheng12", "") or "").strip()
            bs12 = str(p.get("boshi12", "") or "").strip()
            if cs12 or bs12:
                lines.append(f"  changsheng12: {cs12 or '-'}  boshi12: {bs12 or '-'}")

    return "\n".join(lines).rstrip() + "\n"


def write_json(data: Dict[str, Any], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=True, indent=2, sort_keys=True)
        f.write("\n")

