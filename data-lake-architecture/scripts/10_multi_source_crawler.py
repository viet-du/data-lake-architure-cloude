"""
Multi-source Crawler: GitHub + CoinGecko + OpenWeather + Hacker News
Tất cả đều dùng public API miễn phí, không cần API key (trừ một số optional).

Gửi data vào Kafka → Spark Streaming → Delta Lake

Chạy:
  python scripts/10_multi_source_crawler.py --source github
  python scripts/10_multi_source_crawler.py --source crypto
  python scripts/10_multi_source_crawler.py --source weather
  python scripts/10_multi_source_crawler.py --source hackernews
  python scripts/10_multi_source_crawler.py --source all --duration 300
"""
import argparse
import gzip
import json
import os
import time
from datetime import datetime
from pathlib import Path
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ============ Configuration ============
OUTPUT_DIR = Path(__file__).parent.parent / "data-samples"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
TOPIC_GITHUB = "github-trending-stream"
TOPIC_CRYPTO = "crypto-prices-stream"
TOPIC_WEATHER = "weather-stream"
TOPIC_NEWS = "hackernews-stream"

# Session với retry
session = requests.Session()
retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504])
adapter = HTTPAdapter(max_retries=retries)
session.mount("https://", adapter)
session.mount("http://", adapter)
session.headers.update({
    "User-Agent": "DataLake-Crawler/1.0",
    "Accept": "application/json",
})


# ============ Base Crawler ============
class BaseCrawler:
    """Base class cho tất cả crawler."""

    def __init__(self, name: str, topic: str):
        self.name = name
        self.topic = topic
        self.kafka_producer = None
        self.count = 0

        # Kafka
        try:
            from kafka import KafkaProducer
            self.kafka_producer = KafkaProducer(
                bootstrap_servers=[KAFKA_BOOTSTRAP],
                value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                acks="all",
                retries=3,
                compression_type="gzip",
            )
            print(f"✅ [{name}] Connected to Kafka")
        except Exception as e:
            print(f"⚠️  [{name}] Kafka not available: {e}")
            self.kafka_producer = None

        # File backup
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.file_handle = gzip.open(
            OUTPUT_DIR / f"{name}_{timestamp}.jsonl.gz",
            "at", encoding="utf-8"
        )

    def close(self):
        if self.kafka_producer:
            self.kafka_producer.flush()
            self.kafka_producer.close()
        if self.file_handle:
            self.file_handle.close()

    def send(self, event: dict):
        """Gửi event vào Kafka + file."""
        event["_crawl_timestamp"] = datetime.utcnow().isoformat() + "Z"
        event["_source"] = self.name
        event["_kafka_topic"] = self.topic

        if self.kafka_producer:
            try:
                key = str(event.get("id", event.get("symbol", event.get("name", "unknown"))))
                self.kafka_producer.send(self.topic, key=key, value=event)
            except Exception as e:
                pass  # Silent fail cho performance

        self.file_handle.write(json.dumps(event, ensure_ascii=False) + "\n")
        self.count += 1


