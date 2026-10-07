import { createSwaggerSpec } from 'next-swagger-doc';
import { SwaggerUiClient } from '@/app/api-doc';
import { SWAGGER_API_FOLDER, SWAGGER_TITLE, SWAGGER_VERSION } from '@/config';

export const dynamic = 'force-dynamic';

export default function ApiDocPage() {
  const spec = createSwaggerSpec({
    apiFolder: SWAGGER_API_FOLDER,
    autoDoc: true,
    definition: {
      openapi: '3.0.0',
      info: { title: SWAGGER_TITLE, version: SWAGGER_VERSION },
      servers: [{ url: '/' }],
    },
  });

  return <SwaggerUiClient spec={spec} />;
}