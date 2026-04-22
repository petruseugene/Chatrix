import { useEffect, useState } from 'react';
import type { JwtPayload } from '@chatrix/shared';
import { useAuthStore } from '../stores/authStore';

interface AuthData {
  accessToken: string;
  user: JwtPayload;
}

// Executed once per module load so React StrictMode's double-invoke doesn't fire
// two competing refresh requests with the same cookie (second would get 401 after
// the first rotates the session, causing a race where the app shows the login page).
const bootstrapRefresh: Promise<AuthData | null> = fetch('/api/auth/refresh', {
  method: 'POST',
  credentials: 'include',
})
  .then((res) => (res.ok ? (res.json() as Promise<AuthData>) : null))
  .catch(() => null);

interface Props {
  children: React.ReactNode;
}

export default function AppBootstrap({ children }: Props) {
  const [ready, setReady] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    bootstrapRefresh
      .then((data) => {
        if (data) setAuth(data.user, data.accessToken);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [setAuth]);

  if (!ready) return null;

  return <>{children}</>;
}
