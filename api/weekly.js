// Simple in-memory cache (warm for the lifetime of the serverless instance)
let _cache = { data: null, ts: 0 };

async function fetchScheduleRaw() {
  const now = Date.now();
  if (_cache.data && now - _cache.ts < 300_000) return _cache.data;
  const r = await fetch(
    'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json',
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  const raw = await r.json();
  _cache = { data: raw, ts: now };
  return raw;
}

function addDays(dateObj, n) {
  const d = new Date(dateObj);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function fmtDate(d) {
  // Returns "MM/DD/YYYY" matching schedule JSON format
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

export default async function handler(req, res) {
  let dateStr = req.query.date;
  if (!dateStr) {
    const now = new Date();
    dateStr = now.toISOString().slice(0, 10);
  }

  try {
    const raw = await fetchScheduleRaw();

    const d = new Date(dateStr + 'T00:00:00Z');
    const weekday = d.getUTCDay(); // 0=Sun
    // Monday-based week
    const monday = addDays(d, weekday === 0 ? -6 : -(weekday - 1));
    const weekDates = new Set();
    for (let i = 0; i < 7; i++) weekDates.add(fmtDate(addDays(monday, i)));

    const result = [];
    for (const dateEntry of raw.leagueSchedule.gameDates) {
      const gd = dateEntry.gameDate.slice(0, 10); // "MM/DD/YYYY"
      if (!weekDates.has(gd)) continue;
      for (const g of dateEntry.games) {
        const ht = g.homeTeam, at = g.awayTeam;
        result.push({
          gameId: g.gameId,
          gameDateTimeUTC: g.gameDateTimeUTC ?? '',
          gameStatusText: g.gameStatusText ?? '',
          gameStatus: g.gameStatus,
          gameLabel: g.gameLabel ?? '',
          seriesText: g.seriesText ?? '',
          seriesGameNumber: g.seriesGameNumber ?? '',
          arenaName: g.arenaName ?? '',
          arenaCity: g.arenaCity ?? '',
          homeTeam: {
            teamTricode: ht.teamTricode,
            teamCity: ht.teamCity ?? '',
            teamName: ht.teamName ?? '',
            score: ht.score ?? 0,
          },
          awayTeam: {
            teamTricode: at.teamTricode,
            teamCity: at.teamCity ?? '',
            teamName: at.teamName ?? '',
            score: at.score ?? 0,
          },
        });
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ games: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
