export default async function handler(req, res) {
  const gameId = req.query.game;
  if (!gameId) return res.status(400).json({ error: 'game param required' });
  try {
    const r = await fetch(
      `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gameId}.json`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await r.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
