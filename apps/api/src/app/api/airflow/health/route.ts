import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { AirflowClusterController } from '@/modules/airflow/controllers';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await AirflowClusterController.health();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/airflow/health:
 *   get:
 *     tags: [Airflow]
 *     summary: Airflow cluster health (webserver + scheduler + metadb)
 *     responses:
 *       200: { description: Health status }
 */