# ============ GitHub Trending Crawler ============
class GitHubTrendingCrawler(BaseCrawler):
    """Crawl GitHub trending repos (dùng GitHub API - public)."""

    def __init__(self):
        super().__init__("github_trending", TOPIC_GITHUB)
        self.session.headers.update({
            "Accept": "application/vnd.github+json",
        })

    def crawl_trending(self, since: str = "daily", language: str = "", max_pages: int = 3):
        """
        Crawl trending repos.
        Note: GitHub không có "trending" API chính thức, dùng search API thay thế.
        """
        print(f"\n{'='*60}")
        print(f"🐙 GitHub Trending Crawler")
        print(f"   Since: {since}, Language: {language or 'all'}")
        print(f"{'='*60}")

        # Tính date range dựa trên since
        from datetime import timedelta
        days = {"daily": 1, "weekly": 7, "monthly": 30}.get(since, 1)
        date_str = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

        # Search repos được tạo trong khoảng, sort theo stars
        q_parts = [f"created:>{date_str}"]
        if language:
            q_parts.append(f"language:{language}")

        query = " ".join(q_parts)

        for page in range(1, max_pages + 1):
            url = "https://api.github.com/search/repositories"
            params = {
                "q": query,
                "sort": "stars",
                "order": "desc",
                "per_page": 30,
                "page": page,
            }

            try:
                response = self.session.get(url, params=params, timeout=15)

                # Check rate limit
                if response.status_code == 403:
                    print(f"  ⚠️  Rate limit exceeded. Resets at: {response.headers.get('X-RateLimit-Reset')}")
                    break

                response.raise_for_status()
                data = response.json()

                items = data.get("items", [])
                if not items:
                    break

                print(f"  ✅ Page {page}: {len(items)} repos")

                for repo in items:
                    event = {
                        "id": repo["id"],
                        "name": repo["full_name"],
                        "description": repo.get("description"),
                        "language": repo.get("language"),
                        "stars": repo["stargazers_count"],
                        "forks": repo["forks_count"],
                        "watchers": repo["watchers_count"],
                        "open_issues": repo["open_issues_count"],
                        "created_at": repo["created_at"],
                        "updated_at": repo["updated_at"],
                        "pushed_at": repo["pushed_at"],
                        "html_url": repo["html_url"],
                        "owner": repo["owner"]["login"],
                        "topics": repo.get("topics", []),
                        "license": repo.get("license", {}).get("name") if repo.get("license") else None,
                        "size_kb": repo["size"],
                        "default_branch": repo["default_branch"],
                        "since": since,
                    }
                    self.send(event)

                # Rate limit: GitHub 60 req/hour (unauthenticated)
                # Mỗi request delay
                time.sleep(2.0)

            except Exception as e:
                print(f"  ❌ Error: {e}")
                break

        print(f"\n✅ Total: {self.count} repos")
        return self.count


# ============ CoinGecko Crypto Crawler ============
class CoinGeckoCrawler(BaseCrawler):
    """Crawl crypto prices từ CoinGecko (free, no API key)."""

    def __init__(self):
        super().__init__("coingecko_crypto", TOPIC_CRYPTO)
        self.base_url = "https://api.coingecko.com/api/v3"

    def crawl_top_coins(self, top_n: int = 100, vs_currency: str = "usd"):
        """
        Crawl top N coins theo market cap.
        """
        print(f"\n{'='*60}")
        print(f"💰 CoinGecko Crypto Crawler")
        print(f"   Top {top_n} coins in {vs_currency.upper()}")
        print(f"{'='*60}")

        url = f"{self.base_url}/coins/markets"
        params = {
            "vs_currency": vs_currency,
            "order": "market_cap_desc",
            "per_page": min(top_n, 250),
            "page": 1,
            "sparkline": "true",
            "price_change_percentage": "1h,24h,7d",
        }

        try:
            response = self.session.get(url, params=params, timeout=20)
            response.raise_for_status()
            coins = response.json()

            print(f"  ✅ Got {len(coins)} coins")

            for coin in coins:
                event = {
                    "id": coin["id"],
                    "symbol": coin["symbol"],
                    "name": coin["name"],
                    "current_price": coin["current_price"],
                    "market_cap": coin["market_cap"],
                    "market_cap_rank": coin["market_cap_rank"],
                    "total_volume": coin["total_volume"],
                    "high_24h": coin["high_24h"],
                    "low_24h": coin["low_24h"],
                    "price_change_24h": coin["price_change_24h"],
                    "price_change_percentage_24h": coin["price_change_percentage_24h"],
                    "price_change_percentage_1h": coin.get("price_change_percentage_1h_in_currency"),
                    "price_change_percentage_7d": coin.get("price_change_percentage_7d_in_currency"),
                    "circulating_supply": coin["circulating_supply"],
                    "total_supply": coin["total_supply"],
                    "max_supply": coin["max_supply"],
                    "ath": coin["ath"],
                    "ath_date": coin["ath_date"],
                    "atl": coin["atl"],
                    "atl_date": coin["atl_date"],
                    "last_updated": coin["last_updated"],
                    "vs_currency": vs_currency,
                }
                self.send(event)

        except Exception as e:
            print(f"  ❌ Error: {e}")

        print(f"\n✅ Total: {self.count} coins")
        return self.count

    def monitor_prices(self, coin_ids: list, interval: int = 30, duration: int = 300):
        """
        Monitor giá crypto mỗi `interval` giây, trong `duration` giây.
        """
        print(f"\n{'='*60}")
        print(f"📈 Monitoring {len(coin_ids)} coins every {interval}s for {duration}s")
        print(f"{'='*60}")

        start = time.time()
        iteration = 0

        while time.time() - start < duration:
            iteration += 1
            print(f"\n  📊 Iteration {iteration} ({datetime.now().strftime('%H:%M:%S')})")

            url = f"{self.base_url}/simple/price"
            params = {
                "ids": ",".join(coin_ids),
                "vs_currencies": "usd,vnd",
                "include_24hr_change": "true",
                "include_market_cap": "true",
                "include_24hr_vol": "true",
                "include_last_updated_at": "true",
            }

            try:
                response = self.session.get(url, params=params, timeout=15)
                response.raise_for_status()
                prices = response.json()

                for coin_id, data in prices.items():
                    event = {
                        "coin_id": coin_id,
                        "price_usd": data.get("usd"),
                        "price_vnd": data.get("vnd"),
                        "change_24h_pct": data.get("usd_24h_change"),
                        "market_cap_usd": data.get("usd_market_cap"),
                        "volume_24h_usd": data.get("usd_24h_vol"),
                        "last_updated": data.get("last_updated_at"),
                        "_event_type": "price_update",
                        "_iteration": iteration,
                    }
                    self.send(event)

                print(f"    ✅ Updated {len(prices)} coins")

            except Exception as e:
                print(f"    ❌ Error: {e}")

            time.sleep(interval)

        print(f"\n✅ Monitored {iteration} iterations")


