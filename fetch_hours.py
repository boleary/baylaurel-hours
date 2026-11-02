"""
Fetches Bay Laurel Vintage's hours from Google Places and writes hours.json.

Run by the GitHub Action in .github/workflows/update-hours.yml. The website
embed (embed.js) reads the resulting hours.json from GitHub Pages, so the
Google API key never appears on the public site.

Usage: GOOGLE_API_KEY=... python3 fetch_hours.py
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

PLACE_ID = os.environ.get("PLACE_ID", "ChIJxUQuVwndw4kRekSS6-aEaP0")
TIME_ZONE = "America/New_York"
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hours.json")

# Index mapping matches Google (and the store sign): 0 = Sunday ... 6 = Saturday
DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def fetch_place(api_key):
    """Calls Places API (New) Place Details for just the opening-hours fields."""
    request = urllib.request.Request(
        f"https://places.googleapis.com/v1/places/{PLACE_ID}",
        headers={
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "regularOpeningHours,currentOpeningHours",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        sys.exit(f"Places API error {error.code}: {error.read().decode()}")


def to_hhmm(point):
    """Converts a Google time point {hour, minute} into "HH:MM" (24-hour)."""
    return f"{point.get('hour', 0):02d}:{point.get('minute', 0):02d}"


def add_period(entry, period):
    """
    Merges one Google period into a day entry. If Google lists several periods
    for one day (e.g. a lunch break), we show earliest open through latest close.
    A period with no close means open 24 hours.
    """
    open_time = to_hhmm(period["open"])
    close_time = to_hhmm(period["close"]) if "close" in period else "23:59"
    if entry["isClosed"]:
        entry.update(open=open_time, close=close_time, isClosed=False)
    else:
        entry["open"] = min(entry["open"], open_time)
        entry["close"] = max(entry["close"], close_time)


def parse_regular(opening_hours):
    """Builds the normal weekly schedule (same shape as the sign's storeSchedule)."""
    schedule = [{"day": day, "open": None, "close": None, "isClosed": True} for day in DAYS]
    for period in opening_hours.get("periods", []):
        add_period(schedule[period["open"]["day"]], period)
    return schedule


def parse_upcoming(opening_hours):
    """
    Builds the actual schedule for the next 7 days, starting today. Unlike the
    regular schedule, this includes special hours (holidays, closures) she sets
    in Google.
    """
    if not opening_hours:
        return []

    today = datetime.now(ZoneInfo(TIME_ZONE)).date()
    special_dates = {
        "{year:04d}-{month:02d}-{day:02d}".format(**special["date"])
        for special in opening_hours.get("specialDays", [])
    }

    upcoming = []
    for offset in range(7):
        date = today + timedelta(days=offset)
        upcoming.append({
            "date": date.isoformat(),
            "day": DAYS[(date.weekday() + 1) % 7],  # Python's Monday=0 -> Google's Sunday=0
            "open": None,
            "close": None,
            "isClosed": True,
            "isSpecial": date.isoformat() in special_dates,
        })
    by_date = {entry["date"]: entry for entry in upcoming}

    for period in opening_hours.get("periods", []):
        date = period["open"].get("date")
        if not date:
            continue
        entry = by_date.get("{year:04d}-{month:02d}-{day:02d}".format(**date))
        if entry:
            add_period(entry, period)
    return upcoming


def main():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        sys.exit("GOOGLE_API_KEY is not set")

    place = fetch_place(api_key)
    if "regularOpeningHours" not in place:
        # Fail rather than overwrite good data with an empty schedule
        sys.exit(f"No opening hours in Google response: {json.dumps(place)}")

    hours = {
        "timeZone": TIME_ZONE,
        "regular": parse_regular(place["regularOpeningHours"]),
        "upcoming": parse_upcoming(place.get("currentOpeningHours")),
    }
    with open(OUTPUT_FILE, "w") as file:
        json.dump(hours, file, indent=2)
        file.write("\n")
    print(json.dumps(hours, indent=2))


if __name__ == "__main__":
    main()
