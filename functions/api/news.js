// ESPN NBA News API → DeepL 和訳 → キャッシュ30分
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000;

export async function onRequest({ env }) {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) {
    return new Response(JSON.stringify(cache), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    // ESPN 公開JSON API
    const espnRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=8',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const espnData = await espnRes.json();
    const rawArticles = espnData.articles ?? [];

    const items = rawArticles.slice(0, 8).map(a => ({
      title:   a.headline ?? '',
      desc:    a.description ?? '',
      link:    a.links?.web?.href ?? a.links?.mobile?.href ?? 'https://www.espn.com/nba/',
      pubDate: a.published ?? '',
    })).filter(a => a.title);

    if (items.length === 0) {
      return new Response(JSON.stringify({ articles: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // DeepL で和訳
    const apiKey = env.DEEPL_API_KEY;
    const texts = items.flatMap(i => [i.title, i.desc]);

    const deeplRes = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: texts,
        source_lang: 'EN',
        target_lang: 'JA',
      }),
    });

    const deeplData = await deeplRes.json();
    const translations = deeplData.translations ?? [];

    const articles = items.map((item, i) => ({
      titleJa: translations[i * 2]?.text ?? item.title,
      descJa:  translations[i * 2 + 1]?.text ?? item.desc,
      link:    item.link,
      pubDate: item.pubDate,
    }));

    cache = { articles };
    cacheTime = now;

    return new Response(JSON.stringify(cache), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, articles: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
