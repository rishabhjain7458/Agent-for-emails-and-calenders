import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SpaceProvider } from './contexts/SpaceContext';
import { AppThemeProvider } from './contexts/ThemeModeContext';
import { AppRoutes } from './router/router';
import { initializeLiveUpdates } from './utils/liveUpdates';
import './styles.css';

void initializeLiveUpdates();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <SpaceProvider>
            <AppRoutes />
          </SpaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppThemeProvider>
  </React.StrictMode>
);
