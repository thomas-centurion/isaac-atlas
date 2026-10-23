import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

const FLAG = 'isaac-atlas:visited';

const read = (): string | null => {
  try {
    return localStorage.getItem(FLAG);
  } catch {
    return null;
  }
};

const write = () => {
  try {
    localStorage.setItem(FLAG, '1');
  } catch {
    // Sin almacenamiento (modo privado): se cuenta en cada carga, algo inflado pero inofensivo.
  }
};

/**
 * Número de visitante del contador del footer. La primera vez que un navegador entra, suma uno y
 * guarda una marca local; después solo lee el total. No se guarda ningún identificador.
 */
export function useVisitors() {
  return useQuery({
    queryKey: ['visitors'],
    staleTime: Infinity,
    queryFn: async () => {
      const first = read() === null;
      const res = await api<{ count: number }>('/visits', { method: first ? 'POST' : 'GET' });
      if (first) write();
      return res.count;
    },
  });
}
