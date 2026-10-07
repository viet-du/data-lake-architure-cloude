import { NotFoundError } from '@/errors';
import { TableRepository } from '../repositories';
import { TableService } from './table.service';
import type { LineageGraph, LineageNode } from '../types';

function docToNode(doc: Record<string, unknown> | null): LineageNode | null {
  if (!doc) return null;
  const tableId = doc.tableId as string;
  const parsed = TableService.parseTableId(tableId);
  if (!parsed) return null;
  return {
    tableId,
    layer: parsed.layer,
    database: parsed.database,
    name: parsed.name,
  };
}

export const LineageService = {
  async getLineage(tableId: string): Promise<LineageGraph> {
    const doc = await TableRepository.findById(tableId);
    if (!doc) throw new NotFoundError('Table', tableId);

    const lineage = doc.lineage as { upstreamTableIds?: string[]; downstreamTableIds?: string[] } | undefined;
    const upstreamIds = lineage?.upstreamTableIds ?? [];
    const downstreamIds = lineage?.downstreamTableIds ?? [];

    const upstreamDocs = await Promise.all(upstreamIds.map((id) => TableRepository.findById(id)));
    const downstreamDocs = await Promise.all(downstreamIds.map((id) => TableRepository.findById(id)));

    return {
      tableId,
      upstream: upstreamDocs.map(docToNode).filter((n): n is LineageNode => n !== null),
      downstream: downstreamDocs.map(docToNode).filter((n): n is LineageNode => n !== null),
    };
  },

  async setUpstream(tableId: string, upstreamTableIds: string[]): Promise<void> {
    for (const upstreamId of upstreamTableIds) {
      const upstreamDoc = await TableRepository.findById(upstreamId);
      if (!upstreamDoc) throw new NotFoundError('Upstream table', upstreamId);
    }
    const current = await TableRepository.findById(tableId);
    if (!current) throw new NotFoundError('Table', tableId);
    const currentLineage = current.lineage as { downstreamTableIds?: string[] } | undefined;
    const currentDownstream = currentLineage?.downstreamTableIds ?? [];
    await TableRepository.updateLineage(tableId, {
      upstreamTableIds,
      downstreamTableIds: currentDownstream,
    });
    for (const upstreamId of upstreamTableIds) {
      const upstreamDoc = await TableRepository.findById(upstreamId);
      if (!upstreamDoc) continue;
      const upstreamLineage = upstreamDoc.lineage as
        | { upstreamTableIds?: string[]; downstreamTableIds?: string[] }
        | undefined;
      const existing = upstreamLineage?.downstreamTableIds ?? [];
      if (!existing.includes(tableId)) {
        await TableRepository.updateLineage(upstreamId, {
          upstreamTableIds: upstreamLineage?.upstreamTableIds ?? [],
          downstreamTableIds: [...existing, tableId],
        });
      }
    }
  },

  inferTableIdByName: TableService.parseTableId,
};