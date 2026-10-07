import { BaseCrawler, type CrawlerContext } from './base-crawler';
import type { CrawlerItem } from '../types';

const TIKI_CATEGORIES_API = 'https://api.tiki.vn/raiden/v2/menu-config';
const TIKI_SEARCH_API = 'https://api.tiki.vn/v3/search';

interface TikiCategoryNode {
  id?: number;
  text?: string;
  link?: string;
  icon?: string;
  children?: TikiCategoryNode[];
}

export class TikiCrawlerImpl extends BaseCrawler {
  readonly name = 'tiki' as const;
  readonly sourceName = 'tiki';
  readonly description = 'Tiki e-commerce product crawler (categories, products, prices)';
  readonly kafkaTopic = 'tiki.products';
  readonly maxItemsPerRun = 200;

  async crawl(ctx: CrawlerContext): Promise<CrawlerItem[]> {
    const items: CrawlerItem[] = [];
    const maxPages = ctx.request.maxPages;
    const category = ctx.request.category ?? '';
    try {
      const tree = (await this.fetchJson(TIKI_CATEGORIES_API, {
        timeoutMs: ctx.config.timeout * 1000,
        headers: { 'User-Agent': ctx.config.userAgent },
      })) as TikiCategoryNode[] | null;
      if (!tree) {
        items.push(
          this.fail('tiki-categories', 'Failed to fetch category tree', this.timestamp()),
        );
        return items;
      }
      const flat = this.flattenCategories(tree);
      const selected = category
        ? flat.filter((c) => c.text?.toLowerCase().includes(category.toLowerCase()))
        : flat.slice(0, maxPages);
      if (selected.length === 0) {
        items.push(
          this.skip('tiki-categories', 'No categories matched filter', this.timestamp()),
        );
        return items;
      }
      for (const cat of selected.slice(0, maxPages)) {
        const fetched = await this.crawlCategory(cat, ctx);
        items.push(...fetched);
        if (items.length >= ctx.config.maxWorkers * 10) break;
      }
    } catch (err) {
      items.push(
        this.fail('tiki-crawl', err instanceof Error ? err.message : String(err), this.timestamp()),
      );
    }
    return items;
  }

  private flattenCategories(nodes: TikiCategoryNode[], depth = 0): TikiCategoryNode[] {
    const out: TikiCategoryNode[] = [];
    for (const node of nodes) {
      out.push({ ...node, text: `${'  '.repeat(depth)}${node.text ?? ''}` });
      if (node.children && depth < 2) {
        out.push(...this.flattenCategories(node.children, depth + 1));
      }
    }
    return out;
  }

  private async crawlCategory(
    category: TikiCategoryNode,
    ctx: CrawlerContext,
  ): Promise<CrawlerItem[]> {
    if (!category.id) return [];
    const url = `${TIKI_SEARCH_API}?category=${category.id}&limit=10&page=1`;
    const data = (await this.fetchJson(url, {
      timeoutMs: ctx.config.timeout * 1000,
      headers: { 'User-Agent': ctx.config.userAgent },
    })) as { data?: Array<Record<string, unknown>> } | null;
    const ts = this.timestamp();
    if (!data || !data.data) {
      return [this.fail(`tiki-cat-${category.id}`, 'No products returned', ts)];
    }
    return data.data.map((p) =>
      this.ok(String(p.id ?? `${category.id}-${Math.random()}`), {
        product_id: p.id,
        name: p.name,
        category_id: category.id,
        category_name: category.text,
        price: p.price,
        original_price: p.original_price,
        discount: p.discount,
        rating: p.rating_average,
        review_count: p.review_count,
        url: p.url_key,
        thumbnail: p.thumbnail_url,
        crawled_at: ts,
      }, ts),
    );
  }
}