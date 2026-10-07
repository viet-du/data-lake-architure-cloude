import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { AirflowClusterController } from '@/modules/airflow/controllers';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await AirflowClusterController.stats();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/airflow/stats:
 *   get:
 *     tags: [Airflow]
 *     summary: Airflow stats (running, failed, success)
 *     responses:
 *       200: { description: Airflow stats }
 */
