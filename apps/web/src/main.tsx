import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ApiRequestError } from './api/client';
import './i18n';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    // La web queda abierta de fondo: evitamos refetch en cada foco de la ventana.
    // Render gratis duerme el servicio: los fallos de red y los 5xx del arranque se reintentan.
    // Los errores de la API (4xx: validación, permisos, no encontrado) no, porque no cambian.
    queries: {
      refetchOnWindowFocus: false,
      retry: (count, error) =>
        count < 3 && (!(error instanceof ApiRequestError) || error.status >= 500),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
