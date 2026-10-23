import { z } from 'zod';
import { decodeDatabase, decodeDatabases, decodeTable, decodeTables } from './catalog.adapter';
import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import type { ApiResponse, Pagination } from '@/types/commons';
import type { DatabaseEntity, TableEntity } from '@/types/entities';

export interface ListTablesParams {
  database?: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface ListTablesResult {
  items: ReadonlyArray<TableEntity>;
  pagination: Pagination;
}

export interface TableSyncResult {
  tableId: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  startedAt: string;
}

export const catalogService = {
  listDatabases: async (): Promise<ReadonlyArray<DatabaseEntity>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<DatabaseEntity>>>(
      ENDPOINTS.catalog.databases,
    );
    return decodeDatabases(res.data.data);
  },

  getDatabase: async (name: string): Promise<DatabaseEntity> => {
    const res = await apiClient.get<ApiResponse<DatabaseEntity>>(
      ENDPOINTS.catalog.database(name),
    );
    return decodeDatabase(res.data.data);
  },

  createDatabase: async (payload: { name: string; location?: string; description?: string }): Promise<DatabaseEntity> => {
    const res = await apiClient.post<ApiResponse<DatabaseEntity>>(
      ENDPOINTS.catalog.databases,
      { database: payload.name, description: payload.description },
    );
    return decodeDatabase(res.data.data);
  },

  deleteDatabase: async (name: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.catalog.database(name));
  },

  listTablesInDatabase: async (name: string): Promise<ReadonlyArray<TableEntity>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<TableEntity>>>(
      ENDPOINTS.catalog.databaseTables(name),
    );
    return decodeTables(res.data.data);
  },

  listTables: async (params: ListTablesParams = {}): Promise<ListTablesResult> => {
    const res = await apiClient.get<ApiResponse<ListTablesResult>>(
      ENDPOINTS.catalog.tables,
      { params: { database: params.database, search: params.search, limit: params.pageSize ?? 50, offset: ((params.page ?? 1) - 1) * (params.pageSize ?? 50) } },
    );
    const items = decodeTables(res.data.data);
    return { items, pagination: { page: params.page ?? 1, pageSize: params.pageSize ?? 50, total: items.length } };
  },

  getTable: async (tableId: string): Promise<TableEntity> => {
    const res = await apiClient.get<ApiResponse<TableEntity>>(
      ENDPOINTS.catalog.table(tableId),
    );
    return decodeTable(res.data.data);
  },

  updateTable: async (tableId: string, payload: Partial<TableEntity>): Promise<TableEntity> => {
    const res = await apiClient.put<ApiResponse<TableEntity>>(
      ENDPOINTS.catalog.table(tableId),
      payload,
    );
    return decodeTable(res.data.data);
  },

  deleteTable: async (tableId: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.catalog.table(tableId));
  },

  getTableSchema: async (tableId: string) => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<unknown>>>(
      ENDPOINTS.catalog.tableSchema(tableId),
    );
    return z.object({ columns: z.array(z.object({ name: z.string(), type: z.string(), nullable: z.boolean() })) }).parse(res.data.data).columns;
  },

  getTableLineage: async (tableId: string): Promise<unknown> => {
    const res = await apiClient.get<ApiResponse<unknown>>(
      ENDPOINTS.catalog.tableLineage(tableId),
    );
    return res.data.data;
  },

  getTableSample: async (tableId: string) => {
    const res = await apiClient.get<ApiResponse<unknown>>(
      ENDPOINTS.catalog.tableSample(tableId),
    );
    return z.array(z.record(z.unknown())).parse(res.data.data);
  },

  syncTable: async (tableId: string): Promise<TableSyncResult> => {
    const res = await apiClient.post<ApiResponse<TableSyncResult>>(
      ENDPOINTS.catalog.tableSync(tableId),
      {},
    );
    return res.data.data;
  },

  getTableStats: async (tableId: string): Promise<unknown> => {
    const res = await apiClient.get<ApiResponse<unknown>>(
      ENDPOINTS.catalog.tableStats(tableId),
    );
    return res.data.data;
  },

  getHealth: async (): Promise<unknown> => {
    const res = await apiClient.get<ApiResponse<unknown>>(ENDPOINTS.catalog.health);
    return res.data.data;
  },
};
