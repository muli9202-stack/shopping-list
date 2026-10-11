import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';

// Artifact build: fonts come from Google Fonts (linked in the page), texts from the built-in snapshot,
// and Claude answers through the viewer's own account.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
