import { DqSummaryService } from '../services/dq.service';
import type { DqSummary, DqPreset } from '../types';

export const DqSummaryController = {
  async summary(): Promise<DqSummary> {
    return DqSummaryService.summary();
  },

  async presets(): Promise<{ total: number; items: DqPreset[] }> {
    return DqSummaryService.presets();
  },
};