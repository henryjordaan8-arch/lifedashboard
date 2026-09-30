"""Readiness score v2 (100 points) and multi-signal alerts.

The score follows a fixed points table per component (below). Within each band
points are interpolated linearly, so e.g. an HRV 7.5% above baseline scores in
the middle of 22–25. Components without data are left out and the total is
rescaled to 100, so a missing sensor doesn't drag the score down.

Alerts are deliberately NOT part of the score: they're multi-signal patterns that
are specific enough to show on their own (illness onset, overreaching, sleep debt).
"""

from __future__ import annotations

import statistics
from datetime import date, timedelta
from typing import Any, Iterable

Band = tuple[float, float, float, float]  # (x_lo, x_hi, points_at_lo, points_at_hi)

SCORE_VERSION = 2

# key: (label, max points, bands). Values below the first band / above the last are
# clamped to that band's end points.
COMPONENTS: dict[str, tuple[str, int, list[Band]]] = {
    # delta from personal 60-day rolling baseline, %
    "hrv": ("HRV vs 60-day baseline", 28,
            [(-30, -15, 0, 7), (-15, -5, 8, 15), (-5, 5, 16, 21), (5, 10, 22, 25), (10, 20, 26, 28)]),
    # Garmin sleep score, last night
    "sleep": ("Sleep last night", 18,
              [(20, 45, 0, 3), (45, 60, 4, 7), (60, 75, 8, 12), (75, 90, 13, 16), (90, 100, 17, 18)]),
    # EWMA acute (7d) : chronic (28d) load
    "acwr": ("Load ratio (ACWR)", 15,
             [(0.3, 0.5, 0, 3), (0.5, 0.6, 3, 8), (0.6, 0.8, 8, 10), (0.8, 1.0, 14, 15),
              (1.0, 1.2, 13, 11), (1.2, 1.5, 7, 4), (1.5, 2.0, 3, 0)]),
    # Garmin recovery time, hours
    "recovery": ("Recovery time", 12,
                 [(0, 1, 12, 11), (1, 12, 11, 9), (12, 24, 8, 6), (24, 48, 5, 2), (48, 72, 1, 0)]),
    # mean Garmin sleep score of the last 3 nights
    "sleep_history": ("Sleep, last 3 nights", 7,
                      [(35, 50, 0, 1), (50, 65, 2, 3), (65, 80, 4, 5), (80, 95, 6, 7)]),
    # bpm vs 7-day average
    "rhr": ("Resting HR vs 7-day avg", 5,
            [(-5, 0, 5, 5), (0, 1, 5, 4), (1, 3, 4, 3), (3, 4, 3, 2), (4, 6, 2, 1), (6, 10, 0, 0)]),
    # breaths/min vs 30-day baseline
    "respiration": ("Respiration vs 30-day baseline", 5,
                    [(-2, 0, 5, 5), (0, 0.5, 5, 4), (0.5, 1, 4, 3), (1, 2, 2, 1), (2, 4, 0, 0)]),
    # %, 7-day rolling average over steady (non-key) runs and rides
    "decoupling": ("Aerobic decoupling (7 days)", 4,
                   [(-10, 3, 4, 4), (3, 5, 3, 3), (5, 8, 2, 2), (8, 12, 1, 1), (12, 50, 0, 0)]),
    # % change over 14 days. Dips under 0.5% count as stable: that's within the
    # day-to-day wobble of Garmin's estimate.
    "vo2max": ("VO₂ max, 14-day trend", 3,
               [(-20, -5, 0, 0), (-5, -2, 1, 1), (-2, -0.5, 2, 2), (-0.5, 20, 3, 3)]),
    # Garmin average stress, previous 3 days
    "stress": ("Stress, last 3 days", 3,
               [(0, 25.5, 3, 3), (25.5, 50.5, 2, 2), (50.5, 75.5, 1, 1), (75.5, 100, 0, 0)]),
}

BANDS = [  # (min score, key, label)
    (75, "high", "Ready for a hard session"),
    (55, "good", "Train as planned"),
    (35, "low", "Take it easier today"),
    (0, "rest", "Prioritise recovery"),
]


def banded(x: float, bands: list[Band]) -> float:
    if x < bands[0][0]:
        return bands[0][2]
    for lo, hi, p_lo, p_hi in bands:
        if lo <= x < hi or (hi == bands[-1][1] and x == hi):
            return p_lo + (p_hi - p_lo) * (x - lo) / (hi - lo) if hi > lo else p_lo
    return bands[-1][3]


