import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config as faConfig } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import './i18n';
import './styles/index.css';
import { ToastProvider } from '@/components/shared/toast';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ThemeProvider } from '@/features/theme/ThemeProvider';
import { normalizeError } from '@/lib/api';
import { AppRoutes } from '@/routes/AppRoutes';

faConfig.autoAddCss = false; // CSS imported above (avoids FOUC with large icons)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Never retry client errors (401/403/404/422); retry transient failures twice.
      retry: (count, err) => {
        const s = normalizeError(err).status;
        return (s === 0 || s >= 500) && count < 2;
      },
    },
  },
});

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        style={{ padding: '4rem 1rem', textAlign: 'center', fontFamily: 'Manrope, sans-serif' }}
      >
        <h1 style={{ color: '#17332C' }}>Something went wrong</h1>
        <p style={{ color: '#68756F' }}>
          Please reload the page. If the problem continues, contact the Academy.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16,
            padding: '10px 18px',
            background: '#17332C',
            color: '#fff',
            border: 0,
            borderRadius: 6,
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}

// Reuse the root if this module re-executes (Vite HMR re-runs main.tsx when a non-component module
// changes); calling createRoot twice would mount a second, stale app tree.
const container = document.getElementById('root')! as HTMLElement & { __alfRoot?: Root };
container.__alfRoot ??= createRoot(container);
container.__alfRoot.render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ToastProvider>
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            </ToastProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
