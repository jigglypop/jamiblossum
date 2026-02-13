from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ClockTime:
    hour: int
    minute: int


def parse_hhmm(value: str) -> ClockTime:
    """
    Parse "HH:MM" (or "H:MM") to ClockTime.
    """
    if value is None:
        raise ValueError("time is required")

    text = value.strip()
    parts = text.split(":")
    if len(parts) != 2:
        raise ValueError("time must be in HH:MM format")

    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except ValueError as exc:
        raise ValueError("time must be numeric HH:MM") from exc

    if not (0 <= hour <= 23):
        raise ValueError("hour must be 0..23")
    if not (0 <= minute <= 59):
        raise ValueError("minute must be 0..59")

    return ClockTime(hour=hour, minute=minute)


def time_to_index(hour: int, minute: int) -> int:
    """
    Convert wall-clock time to iztro timeIndex (0..12).

    Mapping (iztro docs):
    - 0: early Rat hour  (23:00-23:59)
    - 12: late Rat hour  (00:00-00:59)
    - 1: 01:00-02:59
    - 2: 03:00-04:59
    - ...
    - 11: 21:00-22:59
    """
    if not (0 <= hour <= 23):
        raise ValueError("hour must be 0..23")
    if not (0 <= minute <= 59):
        raise ValueError("minute must be 0..59")

    if hour == 23:
        return 0
    if hour == 0:
        return 12

    # Hours 01..22 map into 1..11 in 2-hour buckets
    return ((hour - 1) // 2) + 1


def hhmm_to_index(value: str) -> int:
    t = parse_hhmm(value)
    return time_to_index(t.hour, t.minute)

