import { SearchService } from '../services/search.service';
import type { TableMeta } from '../types';
import type { TSearchQuery } from '../schemas';

export const SearchController = {
  async search(query: TSearchQuery): Promise<TableMeta[]> {
    return SearchService.searchTables(query);
  },
};