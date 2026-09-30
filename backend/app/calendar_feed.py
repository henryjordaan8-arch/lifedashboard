"""Events from Google Calendar's secret iCal addresses.

Every event is tagged with a life-area category (training / work / study /
other), a sport (for training), and whether it's a "key" session.
"""

from __future__ import annotations

import hashlib
import logging
import re
import time
from datetime import date, datetime
from typing import Any

import httpx
import icalendar
import recurring_ical_events

from .normalize import sport_from_title

log = logging.getLogger(__name__)

CATEGORIES = ("training", "work", "study", "other")

DEFAULT_KEYWORDS = {
    "study": ["study", "lecture", "class", "exam", "revision", "revise", "tutorial", "assignment",
              "seminar", "lab", "course", "reading", "homework", "thesis"],
    "work": ["work", "meeting", "call", "standup", "stand-up", "sync", "1:1", "shift", "client",
             "interview", "review", "office", "deadline"],
    "training": [],  # anything whose title maps to a sport counts as training
}

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


def _has_word(text: str, words: list[str]) -> bool:
    return any(re.search(rf"(?<!\w){re.escape(w.lower())}(?!\w)", text) for w in words if w)


def classify(title: str, extra: dict[str, list[str]] | None = None) -> str:
    """Guess an event's category from its title."""
    text = title.lower()
    extra = extra or {}
    if sport_from_title(title) != "other" or _has_word(text, extra.get("training", [])):
        return "training"
    for cat in ("study", "work"):
        if _has_word(text, DEFAULT_KEYWORDS[cat] + extra.get(cat, [])):
            return cat
    return "other"


def key_reason(title: str, keywords: list[str]) -> str | None:
    """Why an event counts as a key session (placeholder rule: title keywords)."""
    text = title.lower()
    if "★" in title or "⭐" in title:
        return "starred"
    for w in keywords:
        if _has_word(text, [w]):
            return f"“{w}” in title"
    return None


def parse_events(
    ics_text: str,
    start: datetime,
    end: datetime,
    category: str | None = None,
    extra_keywords: dict[str, list[str]] | None = None,
    key_keywords: list[str] | None = None,
) -> list[dict[str, Any]]:
    cal = icalendar.Calendar.from_ical(ics_text)
    out = []
    for ev in recurring_ical_events.of(cal).between(start, end):
        title = str(ev.get("SUMMARY") or "Untitled")
        dtstart = ev.decoded("DTSTART")
        dtend = ev.decoded("DTEND") if ev.get("DTEND") else dtstart
        s, all_day = _as_local_naive(dtstart)
        e, _ = _as_local_naive(dtend)
        uid = str(ev.get("UID") or title)
        cat = category or classify(title, extra_keywords)
        sport = sport_from_title(title) if cat == "training" else None
        out.append(
            {
                "id": hashlib.sha1(f"{uid}|{s}".encode()).hexdigest()[:12],
                "title": title,
                "start": s,
                "end": e,
                "all_day": all_day,
                "category": cat,
                "sport": sport,
                "key_reason": key_reason(title, key_keywords or []),
                "description": str(ev.get("DESCRIPTION") or "").strip() or None,
                "location": str(ev.get("LOCATION") or "").strip() or None,
            }
        )
    out.sort(key=lambda x: x["start"])
    return out


def events(
    sources: list[tuple[str | None, str]],
    start: datetime,
    end: datetime,
    extra_keywords: dict[str, list[str]] | None = None,
    key_keywords: list[str] | None = None,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for category, url in sources:
        try:
            out.extend(parse_events(_fetch(url), start, end, category, extra_keywords, key_keywords))
        except Exception as exc:  # noqa: BLE001 - one broken feed shouldn't hide the rest
            log.warning("calendar feed failed: %s", exc)
    out.sort(key=lambda x: x["start"])
    return out
