import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from "react-router";
import { Toaster } from 'sonner';

import { store } from './store';
import { fetchAuthInfo } from './api/auth';
import './i18n';
import './index.css';
import App from './App';
import { ThemeProvider } from './components/theme/theme-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

// Surcharge globale de globalThis.fetch pour acheminer les requêtes /api vers la Gateway (/services/pme/api)
// et inclure les cookies de session (withCredentials).
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  let url: string;
  if (typeof input === 'string') url = input;
  else if (input instanceof URL) url = input.toString();
  else url = input.url;

  if (url.startsWith('/api/') && url !== '/api/auth-info' && url !== '/api/logout' && url !== '/api/account') {
    url = `/services/pme${url}`;
  }

  const newInit: RequestInit = {
    ...init,
    credentials: init?.credentials || 'include',
  };

  if (input instanceof Request) {
    const newRequest = new Request(url, input);
    return originalFetch(newRequest, newInit);
  }

  return originalFetch(url, newInit);
};

// Récupère la session utilisateur au démarrage
fetchAuthInfo();

const basename = import.meta.env.BASE_URL;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="pme-theme">
          <BrowserRouter basename={basename}>
            <App />
            <Toaster richColors position="top-right" />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  </StrictMode>
);
