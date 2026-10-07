export interface QueryResult {
  query: string;
  rowCount: number;
  rows: Array<Record<string, unknown>>;
  columns: string[];
  durationMs: number;
}

export interface QueryFile {
  id: string;
  name: string;
  description: string;
  file: string;
}