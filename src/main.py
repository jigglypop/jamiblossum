from __future__ import annotations

import argparse
import sys
from typing import Optional

if __package__ in (None, ""):
    # Allow both:
    # - python -m src.main ...
    # - python src/main.py ...
    import os

    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.render import render_chart, render_text, to_data, write_json
from src.time import hhmm_to_index
from src.ziwei import ChartRequest, create_chart


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="ziwei",
        description="Zi Wei Dou Shu natal chart generator (iztro compatible).",
    )

    p.add_argument("--selftest", action="store_true", help="run built-in sanity checks")
    p.add_argument("--calendar", choices=["solar", "lunar"], default="solar")
    p.add_argument("--date", help="Date in YYYY-M-D")

    time_group = p.add_mutually_exclusive_group(required=False)
    time_group.add_argument("--time", help="Wall-clock time in HH:MM")
    time_group.add_argument("--time-index", type=int, help="iztro timeIndex 0..12")

    p.add_argument("--gender", help="male/female or 남/여")
    p.add_argument("--language", default="ko-KR")

    p.add_argument("--leap-month", action="store_true", help="(lunar) is leap month")
    p.add_argument(
        "--fix-leap",
        dest="fix_leap",
        action="store_true",
        default=True,
        help="(lunar) fix leap month (default: true)",
    )
    p.add_argument(
        "--no-fix-leap",
        dest="fix_leap",
        action="store_false",
        help="(lunar) disable leap month fix",
    )

    p.add_argument("--json", dest="json_path", help="write result to JSON file")

    return p


def run_selftest() -> int:
    # Use zh-CN for stable, documented values.
    req = ChartRequest(
        calendar="solar",
        date="2000-8-16",
        time_index=2,
        gender="male",
        language="zh-CN",
        is_leap_month=False,
        fix_leap=True,
    )
    chart = create_chart(req)
    data = to_data(chart)

    assert data.get("solar_date") == "2000-8-16"
    assert data.get("time_range") == "03:00~05:00"
    assert isinstance(data.get("palaces"), list) and len(data["palaces"]) == 12

    sys.stdout.buffer.write(b"SELFTEST OK\n")
    return 0


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.selftest:
        return run_selftest()

    if not args.date:
        parser.error("--date is required (unless --selftest)")
    if not args.gender:
        parser.error("--gender is required (unless --selftest)")
    if args.time_index is None and not args.time:
        parser.error("--time or --time-index is required (unless --selftest)")

    if args.time_index is not None:
        time_index = args.time_index
    else:
        time_index = hhmm_to_index(args.time)

    req = ChartRequest(
        calendar=args.calendar,
        date=args.date,
        time_index=time_index,
        gender=args.gender,
        language=args.language,
        is_leap_month=bool(args.leap_month),
        fix_leap=bool(args.fix_leap),
    )

    chart = create_chart(req)
    data = to_data(chart)

    try:
        out = render_chart(chart, args.language)
    except Exception:
        out = render_text(data)
    # Avoid UnicodeEncodeError on Windows consoles (often cp949).
    sys.stdout.buffer.write(out.encode("utf-8", errors="replace"))

    if args.json_path:
        write_json(data, args.json_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

