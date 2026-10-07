import { BaseCrawler, type CrawlerContext } from './base-crawler';
import type { CrawlerItem } from '../types';

const OPENWEATHER_API = 'https://api.openweathermap.org/data/2.5';
const DEFAULT_CITIES = ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Can Tho', 'Hai Phong'];

interface OpenWeatherResponse {
  main?: { temp: number; humidity: number; pressure: number };
  weather?: Array<{ main: string; description: string }>;
  wind?: { speed: number };
  sys?: { country: string };
  name?: string;
}

export class WeatherCrawlerImpl extends BaseCrawler {
  readonly name = 'weather' as const;
  readonly sourceName = 'openweather';
  readonly description = 'OpenWeather for major VN cities';
  readonly kafkaTopic = 'weather.observations';
  readonly maxItemsPerRun = 50;

  async crawl(ctx: CrawlerContext): Promise<CrawlerItem[]> {
    const items: CrawlerItem[] = [];
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const cities = ctx.request.category
      ? ctx.request.category.split(',').map((c) => c.trim()).filter(Boolean)
      : DEFAULT_CITIES;
    const limit = Math.min(cities.length, ctx.request.maxPages * 5);
    if (!apiKey) {
      return [
        this.fail(
          'weather-config',
          'OPENWEATHER_API_KEY not set, skipping weather crawl',
          this.timestamp(),
        ),
      ];
    }
    for (const city of cities.slice(0, limit)) {
      const url = `${OPENWEATHER_API}/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
      const data = (await this.fetchJson(url, {
        timeoutMs: ctx.config.timeout * 1000,
        headers: { 'User-Agent': ctx.config.userAgent },
      })) as OpenWeatherResponse | null;
      const ts = this.timestamp();
      if (!data || !data.main) {
        items.push(this.fail(`weather-${city}`, 'No data returned', ts));
        continue;
      }
      items.push(
        this.ok(city.toLowerCase().replace(/\s+/g, '-'), {
          city: data.name ?? city,
          country: data.sys?.country,
          temperature_c: data.main.temp,
          humidity: data.main.humidity,
          pressure: data.main.pressure,
          weather: data.weather?.[0]?.main,
          weather_description: data.weather?.[0]?.description,
          wind_speed: data.wind?.speed,
          crawled_at: ts,
        }, ts),
      );
      await this.sleep(500 / Math.max(ctx.config.rateLimit, 0.1));
    }
    return items;
  }
}