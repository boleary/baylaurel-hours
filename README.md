# baylaurel-hours

Keeps the hours on the Bay Laurel Vintage website in sync with Google Maps.

- **`fetch_hours.py`**: gets the hours from Google Places and writes `hours.json`.
- **`.github/workflows/update-hours.yml`**: runs the script every 2 hours and commits `hours.json` when it changes.
- **`embed.js`**: the website widget. It reads `hours.json` from GitHub Pages and shows open/closed status and the next 7 days, including holiday hours.

The Google API key is stored only as the `GOOGLE_API_KEY` Actions secret. It never appears in this repo or on the website.

## GoDaddy snippet

Add an **HTML** section in the GoDaddy editor and paste in:

```html
<div id="bl-hours"></div>
<script src="https://boleary.github.io/baylaurel-hours/embed.js"></script>
```

## Changing hours

Change the hours in Google Business Profile / Maps. The website updates within about 2 hours. For an immediate update, go to **Actions → Update store hours → Run workflow**.
