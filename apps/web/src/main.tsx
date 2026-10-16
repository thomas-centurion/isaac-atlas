import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './i18n';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    // La web queda abierta de fondo: evitamos refetch en cada foco de la ventana.
    queries: { refetchOnWindowFocus: false, retry: false },
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
