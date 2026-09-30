"""Upcoming training sessions from Google Calendar's secret iCal address."""

from __future__ import annotations

import hashlib
import logging
import time
from datetime import date, datetime, timedelta
from typing import Any

import httpx
import icalendar
import recurring_ical_events

from .normalize import sport_from_title

log = logging.getLogger(__name__)

CACHE_TTL_S = 15 * 60
_cache: dict[str, tuple[float, str]] = {}


def _fetch(url: str) -> str:
    hit = _cache.get(url)
    if hit and time.time() - hit[0] < CACHE_TTL_S:
        return hit[1]
    resp = httpx.get(url, timeout=20, follow_redirects=True)
    resp.raise_for_status()
    _cache[url] = (time.time(), resp.text)
    return resp.text


def _as_local_naive(value: date | datetime) -> tuple[str, bool]:
    """Return (ISO string in local wall time, is_all_day)."""
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone().replace(tzinfo=None)
        return value.isoformat(timespec="minutes"), False
    return value.isoformat(), True


def parse_events(
    ics_text: str, start: datetime, end: datetime, keywords: list[str] | None = None
) -> list[dict[str, Any]]:
    cal = icalendar.Calendar.from_ical(ics_text)
    words = [k.lower() for k in (keywords or [])]
    out = []
    for ev in recurring_ical_events.of(cal).between(start, end):
        title = str(ev.get("SUMMARY") or "Untitled")
        if words and not any(w in title.lower() for w in words):
            continue
        dtstart = ev.decoded("DTSTART")
        dtend = ev.decoded("DTEND") if ev.get("DTEND") else dtstart
        s, all_day = _as_local_naive(dtstart)
        e, _ = _as_local_naive(dtend)
        uid = str(ev.get("UID") or title)
        out.append(
            {
                "id": hashlib.sha1(f"{uid}|{s}".encode()).hexdigest()[:12],
                "title": title,
                "start": s,
                "end": e,
                "all_day": all_day,
                "sport": sport_from_title(title),
                "description": str(ev.get("DESCRIPTION") or "").strip() or None,
                "location": str(ev.get("LOCATION") or "").strip() or None,
            }
        )
    out.sort(key=lambda x: x["start"])
    return out


def upcoming(urls: list[str], keywords: list[str], days: int) -> list[dict[str, Any]]:
    now = datetime.now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=days)
    events: list[dict[str, Any]] = []
    for url in urls:
        try:
            events.extend(parse_events(_fetch(url), start, end, keywords))
        except Exception as exc:  # noqa: BLE001 - one broken feed shouldn't hide the rest
            log.warning("calendar feed failed: %s", exc)
    # Hide timed sessions that already finished today.
    now_iso = now.isoformat(timespec="minutes")
    events = [e for e in events if e["all_day"] or e["end"] >= now_iso]
    events.sort(key=lambda x: x["start"])
    return events