# ============ OpenWeather Crawler ============
class WeatherCrawler(BaseCrawler):
    """Crawl thời tiết các thành phố lớn (Open-Meteo - free, no key)."""

    CITIES = {
        "hanoi": (21.0285, 105.8542),
        "hcmc": (10.8231, 106.6297),
        "danang": (16.0544, 108.2022),
        "haiphong": (20.8449, 106.6881),
        "cantho": (10.0452, 105.7469),
        "nhatrang": (12.2388, 109.1967),
        "hue": (16.4637, 107.5909),
        "dalat": (11.9404, 108.4583),
    }

    def __init__(self):
        super().__init__("weather", TOPIC_WEATHER)
        self.base_url = "https://api.open-meteo.com/v1/forecast"

    def crawl_current_weather(self):
        """Crawl thời tiết hiện tại của tất cả cities."""
        print(f"\n{'='*60}")
        print(f"🌤️  Weather Crawler (Open-Meteo)")
        print(f"   Cities: {len(self.CITIES)}")
        print(f"{'='*60}")

        for city, (lat, lon) in self.CITIES.items():
            params = {
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m",
                "timezone": "Asia/Bangkok",
            }

            try:
                response = self.session.get(self.base_url, params=params, timeout=15)
                response.raise_for_status()
                data = response.json()

                current = data.get("current", {})
                event = {
                    "city": city,
                    "latitude": lat,
                    "longitude": lon,
                    "temperature_c": current.get("temperature_2m"),
                    "apparent_temperature_c": current.get("apparent_temperature"),
                    "humidity_pct": current.get("relative_humidity_2m"),
                    "is_day": current.get("is_day"),
                    "precipitation_mm": current.get("precipitation"),
                    "rain_mm": current.get("rain"),
                    "weather_code": current.get("weather_code"),
                    "wind_speed_kmh": current.get("wind_speed_10m"),
                    "wind_direction_deg": current.get("wind_direction_10m"),
                    "timestamp": current.get("time"),
                }
                self.send(event)

            except Exception as e:
                print(f"  ❌ {city}: {e}")

        print(f"\n✅ Total: {self.count} weather readings")

    def monitor_weather(self, interval: int = 300, duration: int = 3600):
        """Monitor thời tiết mỗi `interval` giây."""
        print(f"\n🌡️  Monitoring weather every {interval}s for {duration}s")
        start = time.time()
        iteration = 0

        while time.time() - start < duration:
            iteration += 1
            print(f"  📊 Iteration {iteration}")
            self.crawl_current_weather()
            time.sleep(interval)

        print(f"\n✅ Monitored {iteration} iterations")


