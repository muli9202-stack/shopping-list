import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/heebo/400.css';
import '@fontsource/heebo/500.css';
import '@fontsource/heebo/700.css';
import './styles.css';
import App from './App';

// Ask the browser not to evict our IndexedDB data under storage pressure.
navigator.storage?.persist?.().catch(() => {});

try {
  sessionStorage.removeItem('kitchen-reloaded');
} catch {
  /* storage blocked */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
