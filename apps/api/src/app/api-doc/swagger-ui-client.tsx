'use client';

import dynamic from 'next/dynamic';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => null,
});

import 'swagger-ui-react/swagger-ui.css';

export default function SwaggerUiClient({ spec }: { spec: object }) {
  return <SwaggerUI spec={spec} />;
}