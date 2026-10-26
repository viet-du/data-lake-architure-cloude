import { z } from 'zod';
import {
  columnProfileSchema,
  datasetProfileSchema,
  profileAcceptedSchema,
  profileChartSchema,
  profileComparisonSchema,
  profileListSchema,
  profileSampleSchema,
  proposedRuleSchema,
} from '@/schemas/eda';
import type {
  EColumnProfile,
  EDatasetProfile,
  EProfileAccepted,
  EProfileChart,
  EProfileComparison,
  EProfileListResult,
  EProfileSample,
  EProposedRule,
} from '@/types/entities';

/**
 * The EDA decoders.
 *
 * Every decoder parses the *actual* backend payload and returns the client
 * entity. The parsers are deliberately strict: a response that does not
 * match the contract raises a `ZodError`, which the API client turns into
 * the "invalid response" message instead of a half-rendered chart.
 */

export function decodeProfile(input: unknown): EDatasetProfile {
  return datasetProfileSchema.parse(input) as EDatasetProfile;
}

export function decodeProfileList(input: unknown): EProfileListResult {
  return profileListSchema.parse(input) as EProfileListResult;
}

export function decodeProfileAccepted(input: unknown): EProfileAccepted {
  return profileAcceptedSchema.parse(input) as EProfileAccepted;
}

export function decodeProfileColumns(input: unknown): {
  profileId: string;
  total: number;
  columns: ReadonlyArray<EColumnProfile>;
} {
  const value = z
    .object({
      profileId: z.string(),
      total: z.number(),
      columns: z.array(z.unknown()),
    })
    .parse(input);
  return {
    profileId: value.profileId,
    total: value.total,
    columns: value.columns.map((column) => columnProfileSchema.parse(column)),
  };
}

export function decodeProfileChart(input: unknown): EProfileChart {
  return profileChartSchema.parse(input) as EProfileChart;
}

export function decodeProfileCharts(input: unknown): ReadonlyArray<EProfileChart> {
  const value = z.object({ charts: z.array(z.unknown()) }).parse(input);
  return value.charts.map((chart) => profileChartSchema.parse(chart));
}

export function decodeProfileSample(input: unknown): EProfileSample {
  return profileSampleSchema.parse(input) as EProfileSample;
}

export function decodeProfileComparison(input: unknown): EProfileComparison {
  return profileComparisonSchema.parse(input) as EProfileComparison;
}

export function decodeProposedRule(input: unknown): EProposedRule {
  return proposedRuleSchema.parse(input) as EProposedRule;
}
