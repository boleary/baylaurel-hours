/**
 * Bay Laurel Vintage - store hours widget for the GoDaddy website.
 *
 * Paste this into a GoDaddy "HTML" section:
 *   <div id="bl-hours"></div>
 *   <script src="https://boleary.github.io/baylaurel-hours/embed.js"></script>
 *
 * It reads hours.json (kept up to date from Google by the GitHub Action) and
 * shows open/closed status plus the next 7 days, including holiday hours.
 */
(function () {
    const HOURS_URL = 'https://boleary.github.io/baylaurel-hours/hours.json';
    const MAPS_URL = 'https://www.google.com/maps/place/?q=place_id:ChIJxUQuVwndw4kRekSS6-aEaP0';
    const TIME_ZONE = 'America/New_York';

    const root = document.getElementById('bl-hours');
    if (!root) return;

    const style = document.createElement('style');
    style.textContent = `
        #bl-hours {
            --bl-text: #1b1b1b;
            --bl-muted: #6b6b6b;
            --bl-open: #2e7d32;
            --bl-closed: #b3261e;
            --bl-highlight: #f4efe6;
            font-family: inherit;
            color: var(--bl-text);
            font-size: 16px;
            line-height: 1.5;
            max-width: 420px;
        }
        #bl-hours .bl-status { font-weight: 600; margin-bottom: 8px; }
        #bl-hours .bl-status.open { color: var(--bl-open); }
        #bl-hours .bl-status.closed { color: var(--bl-closed); }
        #bl-hours table { width: 100%; border-collapse: collapse; }
        #bl-hours td { padding: 3px 6px; vertical-align: top; }
        #bl-hours td:last-child { text-align: right; }
        #bl-hours tr.today { font-weight: 600; background: var(--bl-highlight); }
        #bl-hours .bl-note { color: var(--bl-muted); font-size: 0.85em; }
        #bl-hours a { color: inherit; }
    `;
    document.head.appendChild(style);

    let hours = null;

    // Returns the current date ("YYYY-MM-DD") and minutes from midnight at the store.
    function storeNow() {
        const parts = {};
        new Intl.DateTimeFormat('en-CA', {
            timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(new Date()).forEach(p => { parts[p.type] = p.value; });
        return {
            date: `${parts.year}-${parts.month}-${parts.day}`,
            minutes: Number(parts.hour) * 60 + Number(parts.minute)
        };
    }

    // Converts "HH:MM" into minutes from midnight.
    function getMinutesFromTime(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    // Converts "13:30" into "1:30 pm" and "17:00" into "5 pm".
    function formatTime(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        const hour12 = h % 12 || 12;
        const suffix = h < 12 ? 'am' : 'pm';
        return m ? `${hour12}:${String(m).padStart(2, '0')} ${suffix}` : `${hour12} ${suffix}`;
    }

    function addDays(dateStr, count) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, d + count));
        return { date: date.toISOString().slice(0, 10), dayIndex: date.getUTCDay() };
    }

    // Builds the next 7 days from today. Uses Google's day-specific hours where
    // available (they include holidays), otherwise the regular weekly schedule.
    function nextSevenDays(today) {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const { date, dayIndex } = addDays(today, i);
            const upcoming = hours.upcoming.find(d => d.date === date);
            days.push(Object.assign({ date, dayIndex }, upcoming || hours.regular[dayIndex]));
        }
        return days;
    }

    function statusText(days, nowMinutes) {
        const today = days[0];
        if (!today.isClosed) {
            const open = getMinutesFromTime(today.open);
            const close = getMinutesFromTime(today.close);
            if (nowMinutes >= open && nowMinutes < close) {
                return { open: true, text: `Open now until ${formatTime(today.close)}` };
            }
            if (nowMinutes < open) {
                return { open: false, text: `Closed now · Opens today at ${formatTime(today.open)}` };
            }
        }
        for (let i = 1; i < days.length; i++) {
            if (!days[i].isClosed) {
                const when = i === 1 ? 'tomorrow' : days[i].day;
                return { open: false, text: `Closed now · Opens ${when} at ${formatTime(days[i].open)}` };
            }
        }
        return { open: false, text: 'Closed now' };
    }

    function render() {
        const now = storeNow();
        const days = nextSevenDays(now.date);
        const status = statusText(days, now.minutes);

        let rows = '';
        days.forEach((d, i) => {
            const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.day;
            const regular = hours.regular[d.dayIndex];
            let timeText = d.isClosed ? 'Closed' : `${formatTime(d.open)} – ${formatTime(d.close)}`;

            if (d.isSpecial && d.isClosed && !regular.isClosed) {
                // Holiday closure on a normally open day
                timeText += `<br><span class="bl-note">Normally ${formatTime(regular.open)} – ${formatTime(regular.close)}</span>`;
            } else if (d.isSpecial) {
                timeText += `<br><span class="bl-note">Special hours</span>`;
            }
            rows += `<tr class="${i === 0 ? 'today' : ''}"><td>${label}</td><td>${timeText}</td></tr>`;
        });

        root.innerHTML =
            `<div class="bl-status ${status.open ? 'open' : 'closed'}">${status.text}</div>` +
            `<table>${rows}</table>`;
    }

    function renderError() {
        root.innerHTML = `<a href="${MAPS_URL}" target="_blank" rel="noopener">See our current hours on Google Maps</a>`;
    }

    fetch(HOURS_URL, { cache: 'no-cache' })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            hours = data;
            render();
            setInterval(render, 60000); // Keep "Open now" accurate if the page stays open
        })
        .catch(error => {
            console.error('Could not load store hours:', error);
            renderError();
        });
})();
