import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('App', () => {
  it('renders Chatrix heading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ status: 'ok', db: 'ok' }),
      }),
    );

    render(<App />, { wrapper });

    // AppBootstrap waits for the refresh fetch before rendering children;
    // use waitFor so we catch the heading once it appears.
    await waitFor(() => {
      expect(screen.getByText('Chatrix')).toBeInTheDocument();
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
