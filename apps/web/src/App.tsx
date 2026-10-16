import { useEffect, useState } from 'react';
import { healthResponseSchema, type HealthResponse } from '@isaac-atlas/shared';

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setHealth(healthResponseSchema.parse(data)))
      .catch(() => setHealth(null));
  }, []);

  return (
    <main>
      <h1>Isaac Atlas</h1>
      <p>API: {health ? `ok · db ${health.db}` : 'sin conexión'}</p>
    </main>
  );
}
