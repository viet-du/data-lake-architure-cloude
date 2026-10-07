import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { catalogService, type ListTablesParams } from '../catalog';
import { QUERY_KEYS } from '../query-keys';
import type { DatabaseEntity, TableEntity } from '@/types/entities';

export function useDatabasesQuery(
  options?: Omit<UseQueryOptions<ReadonlyArray<DatabaseEntity>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<DatabaseEntity>, Error>({
    queryKey: QUERY_KEYS.catalog.databases(),
    queryFn: () => catalogService.listDatabases(),
    ...options,
  });
}

export function useDatabaseQuery(
  name: string,
  options?: Omit<UseQueryOptions<DatabaseEntity, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<DatabaseEntity, Error>({
    queryKey: QUERY_KEYS.catalog.database(name),
    queryFn: () => catalogService.getDatabase(name),
    enabled: name.length > 0,
    ...options,
  });
}

export function useCatalogTablesQuery(
  params?: ListTablesParams,
  options?: Omit<UseQueryOptions<unknown, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<unknown, Error>({
    queryKey: QUERY_KEYS.catalog.tables(params),
    queryFn: () => catalogService.listTables(params),
    ...options,
  });
}

export function useCatalogTableQuery(
  tableId: string,
  options?: Omit<UseQueryOptions<TableEntity, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<TableEntity, Error>({
    queryKey: QUERY_KEYS.catalog.table(tableId),
    queryFn: () => catalogService.getTable(tableId),
    enabled: tableId.length > 0,
    ...options,
  });
}

export function useCatalogTableSchemaQuery(
  tableId: string,
  options?: Omit<UseQueryOptions<unknown, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<unknown, Error>({
    queryKey: QUERY_KEYS.catalog.tableSchema(tableId),
    queryFn: () => catalogService.getTableSchema(tableId),
    enabled: tableId.length > 0,
    ...options,
  });
}

export function useCatalogTableLineageQuery(
  tableId: string,
  options?: Omit<UseQueryOptions<unknown, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<unknown, Error>({
    queryKey: QUERY_KEYS.catalog.tableLineage(tableId),
    queryFn: () => catalogService.getTableLineage(tableId),
    enabled: tableId.length > 0,
    ...options,
  });
}

export function useCatalogTableStatsQuery(
  tableId: string,
  options?: Omit<UseQueryOptions<unknown, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<unknown, Error>({
    queryKey: QUERY_KEYS.catalog.tableStats(tableId),
    queryFn: () => catalogService.getTableStats(tableId),
    enabled: tableId.length > 0,
    ...options,
  });
}

export function useCreateDatabaseMutation(
  options?: UseMutationOptions<DatabaseEntity, Error, { name: string; location?: string; description?: string }>,
) {
  const qc = useQueryClient();
  return useMutation<DatabaseEntity, Error, { name: string; location?: string; description?: string }>({
    mutationFn: (payload) => catalogService.createDatabase(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.catalog.databases() });
    },
    ...options,
  });
}

export function useDeleteDatabaseMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (name) => catalogService.deleteDatabase(name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.catalog.all });
    },
    ...options,
  });
}

export function useSyncTableMutation(
  options?: UseMutationOptions<unknown, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (tableId) => catalogService.syncTable(tableId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.catalog.all });
    },
    ...options,
  });
}
