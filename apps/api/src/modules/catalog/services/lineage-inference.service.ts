import { TableRepository } from '../repositories';
import type { Layer, LineageNode } from '../types';
import { TableService } from './table.service';

const LAYER_ORDER: Record<Layer, number> = { bronze: 0, silver: 1, gold: 2 };

function docToNode(doc: Record<string, unknown> | null): LineageNode | null {
  if (!doc) return null;
  const tableId = doc.tableId as string;
  const parsed = TableService.parseTableId(tableId);
  if (!parsed) return null;
  return { tableId, layer: parsed.layer, database: parsed.database, name: parsed.name };
}

function normalizeName(name: string): string {
  return name.replace(/^stg_/, '').replace(/_enriched$/, '').replace(/_agg$/, '').toLowerCase();
}

function inferAdjacentLayer(current: Layer, direction: 'up' | 'down'): Layer | null {
  const currentOrder = LAYER_ORDER[current];
  const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
  if (targetOrder < 0 || targetOrder > 2) return null;
  return (Object.keys(LAYER_ORDER) as Layer[]).find((k) => LAYER_ORDER[k] === targetOrder) ?? null;
}

export const LineageInferenceService = {
  async inferFromName(tableId: string): Promise<{ upstream: LineageNode[]; downstream: LineageNode[] }> {
    const parsed = TableService.parseTableId(tableId);
    if (!parsed) return { upstream: [], downstream: [] };

    const upstream: LineageNode[] = [];
    const downstream: LineageNode[] = [];

    const candidatesUpstreamLayer = inferAdjacentLayer(parsed.layer, 'up');
    const candidatesDownstreamLayer = inferAdjacentLayer(parsed.layer, 'down');

    const sameLayerCandidates = await TableRepository.list({
      limit: 1000,
      offset: 0,
      ...(parsed.database ? { database: parsed.database } : {}),
    });

    const normalizedSelf = normalizeName(parsed.name);

    for (const doc of sameLayerCandidates) {
      const otherTableId = doc.tableId as string;
      if (!otherTableId || otherTableId === tableId) continue;
      const otherParsed = TableService.parseTableId(otherTableId);
      if (!otherParsed) continue;

      const otherNormalized = normalizeName(otherParsed.name);
      if (otherNormalized === normalizedSelf && otherParsed.layer === parsed.layer) continue;

      if (candidatesUpstreamLayer && otherParsed.layer === candidatesUpstreamLayer) {
        if (otherNormalized === normalizedSelf) {
          const node = docToNode(doc);
          if (node) upstream.push(node);
        }
      }
      if (candidatesDownstreamLayer && otherParsed.layer === candidatesDownstreamLayer) {
        if (otherNormalized === normalizedSelf) {
          const node = docToNode(doc);
          if (node) downstream.push(node);
        }
      }
    }

    return { upstream, downstream };
  },

  async persistInference(tableId: string): Promise<{ upstream: LineageNode[]; downstream: LineageNode[] }> {
    const { upstream, downstream } = await this.inferFromName(tableId);
    await TableRepository.updateLineage(tableId, {
      upstreamTableIds: upstream.map((n) => n.tableId),
      downstreamTableIds: downstream.map((n) => n.tableId),
    });
    for (const upstreamNode of upstream) {
      const upstreamDoc = await TableRepository.findById(upstreamNode.tableId);
      if (!upstreamDoc) continue;
      const existing = (upstreamDoc.lineage as { downstreamTableIds?: string[] } | undefined)?.downstreamTableIds ?? [];
      if (!existing.includes(tableId)) {
        const upstreamLineage = upstreamDoc.lineage as { upstreamTableIds?: string[] } | undefined;
        await TableRepository.updateLineage(upstreamNode.tableId, {
          upstreamTableIds: upstreamLineage?.upstreamTableIds ?? [],
          downstreamTableIds: [...existing, tableId],
        });
      }
    }
    return { upstream, downstream };
  },
};