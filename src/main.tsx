import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { StatusBar } from '@capacitor/status-bar';
import App from './App.tsx';
import { ModalProvider } from './contexts/ModalContext.tsx';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/500.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/cairo/800.css';
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
