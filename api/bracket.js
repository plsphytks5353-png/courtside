let _cache = { data: null, ts: 0 };

async function fetchBracket() {
  const now = Date.now();
  if (_cache.data && now - _cache.ts < 60_000) return _cache.data;

  const r = await fetch(
    'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json',
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  const raw = await r.json();

  const ROUND_ORDER = {
    'First Round': 1,
    'Second Round': 2,
    'Conference Finals': 3,
    'NBA Finals': 4,
  };

  const series = {};
  for (const dateEntry of raw.leagueSchedule.gameDates) {
    for (const g of dateEntry.games ?? []) {
      const label = g.gameLabel ?? '';
      if (!Object.keys(ROUND_ORDER).some(r => label.includes(r))) continue;
      const at = g.awayTeam.teamTricode;
      const ht = g.homeTeam.teamTricode;
      if (!at || !ht) continue;

      const key = [at, ht].sort().join('|');
      const sn = g.seriesGameNumber ?? '';
      const st = g.seriesText || 'Series tied 0-0';
      const conf = label.startsWith('East') ? 'east'
                 : label.startsWith('West') ? 'west'
                 : 'finals';
      const roundNum = Object.entries(ROUND_ORDER).find(([k]) => label.includes(k))?.[1] ?? 99;

      if (!series[key]) {
        series[key] = { top: null, bot: null, label, conf, roundNum, text: st, latestGameId: g.gameId };
      }
      if (sn === 'Game 1') {
        series[key].top = ht; // home team = higher seed
        series[key].bot = at;
      }
      if (st && st !== 'Series tied 0-0') series[key].text = st;
      series[key].latestGameId = g.gameId;
    }
  }

  const roundKey = { 1: 'r1', 2: 'r2', 3: 'cf', 4: 'finals' };
  const result = { east: {}, west: {}, finals: [] };

  for (const [key, v] of Object.entries(series)) {
    const [a, b] = key.split('|');
    if (!v.top) { v.top = a; v.bot = b; }
    const entry = { top: v.top, bot: v.bot, text: v.text, label: v.label, latestGameId: v.latestGameId };
    const rk = roundKey[v.roundNum] ?? 'other';
    if (v.conf === 'east') result.east[rk] = [...(result.east[rk] ?? []), entry];
    else if (v.conf === 'west') result.west[rk] = [...(result.west[rk] ?? []), entry];
    else result.finals.push(entry);
  }

  _cache = { data: result, ts: now };
  return result;
}

export default async function handler(req, res) {
  try {
    const data = await fetchBracket();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
