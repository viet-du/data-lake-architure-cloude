import type { BronzeJobPayload } from '../queues/bronze.queue';

export async function processCsvIngest(payload: BronzeJobPayload): Promise<{ rowsIngested: number; bytesProcessed: number }> {
  if (!payload.source) throw new Error('CSV ingest requires source path');
  throw new Error('Bronze ingestion executor is not implemented; no data was written');
}

export async function processJsonIngest(payload: BronzeJobPayload): Promise<{ rowsIngested: number; bytesProcessed: number }> {
  if (!payload.source) throw new Error('JSON ingest requires source path');
  throw new Error('Bronze ingestion executor is not implemented; no data was written');
}

export async function processStreamIngest(payload: BronzeJobPayload): Promise<{ rowsIngested: number; bytesProcessed: number }> {
  if (!payload.topic) throw new Error('Stream ingest requires Kafka topic');
  throw new Error('Bronze ingestion executor is not implemented; no data was written');
}
