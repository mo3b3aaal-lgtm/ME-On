import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { StatusBar } from '@capacitor/status-bar';
import App from './App.tsx';
import { ModalProvider } from './contexts/ModalContext.tsx';
import './index.css';

// Automatically hide Status Bar on Android native app launch
try {
  StatusBar.hide().catch(() => {});
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
} catch {
  // Web preview mode fallback
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModalProvider>
      <App />
    </ModalProvider>
  </StrictMode>,
);
