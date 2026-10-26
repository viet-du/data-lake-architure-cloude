import { EdaService } from '../services/eda.service';
import type {
  ColumnProfile,
  DatasetProfile,
  ProfileChart,
  ProfileListResult,
} from '../types';
import type {
  TCompareProfilesBody,
  TCreateProfileBody,
  TProfileColumnsQuery,
  TProfileListQuery,
  TProfileSampleQuery,
  TProposeRuleBody,
} from '../schemas';

/**
 * The EDA controller.
 *
 * The controller is a thin adapter: it validates nothing (the schema did
 * that) and decides nothing (the service owns the semantics). It exists so
 * the route handlers stay declarative.
 */
export const EdaController = {
  async create(body: TCreateProfileBody): Promise<DatasetProfile> {
    return EdaService.create(body);
  },

  async get(profileId: string): Promise<DatasetProfile> {
    return EdaService.getOrFail(profileId);
  },

  async list(query: TProfileListQuery): Promise<ProfileListResult> {
    return EdaService.list(query);
  },

  async columns(
    profileId: string,
    query: TProfileColumnsQuery,
  ): Promise<{ profileId: string; total: number; columns: ColumnProfile[] }> {
    return EdaService.columns(profileId, query);
  },

  async chart(profileId: string, chartId: string): Promise<ProfileChart> {
    return EdaService.chart(profileId, chartId);
  },

  async charts(profileId: string): Promise<ProfileChart[]> {
    return EdaService.charts(profileId);
  },

  async sample(
    profileId: string,
    query: TProfileSampleQuery,
  ): Promise<{
    profileId: string;
    datasetId: string;
    limit: number;
    rows: Array<Record<string, unknown>>;
  }> {
    return EdaService.sample(profileId, query);
  },

  async compare(body: TCompareProfilesBody): Promise<Awaited<ReturnType<typeof EdaService.compare>>> {
    return EdaService.compare(body);
  },

  async proposeRule(body: TProposeRuleBody): Promise<Awaited<ReturnType<typeof EdaService.proposeRule>>> {
    return EdaService.proposeRule(body);
  },
};