# ============ Hacker News Crawler ============
class HackerNewsCrawler(BaseCrawler):
    """Crawl top stories từ Hacker News (Firebase API - free)."""

    def __init__(self):
        super().__init__("hackernews", TOPIC_NEWS)
        self.base_url = "https://hacker-news.firebaseio.com/v0"

    def crawl_top_stories(self, max_stories: int = 30):
        """Crawl top N stories."""
        print(f"\n{'='*60}")
        print(f"📰 Hacker News Top Stories")
        print(f"   Max: {max_stories}")
        print(f"{'='*60}")

        try:
            # Get top story IDs
            response = self.session.get(f"{self.base_url}/topstories.json", timeout=15)
            response.raise_for_status()
            story_ids = response.json()[:max_stories]

            print(f"  ✅ Got {len(story_ids)} top story IDs")

            for idx, story_id in enumerate(story_ids):
                # Crawl chi tiết
                response = self.session.get(f"{self.base_url}/item/{story_id}.json", timeout=10)
                response.raise_for_status()
                story = response.json()

                if not story:
                    continue

                event = {
                    "id": story["id"],
                    "title": story.get("title"),
                    "url": story.get("url"),
                    "score": story.get("score", 0),
                    "by": story.get("by"),
                    "time": story.get("time"),
                    "descendants": story.get("descendants", 0),
                    "type": story.get("type"),
                    "_rank": idx + 1,
                    "_rank_category": "top",
                }
                self.send(event)

                time.sleep(0.2)  # Polite delay

        except Exception as e:
            print(f"  ❌ Error: {e}")

        print(f"\n✅ Total: {self.count} stories")


# ============ Main ============
def main():
    parser = argparse.ArgumentParser(description="Multi-Source Crawler")
    parser.add_argument("--source", choices=["github", "crypto", "weather", "hackernews", "all"],
                        default="all", help="Nguồn để crawl")
    parser.add_argument("--top-n", type=int, default=100, help="Top N (cho crypto)")
    parser.add_argument("--language", type=str, default="", help="Language filter (cho GitHub)")
    parser.add_argument("--max-stories", type=int, default=30, help="Max stories (cho HN)")
    parser.add_argument("--monitor", action="store_true", help="Chế độ monitor real-time")
    parser.add_argument("--interval", type=int, default=30, help="Interval cho monitor (giây)")
    parser.add_argument("--duration", type=int, default=300, help="Duration cho monitor (giây)")

    args = parser.parse_args()

    print("=" * 60)
    print(f"🕷️  Multi-Source Crawler")
    print(f"   Source: {args.source}")
    if args.monitor:
        print(f"   Mode: MONITOR (every {args.interval}s for {args.duration}s)")
    print("=" * 60)

    sources_to_run = ["github", "crypto", "weather", "hackernews"] if args.source == "all" else [args.source]

    crawlers = []

    try:
        if "github" in sources_to_run:
            gh = GitHubTrendingCrawler()
            crawlers.append(gh)
            gh.crawl_trending(language=args.language)

        if "crypto" in sources_to_run:
            cg = CoinGeckoCrawler()
            crawlers.append(cg)
            if args.monitor:
                # Monitor BTC, ETH, BNB, SOL
                cg.monitor_prices(
                    ["bitcoin", "ethereum", "binancecoin", "solana"],
                    interval=args.interval, duration=args.duration
                )
            else:
                cg.crawl_top_coins(args.top_n, "usd")

        if "weather" in sources_to_run:
            wx = WeatherCrawler()
            crawlers.append(wx)
            wx.crawl_current_weather()

        if "hackernews" in sources_to_run:
            hn = HackerNewsCrawler()
            crawlers.append(hn)
            hn.crawl_top_stories(args.max_stories)

    finally:
        for c in crawlers:
            c.close()

        total = sum(c.count for c in crawlers)
        print(f"\n{'='*60}")
        print(f"🎉 Total events crawled: {total}")
        print(f"📁 Files: data-samples/*.jsonl.gz")
        print(f"{'='*60}")


if __name__ == "__main__":
    main()