def status(points: float, max_points: int) -> str:
    r = points / max_points
    return "good" if r >= 0.75 else "ok" if r >= 0.5 else "warn" if r >= 0.25 else "bad"


# ---- input helpers --------------------------------------------------------------

def _mean(xs: Iterable[float | None], min_n: int = 1) -> float | None:
    v = [x for x in xs if x is not None]
    return statistics.fmean(v) if len(v) >= min_n else None


def _sd(xs: Iterable[float | None]) -> float | None:
    v = [x for x in xs if x is not None]
    return statistics.stdev(v) if len(v) >= 3 else None


def _days(end: date, n: int, offset: int = 0) -> list[str]:
    """n ISO dates ending `offset` days before `end` (oldest first)."""
    return [(end - timedelta(days=offset + i)).isoformat() for i in range(n - 1, -1, -1)]


def ewma_acwr(loads: dict[str, float], end: date, history_days: int = 120) -> list[tuple[str, float | None]]:
    """Daily EWMA acute(7)/chronic(28) ratio for each day up to `end` (inclusive)."""
    la, lc = 2 / (7 + 1), 2 / (28 + 1)
    days = _days(end, history_days)
    seed = statistics.fmean(loads.get(d, 0.0) for d in days[:28])
    acute = chronic = seed
    out = []
    for d in days:
        x = loads.get(d, 0.0)
        acute += la * (x - acute)
        chronic += lc * (x - chronic)
        out.append((d, round(acute / chronic, 2) if chronic > 1 else None))
    return out


def vo2_at(vo2: dict[str, float], day: date, window: int = 3) -> float | None:
    """VO2 max around a day: mean of the last `window` readings on or before it."""
    vals = [vo2[d] for d in sorted(vo2) if d <= day.isoformat()][-window:]
    return statistics.fmean(vals) if vals else None


# ---- the score --------------------------------------------------------------------

