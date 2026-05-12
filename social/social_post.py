"""
CourtSide X 半自動投稿スクリプト
-------------------------------
実行すると：
  1. DALL-E 3で画像を生成
  2. 投稿文をクリップボードにコピー
  3. 画像をFinderで開く
  4. XのコンポーズページをSafariで開く

あとは Cmd+V で貼り付け → 画像をドラッグ → 投稿 するだけ！

使い方:
  python3 social_post.py article   # 記事紹介を投稿
  python3 social_post.py results   # 試合結果を投稿
"""

import os
import sys
import subprocess
import time
import requests
from openai import OpenAI
from dotenv import load_dotenv
from datetime import datetime
import pytz

load_dotenv()

# ==================== 設定 ====================
JST = pytz.timezone("Asia/Tokyo")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_PATH = os.path.join(SCRIPT_DIR, "courtside_post.jpg")

# 記事リスト（新しいものを上に追加）
ARTICLES = [
    {
        "title": "サンダー嫌いでも認めざるを得ない｜OKC優勝への道を徹底分析",
        "url": "https://courtsidelive.jp/thunder-analysis-2026.html",
        "description": "タンキング・フロッピング・スモールマーケット。嫌う理由は正当だ。でも得失点差+15.5、SGA 2年連続MVP。数字は嘘をつかない。",
        "emoji": "⚡",
        "hashtags": "#NBA #サンダー #OKC #NBAプレイオフ",
    },
    {
        "title": "2026 NBAプレイオフ展望・優勝予想｜第2ラウンド全カード分析",
        "url": "https://courtsidelive.jp/playoff-outlook-2026.html",
        "description": "ESPNオッズデータをもとに全カードを分析。76ersの番狂わせ、ドンチッチの負傷、ウェンバンヤマの覚醒…今年の優勝はどこか。",
        "emoji": "🏆",
        "hashtags": "#NBA #NBAプレイオフ #優勝予想",
    },
]


# ==================== 画像生成 ====================
def generate_image(prompt):
    print("🎨 DALL-E 3で画像を生成中...")
    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = openai_client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1024x1024",
        quality="standard",
        n=1,
    )
    image_url = response.data[0].url
    img_response = requests.get(image_url, timeout=30)
    with open(IMAGE_PATH, "wb") as f:
        f.write(img_response.content)
    print(f"✅ 画像生成完了: {IMAGE_PATH}")
    return IMAGE_PATH


# ==================== クリップボードにコピー ====================
def copy_to_clipboard(text):
    subprocess.run("pbcopy", input=text.encode("utf-8"), check=True)
    print("📋 投稿文をクリップボードにコピーしました")


# ==================== 投稿コンテンツ生成 ====================
def build_article_caption():
    article = ARTICLES[0]
    return (
        f"{article['emoji']} 【CourtSide 新着記事】\n\n"
        f"{article['title']}\n\n"
        f"{article['description']}\n\n"
        f"👉 {article['url']}\n\n"
        f"{article['hashtags']}"
    )


def build_results_caption():
    try:
        from nba_api.live.nba.endpoints import scoreboard
        board = scoreboard.ScoreBoard()
        games = board.games.get_dict()
    except Exception as e:
        print(f"⚠️ NBA API エラー: {e}")
        games = []

    now = datetime.now(JST)
    lines = [f"🏀 NBA試合結果 {now.strftime('%m月%d日')}"]
    lines.append("")

    finished = [g for g in games if g.get("gameStatus") == 3]

    if finished:
        for game in finished[:4]:
            away = f"{game['awayTeam']['teamCity']} {game['awayTeam']['teamName']}"
            home = f"{game['homeTeam']['teamCity']} {game['homeTeam']['teamName']}"
            as_ = game["awayTeam"]["score"]
            hs = game["homeTeam"]["score"]
            mark = "🔴" if as_ > hs else "🔵"
            lines.append(f"{mark} {away} {as_} - {hs} {home}")
    else:
        lines.append("本日の試合結果はまだありません。")

    lines.append("")
    lines.append("📊 詳細スタッツ・速報はこちら")
    lines.append("👉 courtsidelive.jp")
    lines.append("")
    lines.append("#NBA #バスケ #NBA速報 #NBAプレイオフ")
    return "\n".join(lines)


# ==================== メイン ====================
def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else None

    if mode not in ("article", "results"):
        print("使い方:")
        print("  python3 social_post.py article   # 記事紹介を投稿")
        print("  python3 social_post.py results   # 試合結果を投稿")
        sys.exit(1)

    print(f"\n🚀 CourtSide 自動投稿準備 [{mode}] 開始\n")

    # 投稿文を生成
    if mode == "article":
        caption = build_article_caption()
        image_prompt = (
            "NBA basketball article thumbnail for social media. "
            "Dark dramatic basketball court with cinematic lighting. "
            "Deep red and black color scheme. "
            "Modern sports journalism graphic design. "
            "Professional sports media aesthetic. "
            "Abstract basketball elements, no specific team logos. "
            "High contrast, dramatic spotlight."
        )
    else:
        caption = build_results_caption()
        image_prompt = (
            "NBA basketball game scoreboard graphic for social media. "
            "Dark dramatic background with deep red and black tones. "
            "Basketball court overhead view with dramatic lighting. "
            "Modern sports broadcast aesthetic. "
            "No specific team logos. Abstract basketball elements."
        )

    print(f"📝 投稿文:\n{'='*50}\n{caption}\n{'='*50}\n")

    # 画像生成
    img_path = generate_image(image_prompt)

    # クリップボードにコピー
    copy_to_clipboard(caption)

    # 画像をFinderで開く
    print("🖼️  画像をFinderで開きます...")
    subprocess.Popen(["open", img_path])
    time.sleep(1)

    # XのコンポーズページをSafariで開く
    print("🌐 XのコンポーズページをSafariで開きます...")
    subprocess.Popen(["open", "-a", "Safari", "https://x.com/compose/post"])
    time.sleep(2)

    print("\n" + "="*50)
    print("✅ 準備完了！あとは以下の3ステップだけ：")
    print("")
    print("  1️⃣  Safari の投稿欄をクリックして Cmd+V で貼り付け")
    print("  2️⃣  生成された画像をFinderから投稿欄にドラッグ＆ドロップ")
    print("  3️⃣  「投稿」ボタンをクリック")
    print("="*50 + "\n")


if __name__ == "__main__":
    main()
