from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Optional


Calendar = Literal["solar", "lunar"]


@dataclass(frozen=True)
class ChartRequest:
    calendar: Calendar
    date: str  # YYYY-M-D
    time_index: int  # 0..12
    gender: str  # input; will be normalized
    language: str = "ko-KR"
    is_leap_month: bool = False
    fix_leap: bool = True


def normalize_gender(value: str) -> str:
    """
    Map various inputs into values accepted by iztro-py i18n.
    Note: iztro-py validates gender strictly; current versions expect '男'/'女'.
    """
    if value is None:
        raise ValueError("gender is required")
    v = value.strip().lower()

    male = {"m", "male", "man", "남", "남자", "남성", "男"}
    female = {"f", "female", "woman", "여", "여자", "여성", "女"}

    if v in male:
        return "男"
    if v in female:
        return "女"

    raise ValueError("gender must be one of: male/female, 남/여")


def _call_astro(fn: Any, *args: Any, **kwargs: Any) -> Any:
    """
    iztro-py has evolved; keep calls resilient by retrying without
    optional arguments if the installed version doesn't accept them.
    """
    try:
        return fn(*args, **kwargs)
    except TypeError as exc:
        # Retry by dropping optional kwargs one-by-one first, so we keep
        # as many options as possible (especially language).
        optional_keys = ("language", "fix_leap", "fixLeap", "is_leap_month", "isLeapMonth")
        for key in optional_keys:
            if key not in kwargs:
                continue
            kw2 = dict(kwargs)
            kw2.pop(key, None)
            try:
                return fn(*args, **kw2)
            except TypeError:
                pass

        # Last fallback: positional-only.
        try:
            return fn(*args)
        except TypeError:
            raise exc


def create_chart(req: ChartRequest) -> Any:
    if not (0 <= req.time_index <= 12):
        raise ValueError("timeIndex must be 0..12")

    gender = normalize_gender(req.gender)

    try:
        from iztro_py import astro  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "Missing dependency: iztro-py. Install with: python -m pip install iztro-py"
        ) from exc

    # Prefer snake_case names, but allow older variations.
    by_solar = getattr(astro, "by_solar", None) or getattr(astro, "bySolar", None)
    by_lunar = getattr(astro, "by_lunar", None) or getattr(astro, "byLunar", None)

    if req.calendar == "solar":
        if by_solar is None:
            raise RuntimeError("iztro-py astro.by_solar() not found")

        # Some versions accept language/fixLeap; some might not.
        kwargs = {
            "language": req.language,
            "fix_leap": req.fix_leap,
            "fixLeap": req.fix_leap,
        }
        return _call_astro(by_solar, req.date, req.time_index, gender, **kwargs)

    if req.calendar == "lunar":
        if by_lunar is None:
            raise RuntimeError("iztro-py astro.by_lunar() not found")

        kwargs = {
            "language": req.language,
            "is_leap_month": req.is_leap_month,
            "isLeapMonth": req.is_leap_month,
            "fix_leap": req.fix_leap,
            "fixLeap": req.fix_leap,
        }
        return _call_astro(by_lunar, req.date, req.time_index, gender, **kwargs)

    raise ValueError(f"unsupported calendar: {req.calendar}")

