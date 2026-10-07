import type { ReactNode } from 'react';

export const metadata = {
  title: 'Data Lake Control Plane API',
  description: 'Backend control plane for data lakehouse (Bronze/Silver/Gold + Crawler + Kafka + Airflow + DQ)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 24 }}>
        {children}
      </body>
    </html>
  );
}