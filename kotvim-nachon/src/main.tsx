import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/varela-round/hebrew-400.css';
import '@fontsource/varela-round/latin-400.css';
import '@fontsource/rubik/hebrew-400.css';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