def compute(
    today: date,
    days: dict[str, dict[str, Any]],
    activities: list[dict],
    vo2: dict[str, float],
    recovery_time_h: float | None,
) -> dict[str, Any]:
    """`days[iso]` holds per-day metrics: hrv, rhr, sleep_score, respiration,
    respiration_low/high, skin_temp_dev, steps, stress. `activities` are normalised,
    with `decoupling` and `key` set where known."""
    t = today.isoformat()
    g = lambda d, k: (days.get(d) or {}).get(k)  # noqa: E731
    raw: dict[str, tuple[float | None, str, str]] = {}  # key -> (input value, value text, detail)

    # HRV vs 60-day baseline
    hrv, base = g(t, "hrv"), _mean((g(d, "hrv") for d in _days(today, 60, 1)), min_n=14)
    if hrv is not None and base:
        delta = (hrv - base) / base * 100
        raw["hrv"] = (delta, f"{hrv:.0f} ms", f"{delta:+.0f}% vs {base:.0f} ms baseline")

    # Sleep score last night
    s = g(t, "sleep_score")
    if s is not None:
        raw["sleep"] = (s, f"{s:.0f}", "Garmin sleep score")

    # ACWR (EWMA), up to yesterday: today's training hasn't happened yet this morning
    loads: dict[str, float] = {}
    for a in activities:
        if a.get("training_load"):
            loads[a["date"]] = loads.get(a["date"], 0.0) + a["training_load"]
    acwr_series = ewma_acwr(loads, today - timedelta(days=1))
    ratio = acwr_series[-1][1] if acwr_series else None
    if ratio is not None:
        raw["acwr"] = (ratio, f"{ratio:.2f}", "7-day vs 28-day load (EWMA)")

    # Recovery time
    if recovery_time_h is not None:
        raw["recovery"] = (recovery_time_h, f"{recovery_time_h:.0f} h", "Garmin recovery time")

    # Sleep history, 3 nights
    sh = _mean((g(d, "sleep_score") for d in _days(today, 3)), min_n=2)
    if sh is not None:
        raw["sleep_history"] = (sh, f"{sh:.0f}", "average sleep score, last 3 nights")

    # RHR vs previous 7 days
    rhr, rhr_base = g(t, "rhr"), _mean((g(d, "rhr") for d in _days(today, 7, 1)), min_n=4)
    if rhr is not None and rhr_base is not None:
        delta = rhr - rhr_base
        raw["rhr"] = (delta, f"{rhr:.0f} bpm", f"{delta:+.1f} vs {rhr_base:.0f} bpm 7-day avg")

    # Respiration vs 30-day baseline
    resp, resp_base = g(t, "respiration"), _mean((g(d, "respiration") for d in _days(today, 30, 1)), min_n=7)
    if resp is not None and resp_base is not None:
        delta = resp - resp_base
        raw["respiration"] = (delta, f"{resp:.1f} brpm", f"{delta:+.1f} vs {resp_base:.1f} baseline")

    # Aerobic decoupling, 7-day rolling average over steady sessions
    week = (today - timedelta(days=7)).isoformat()
    dec = [a["decoupling"] for a in activities
           if a.get("decoupling") is not None and not a.get("key") and week <= a["date"] <= t]
    if dec:
        avg = statistics.fmean(dec)
        raw["decoupling"] = (avg, f"{avg:.1f}%", f"average of {len(dec)} steady session{'s' * (len(dec) > 1)}")

    # VO2 max 14-day trend
    now_v, then_v = vo2_at(vo2, today), vo2_at(vo2, today - timedelta(days=14))
    if now_v and then_v:
        pct = (now_v - then_v) / then_v * 100
        raw["vo2max"] = (pct, f"{now_v:.1f}", f"{pct:+.1f}% in 14 days")

    # Stress, previous 3 days
    st = _mean((g(d, "stress") for d in _days(today, 3, 1)), min_n=2)
    if st is not None:
        raw["stress"] = (st, f"{st:.0f}", "Garmin average stress, last 3 days")

    components = []
    earned = available = 0.0
    for key, (label, max_pts, bands) in COMPONENTS.items():
        if key in raw:
            x, text, detail = raw[key]
            pts = round(banded(x, bands), 1)
            earned += pts
            available += max_pts
            components.append({"key": key, "label": label, "max": max_pts, "points": pts, "available": True,
                               "value": round(x, 2), "value_text": text, "detail": detail,
                               "status": status(pts, max_pts)})
        else:
            components.append({"key": key, "label": label, "max": max_pts, "points": None, "available": False,
                               "value": None, "value_text": "—", "detail": "no data yet", "status": "none"})

    score = None
    if available >= 50:  # need at least half the formula to say anything
        value = round(earned / available * 100)
        band = next(b for b in BANDS if value >= b[0])
        score = {"value": value, "band": band[1], "label": band[2], "components": components,
                 "earned": round(earned, 1), "available": available, "version": SCORE_VERSION}

    return {"score": score, "components": components, "acwr_series": acwr_series}


# ---- alerts -------------------------------------------------------------------------

def illness_signals(days: dict[str, dict], night: date) -> list[dict[str, Any]]:
    """The five wearable signals that differ between sick and healthy weeks, for one night."""
    n = night.isoformat()
    g = lambda d, k: (days.get(d) or {}).get(k)  # noqa: E731
    base_days = _days(night, 28, 2)  # baseline excludes the nights being judged
    out = []

    def check(key: str, label: str, fired: bool | None, value: str) -> None:
        if fired is not None:
            out.append({"key": key, "label": label, "on": bool(fired), "value": value})

    temp = g(n, "skin_temp_dev")
    check("skin_temp", "Skin temperature up", None if temp is None else temp >= 0.5, f"{temp:+.1f} °C" if temp is not None else "")

    rhr, base, sd = g(n, "rhr"), _mean(g(d, "rhr") for d in base_days), _sd(g(d, "rhr") for d in base_days)
    check("rhr", "Resting HR up", None if rhr is None or base is None else rhr >= base + max(3, sd or 0),
          f"{rhr:.0f} vs {base:.0f} bpm" if rhr is not None and base is not None else "")

    prev = (night - timedelta(days=1)).isoformat()  # the day before the night
    steps = g(prev, "steps")
    step_base = [g(d, "steps") for d in _days(night, 28, 2)]
    med = statistics.median([s for s in step_base if s is not None]) if any(s is not None for s in step_base) else None
    check("steps", "Steps down", None if steps is None or not med else steps <= 0.7 * med,
          f"{steps:,.0f} vs {med:,.0f} usual" if steps is not None and med else "")

    hrv, hb, hsd = g(n, "hrv"), _mean(g(d, "hrv") for d in base_days), _sd(g(d, "hrv") for d in base_days)
    check("hrv", "HRV down", None if hrv is None or hb is None else hrv <= hb - max(hsd or 0, 0.1 * hb),
          f"{hrv:.0f} vs {hb:.0f} ms" if hrv is not None and hb is not None else "")

    resp, rb = g(n, "respiration"), _mean(g(d, "respiration") for d in base_days)
    lo, hi = g(n, "respiration_low"), g(n, "respiration_high")
    ranges = [(g(d, "respiration_high") or 0) - (g(d, "respiration_low") or 0)
              for d in base_days if g(d, "respiration_high") and g(d, "respiration_low")]
    range_now = (hi - lo) if hi and lo else None
    range_base, range_sd = (_mean(ranges), _sd(ranges)) if ranges else (None, None)
    fired = None
    if resp is not None and rb is not None:
        fired = resp >= rb + 1.0
        if range_now is not None and range_base is not None:
            fired = fired or range_now >= range_base + max(range_sd or 0, 1.5)
    check("respiration", "Breathing faster / more variable", fired,
          f"{resp:.1f} vs {rb:.1f} brpm" if resp is not None and rb is not None else "")
    return out


