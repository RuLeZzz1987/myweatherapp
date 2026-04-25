import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './i18n';
import './index.css';
import App from './App.tsx';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('MyWeather: missing #root element in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
