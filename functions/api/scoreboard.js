export async function onRequest() {
  try {
    const r = await fetch(
      'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await r.text();
    return new Response(data, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
