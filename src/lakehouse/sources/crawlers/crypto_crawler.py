from __future__ import annotations

import argparse
import logging
from typing import Any

from lakehouse.core.constants import KafkaTopics
from lakehouse.sources.crawlers.base import BaseCrawler

logger = logging.getLogger(__name__)


class CryptoCrawler(BaseCrawler):
    API_BASE = "https://api.coingecko.com/api/v3"
    TOP_COINS = [
        "bitcoin",
        "ethereum",
        "binancecoin",
        "solana",
        "cardano",
        "ripple",
        "polkadot",
        "dogecoin",
    ]

    @property
    def source_name(self) -> str:
        return "coingecko"

    @property
    def kafka_topic(self) -> str:
        return KafkaTopics.CRYPTO_PRICES

    def crawl(
        self,
        *,
        vs_currency: str = "usd",
        coins: list[str] | None = None,
        per_page: int | None = None,
    ) -> list[dict[str, Any]]:
        if per_page is not None:
            if not 1 <= per_page <= 250:
                raise ValueError("per_page must be between 1 and 250")
            logger.info(" Crawling top %d crypto markets, vs=%s", per_page, vs_currency)
            url = (
                f"{self.API_BASE}/coins/markets?vs_currency={vs_currency}"
                f"&order=market_cap_desc&per_page={per_page}&page=1&sparkline=false"
            )
            data = self._get_json(url)
            if not isinstance(data, list):
                return []
            return [
                self.process(
                    {
                        "coin_id": item.get("id"),
                        "symbol": item.get("symbol"),
                        "name": item.get("name"),
                        "vs_currency": vs_currency,
                        "price": item.get("current_price"),
                        "change_24h_pct": item.get("price_change_percentage_24h"),
                        "market_cap": item.get("market_cap"),
                        "volume_24h": item.get("total_volume"),
                        "market_cap_rank": item.get("market_cap_rank"),
                        "last_updated": item.get("last_updated"),
                    }
                )
                for item in data
            ]

        coins = coins or self.TOP_COINS
        logger.info(" Crawling crypto: %d coins, vs=%s", len(coins), vs_currency)
        ids = ",".join(coins)
        url = f"{self.API_BASE}/simple/price?ids={ids}&vs_currencies={vs_currency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true"
        data = self._get_json(url)
        if not data:
            return []
        items = []
        for coin_id, price_data in data.items():
            processed = self.process(
                {
                    "coin_id": coin_id,
                    "vs_currency": vs_currency,
                    "price": price_data.get(vs_currency),
                    "change_24h_pct": price_data.get(f"{vs_currency}_24h_change"),
                    "market_cap": price_data.get(f"{vs_currency}_market_cap"),
                    "volume_24h": price_data.get(f"{vs_currency}_24h_vol"),
                }
            )
            items.append(processed)
        logger.info(" Crawled %d coins", len(items))
        return items


def main() -> None:
    parser = argparse.ArgumentParser(description="CoinGecko Crypto Crawler")
    parser.add_argument("--vs-currency", default="usd")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    with CryptoCrawler() as crawler:
        items = crawler.crawl(vs_currency=args.vs_currency)
        crawler.send_to_kafka(items)


if __name__ == "__main__":
    main()