def alerts(today: date, days: dict[str, dict], activities: list[dict],
           vo2: dict[str, float], acwr_series: list[tuple[str, float | None]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    g = lambda d, k: (days.get(d) or {}).get(k)  # noqa: E731

    # Illness onset: 3+ of the 5 signals on each of the last 2 nights.
    nights = [illness_signals(days, today - timedelta(days=i)) for i in (1, 0)]
    if all(sum(s["on"] for s in n) >= 3 for n in nights):
        on = [s for s in nights[1] if s["on"]]
        out.append({
            "id": "illness", "severity": "critical", "title": "Possible illness coming on",
            "detail": f"{len(on)} of {len(nights[1])} warning signs on each of the last 2 nights. "
                      "Consider an easy day or rest, even if you feel fine.",
            "signals": [f"{s['label']} ({s['value']})" for s in on],
        })

    # Overreaching: any of three patterns.
    reasons = []
    last3 = [r for _, r in acwr_series[-3:]]
    if len(last3) == 3 and all(r is not None and r > 1.5 for r in last3):
        reasons.append(f"Load ratio above 1.5 for 3 days running ({', '.join(f'{r:.2f}' for r in last3)})")
    runs = [a for a in sorted(activities, key=lambda a: a["start"])
            if a["sport"] == "run" and a.get("decoupling") is not None and not a.get("key")][-3:]
    if len(runs) == 3:
        d1, d2, d3 = (r["decoupling"] for r in runs)
        if d1 < d2 < d3 and d3 - d1 >= 1:
            reasons.append(f"Aerobic decoupling rising over your last 3 steady runs ({d1:.1f}% → {d2:.1f}% → {d3:.1f}%)")
    v_now, v_7, v_14 = (vo2_at(vo2, today - timedelta(days=k)) for k in (0, 7, 14))
    if v_now and v_7 and v_14 and v_now < v_7 < v_14 and (v_14 - v_now) / v_14 >= 0.005:
        loads_now = sum(a.get("training_load") or 0 for a in activities
                        if (today - timedelta(days=14)).isoformat() <= a["date"] <= today.isoformat())
        loads_before = sum(a.get("training_load") or 0 for a in activities
                           if (today - timedelta(days=28)).isoformat() <= a["date"] < (today - timedelta(days=14)).isoformat())
        if loads_before and loads_now >= 0.9 * loads_before:
            reasons.append(f"VO₂ max down for 14+ days ({v_14:.1f} → {v_now:.1f}) while training load held up")
    if reasons:
        out.append({"id": "overreaching", "severity": "warning", "title": "Signs of overreaching",
                    "detail": "Your body may not be absorbing the training. Consider a lighter few days.",
                    "signals": reasons})

    # Sleep debt: 3-night average below 60, even if last night looked better.
    scores = [g(d, "sleep_score") for d in _days(today, 3)]
    if all(s is not None for s in scores):
        avg = statistics.fmean(scores)
        if avg < 60:
            last = scores[-1]
            note = f" Last night ({last:.0f}) looked better, but it hasn't made up the deficit." if last >= 60 else ""
            out.append({"id": "sleep_debt", "severity": "warning", "title": "Sleep debt building",
                        "detail": f"Sleep score has averaged {avg:.0f} over the last 3 nights.{note}",
                        "signals": [f"{d[5:]}: {s:.0f}" for d, s in zip(_days(today, 3), scores)]})
    return out
