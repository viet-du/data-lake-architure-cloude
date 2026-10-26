/**
 * Phase 1 exit-gate proof: a single DQ rule evaluated against a dataset that
 * was really committed by the Bronze/Silver pipeline.
 *
 * The proof is deliberately executed *outside* the HTTP layer: the exit gate
 * asks for "DQ single-rule proof on known version", i.e. evidence that the
 * evaluator reads the same canonical Delta tables the pipeline wrote and
 * reports honest metrics (evaluatedRows / skippedRows / coverageRate /
 * passRate=null when there is no evidence).
 *
 * Usage:
 *   pnpm exec tsx src/modules/dq/scripts/proof-single-rule.ts \
 *     --layer silver --table erp.orders --column order_id --type unique
 */
import '@/config/apply-env';

import { DqExecutor } from '../executors/dq.executor';

interface Args {
  layer: string;
  table: string;
  column: string;
  type: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    layer: 'silver',
    table: 'erp.orders',
    column: 'order_id',
    type: 'unique',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined) continue;
    i += 1;
    if (key === 'layer') args.layer = value;
    else if (key === 'table') args.table = value;
    else if (key === 'column') args.column = value;
    else if (key === 'type') args.type = value;
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rule = {
    ruleId: `proof-${args.layer}-${args.table}-${args.column}`,
    type: args.type,
    layer: args.layer,
    table: args.table,
    column: args.column,
    params: {},
  } as Parameters<typeof DqExecutor.run>[0];

  const result = await DqExecutor.run(rule, { limit: 10_000, sampleSize: 5 });

  console.log(
    JSON.stringify(
      {
        status: result.status,
        ruleId: result.ruleId,
        dataset: `${args.layer}.${args.table}`,
        column: args.column,
        totalRows: result.totalRows,
        evaluatedRows: result.evaluatedRows,
        skippedRows: result.skippedRows,
        failedRows: result.failedRows,
        passRate: result.passRate,
        coverageRate: result.coverageRate,
        sampleFailureCount: result.sampleFailures.length,
        errorMessage: result.errorMessage,
        durationMs: result.durationMs,
      },
      null,
      2,
    ),
  );

  // The gate: the executor must never manufacture a success.
  //
  //   * a rule that evaluated rows must report a real pass rate;
  //   * a rule that evaluated nothing must report `not_evaluated` or
  //     `error` with `passRate: null` — never `pass`;
  //   * `pass` with a `null` pass rate is the definition of a false success.
  const falseSuccess =
    result.status === 'pass' && result.passRate === null;
  const honestWhenEvaluated =
    result.evaluatedRows > 0 ? result.passRate !== null : true;
  const honestWhenNotEvaluated =
    result.evaluatedRows > 0 ||
    result.status === 'not_evaluated' ||
    result.status === 'error' ||
    result.passRate === null;
  if (falseSuccess || !honestWhenEvaluated || !honestWhenNotEvaluated) {
    console.error('DQ PROOF FAILED: inconsistent metrics');
    process.exitCode = 1;
    return;
  }
  console.log('DQ PROOF OK');
}

void main().catch((error: unknown) => {
  console.error('DQ PROOF ERROR:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
