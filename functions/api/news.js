// ESPN NBA RSS → DeepL 和訳 → キャッシュ30分
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
    // ESPN NBA RSS取得
    const rssRes = await fetch('https://www.espn.com/espn/rss/nba/news', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const rssText = await rssRes.text();

    // RSS パース（簡易）
    const items = [];
    const itemMatches = rssText.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const m of itemMatches) {
      const block = m[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                     block.match(/<title>(.*?)<\/title>/))?.[1]?.trim() ?? '';
      const desc  = (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                     block.match(/<description>(.*?)<\/description>/))?.[1]
                       ?.replace(/<[^>]+>/g, '').trim() ?? '';
      const link  = block.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ??
                    block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]?.trim() ?? '';
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? '';
      if (title) items.push({ title, desc, link, pubDate });
      if (items.length >= 8) break;
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({ articles: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // DeepL で和訳（タイトル＋説明文をまとめて送信）
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
