export async function onRequest({ request }) {
  const url = new URL(request.url);
  const gameId = url.searchParams.get('game');
  if (!gameId) {
    return new Response(JSON.stringify({ error: 'game param required' }), { status: 400 });
  }
  try {
    const r = await fetch(
      `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gameId}.json`,
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
