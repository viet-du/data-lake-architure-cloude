import { BronzeIngestService } from '../services/ingest.service';
import type { BronzeJob } from '../types';
import type {
  TIngestCsvBody,
  TIngestJsonBody,
  TIngestStreamBody,
  TIngestStreamParams,
} from '../schemas';

export const BronzeIngestController = {
  async ingestCsv(body: TIngestCsvBody): Promise<BronzeJob> {
    return BronzeIngestService.ingestCsv(body);
  },

  async ingestJson(body: TIngestJsonBody): Promise<BronzeJob> {
    return BronzeIngestService.ingestJson(body);
  },

  async ingestStream(params: TIngestStreamParams, body: TIngestStreamBody): Promise<BronzeJob> {
    return BronzeIngestService.ingestStream(params, body);
  },
};