import { BaseCrawler, type CrawlerContext } from './base-crawler';
import type { CrawlerItem } from '../types';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  high_24h: number;
  low_24h: number;
  circulating_supply: number;
  last_updated: string;
}

export class CryptoCrawlerImpl extends BaseCrawler {
  readonly name = 'crypto' as const;
  readonly sourceName = 'coingecko';
  readonly description = 'Crypto prices from CoinGecko (top markets)';
  readonly kafkaTopic = 'crypto.prices';
  readonly maxItemsPerRun = 250;

  async crawl(ctx: CrawlerContext): Promise<CrawlerItem[]> {
    const items: CrawlerItem[] = [];
    const perPage = Math.min(ctx.request.maxPages * 10, 250);
    const category = ctx.request.category;
    let url = `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=false&price_change_percentage=24h`;
    if (category) {
      url += `&category=${encodeURIComponent(category)}`;
    }
    try {
      const data = (await this.fetchJson(url, {
        timeoutMs: ctx.config.timeout * 1000,
        headers: { 'User-Agent': ctx.config.userAgent },
      })) as CoinGeckoMarket[] | null;
      if (!data) {
        items.push(
          this.fail('crypto-markets', 'No data returned from CoinGecko', this.timestamp()),
        );
        return items;
      }
      for (const coin of data) {
        items.push(
          this.ok(coin.id, {
            coin_id: coin.id,
            symbol: coin.symbol,
            name: coin.name,
            price_usd: coin.current_price,
            market_cap_usd: coin.market_cap,
            market_cap_rank: coin.market_cap_rank,
            volume_24h_usd: coin.total_volume,
            change_24h_pct: coin.price_change_percentage_24h,
            high_24h: coin.high_24h,
            low_24h: coin.low_24h,
            circulating_supply: coin.circulating_supply,
            last_updated: coin.last_updated,
            crawled_at: this.timestamp(),
          }, this.timestamp()),
        );
      }
    } catch (err) {
      items.push(
        this.fail('crypto-crawl', err instanceof Error ? err.message : String(err), this.timestamp()),
      );
    }
    return items;
  }
}