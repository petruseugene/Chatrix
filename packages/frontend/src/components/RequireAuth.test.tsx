import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import { useAuthStore } from '../stores/authStore';

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null });
});

describe('RequireAuth', () => {
  it('redirects to /auth when store has no token', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/protected" element={<div>Protected content</div>} />
          </Route>
          <Route path="/auth" element={<div>Auth page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Auth page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders child route content when store has a token', () => {
    useAuthStore.setState({
      accessToken: 'eyJ.test.token',
      user: { sub: 'u1', email: 'a@b.com', username: 'alice' },
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/protected" element={<div>Protected content</div>} />
          </Route>
          <Route path="/auth" element={<div>Auth page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByText('Auth page')).not.toBeInTheDocument();
  });
});
