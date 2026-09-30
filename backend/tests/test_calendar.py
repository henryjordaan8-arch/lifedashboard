from datetime import datetime

from app.calendar_feed import parse_events

ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//EN
BEGIN:VEVENT
UID:run-1
SUMMARY:Long run 20km
DTSTART:20260704T073000
DTEND:20260704T093000
DESCRIPTION:Negative split
END:VEVENT
BEGIN:VEVENT
UID:gym-weekly
SUMMARY:Gym strength
DTSTART:20260701T180000
DTEND:20260701T190000
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT
BEGIN:VEVENT
UID:dentist
SUMMARY:Dentist
DTSTART;VALUE=DATE:20260702
DTEND;VALUE=DATE:20260703
END:VEVENT
END:VCALENDAR
"""


def test_parses_recurring_and_all_day():
    events = parse_events(ICS, datetime(2026, 7, 1), datetime(2026, 7, 20))
    titles = [e["title"] for e in events]
    assert titles.count("Gym strength") == 3
    dentist = next(e for e in events if e["title"] == "Dentist")
    assert dentist["all_day"] and dentist["start"] == "2026-07-02"
    run = next(e for e in events if e["title"].startswith("Long run"))
    assert run["sport"] == "run" and run["start"] == "2026-07-04T07:30"
    assert [e["start"] for e in events] == sorted(e["start"] for e in events)
    assert len({e["id"] for e in events}) == len(events)


def test_keyword_filter():
    events = parse_events(ICS, datetime(2026, 7, 1), datetime(2026, 7, 20), ["run", "gym"])
    assert {e["title"] for e in events} == {"Long run 20km", "Gym strength"}
