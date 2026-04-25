import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './i18n';
import './index.css';
import App from './App.tsx';
import { createQueryClient } from './lib/queryClient';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('MyWeather: missing #root element in index.html');
}

const queryClient = createQueryClient();

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
