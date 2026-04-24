// モジュールレベルキャッシュ（同一Workerインスタンス内で有効・5分TTL）
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

function addUTCDays(dateObj, n) {
  const d = new Date(dateObj);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function fmtMMDDYYYY(d) {
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

export async function onRequest({ request }) {
  const url = new URL(request.url);
  let dateStr = url.searchParams.get('date');
  if (!dateStr) {
    dateStr = new Date().toISOString().slice(0, 10);
  }

  try {
    const raw = await fetchScheduleRaw();

    const d = new Date(dateStr + 'T00:00:00Z');
    const weekday = d.getUTCDay(); // 0=Sun
    const monday = addUTCDays(d, weekday === 0 ? -6 : -(weekday - 1));
    const weekDates = new Set();
    for (let i = 0; i < 7; i++) weekDates.add(fmtMMDDYYYY(addUTCDays(monday, i)));

    const result = [];
    for (const dateEntry of raw.leagueSchedule.gameDates) {
      const gd = dateEntry.gameDate.slice(0, 10);
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

    return new Response(JSON.stringify({ games: result }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
