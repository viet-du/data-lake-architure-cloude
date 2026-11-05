import { BaseCrawler, type CrawlerContext } from './base-crawler';
import type { CrawlerItem } from '../types';
import { logger } from '@/lib/logger';

const TIKI_CATEGORIES_API = 'https://api.tiki.vn/raiden/v2/menu-config';
const TIKI_SEARCH_API = 'https://api.tiki.vn/v3/search';

interface TikiCategoryNode {
  id?: number;
  text?: string;
  link?: string;
  icon?: string;
  children?: TikiCategoryNode[];
}

interface TikiCategoryResponse {
  menu_block?: {
    items?: TikiCategoryNode[];
  };
  data?: TikiCategoryNode[];
}

// Tiki's `/raiden/v2/menu-config` historically returned an array directly,
// but the current shape wraps items under `menu_block.items`. Be defensive.
function extractCategoryTree(raw: unknown): TikiCategoryNode[] | null {
  if (Array.isArray(raw)) return raw as TikiCategoryNode[];
  if (raw && typeof raw === 'object') {
    const wrapped = raw as TikiCategoryResponse;
    if (Array.isArray(wrapped.menu_block?.items)) {
      return wrapped.menu_block.items;
    }
    if (Array.isArray(wrapped.data)) {
      return wrapped.data;
    }
  }
  return null;
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
      const raw = (await this.fetchJson(TIKI_CATEGORIES_API, {
        timeoutMs: ctx.config.timeout * 1000,
        headers: { 'User-Agent': ctx.config.userAgent },
      })) as unknown;
      logger.info({ topKeys: raw && typeof raw === 'object' ? Object.keys(raw) : null, isArray: Array.isArray(raw) }, 'Tiki raw shape');
      const tree = extractCategoryTree(raw);
      if (!tree) {
        const reason =
          raw === null || raw === undefined
            ? 'category tree endpoint returned empty body'
            : `unexpected payload shape: ${JSON.stringify(raw).slice(0, 200)}`;
        items.push(this.fail('tiki-categories', reason, this.timestamp()));
        return items;
      }
      const flat = this.flattenCategories(tree);
      logger.info({ flatCount: flat.length, sample: flat.slice(0,3).map(c => c.text) }, 'Tiki flat categories');
      const selected = category
        ? flat.filter((c) => c.text?.toLowerCase().includes(category.toLowerCase()))
        : flat.slice(0, maxPages);
      logger.info({ selectedCount: selected.length, category, maxPages }, 'Tiki selected');
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
      logger.error({ err: err instanceof Error ? err.stack : String(err) }, 'Tiki crawl top-level error');
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
    const raw = (await this.fetchJson(url, {
      timeoutMs: ctx.config.timeout * 1000,
      headers: { 'User-Agent': ctx.config.userAgent },
    })) as { data?: Array<Record<string, unknown>>; error?: unknown } | null;
    const ts = this.timestamp();
    if (!raw) {
      return [this.fail(`tiki-cat-${category.id}`, 'No products returned', ts)];
    }
    if (!Array.isArray(raw.data)) {
      const reason =
        typeof raw === 'object'
          ? `unexpected search payload: ${JSON.stringify(raw).slice(0, 200)}`
          : 'search body is not an object';
      return [this.fail(`tiki-cat-${category.id}`, reason, ts)];
    }
    return raw.data.map((p) =>
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