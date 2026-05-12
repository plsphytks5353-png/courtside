// ESPN APIを使ってNBAのスコアボードを取得
// NBA CDN (cdn.nba.com) はCloudflare Workersをブロックするため、ESPNを使用

export async function onRequest() {
  try {
    const r = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const espn = await r.json();

    const statusMap = { 'pre': 1, 'in': 2, 'post': 3 };

    // ESPN clock "8:23" → NBA形式 "PT8M23.00S"
    function convertClock(displayClock) {
      if (!displayClock) return '';
      const m = displayClock.match(/^(\d+):(\d+)$/);
      if (!m) return '';
      return `PT${m[1]}M${m[2]}.00S`;
    }

    // "42-28" → { wins: 42, losses: 28 }
    function parseRecord(competitor) {
      const rec = competitor.records?.find(r => r.type === 'total') || competitor.records?.[0];
      const parts = (rec?.summary || '0-0').split('-').map(Number);
      return { wins: parts[0] || 0, losses: parts[1] || 0 };
    }

    // リーダー情報を取得
    function getLeader(competitor) {
      const leader = competitor.leaders?.find(l => l.name === 'points' || l.abbreviation === 'PTS');
      const athlete = leader?.leaders?.[0];
      if (!athlete) return null;
      const stats = athlete.statistics || [];
      return {
        personId: athlete.athlete?.id || '',
        name: athlete.athlete?.shortName || '',
        points: parseFloat(stats.find(s => s.name === 'points')?.value || athlete.value || 0),
        rebounds: parseFloat(stats.find(s => s.name === 'rebounds')?.value || 0),
        assists: parseFloat(stats.find(s => s.name === 'assists')?.value || 0),
      };
    }

    const games = (espn.events || []).map(event => {
      const comp = event.competitions[0];
      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');
      const status = event.status;
      const gameStatus = statusMap[status.type?.state] || 1;

      const homeRecord = parseRecord(home);
      const awayRecord = parseRecord(away);

      const homePeriods = (home.linescores || []).map((ls, i) => ({
        period: i + 1, score: Math.round(ls.value || 0)
      }));
      const awayPeriods = (away.linescores || []).map((ls, i) => ({
        period: i + 1, score: Math.round(ls.value || 0)
      }));

      const homeLeader = getLeader(home);
      const awayLeader = getLeader(away);

      return {
        gameId: event.id,
        gameStatus,
        gameStatusText: status.type?.description || '',
        period: status.period || 0,
        gameClock: convertClock(status.displayClock),
        gameTimeUTC: event.date,
        gameDateTimeUTC: event.date,
        gameLabel: comp.series?.title || event.shortName || '',
        gameSubLabel: '',
        seriesText: comp.series?.summary || '',
        arenaName: comp.venue?.fullName || '',
        arenaCity: comp.venue?.address?.city || '',
        homeTeam: {
          teamId: home.team?.id || '',
          teamCity: home.team?.location || '',
          teamName: home.team?.name || '',
          teamTricode: home.team?.abbreviation || '',
          teamSlug: home.team?.slug || '',
          wins: homeRecord.wins,
          losses: homeRecord.losses,
          score: parseInt(home.score) || 0,
          periods: homePeriods,
        },
        awayTeam: {
          teamId: away.team?.id || '',
          teamCity: away.team?.location || '',
          teamName: away.team?.name || '',
          teamTricode: away.team?.abbreviation || '',
          teamSlug: away.team?.slug || '',
          wins: awayRecord.wins,
          losses: awayRecord.losses,
          score: parseInt(away.score) || 0,
          periods: awayPeriods,
        },
        gameLeaders: homeLeader ? {
          homeLeaders: homeLeader,
          awayLeaders: awayLeader,
        } : null,
      };
    });

    const gameDate = espn.day?.date || new Date().toISOString().slice(0, 10);

    return new Response(JSON.stringify({ scoreboard: { gameDate, games } }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
