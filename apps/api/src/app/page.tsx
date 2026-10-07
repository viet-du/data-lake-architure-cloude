import Link from 'next/link';
import { APP_NAME, APP_VERSION } from '@/config';

export default function HomePage() {
  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p>Version {APP_VERSION}</p>
      <ul>
        <li>
          <Link href="/api-doc">API Documentation (Swagger UI)</Link>
        </li>
        <li>
          <Link href="/api/health">Health Check</Link>
        </li>
        <li>
          <Link href="/api/health/deep">Deep Health Check</Link>
        </li>
        <li>
          <Link href="/api/info">App Info</Link>
        </li>
      </ul>
    </main>
  );
}