import { useEffect, useState } from 'react';
import type { JwtPayload } from '@chatrix/shared';
import { useAuthStore } from '../stores/authStore';

interface Props {
  children: React.ReactNode;
}

export default function AppBootstrap({ children }: Props) {
  const [ready, setReady] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then((res) => {
        if (!res.ok) return;
        return res.json().then((data: { accessToken: string; user: JwtPayload }) => {
          setAuth(data.user, data.accessToken);
        });
      })
      .catch(() => {
        // leave store empty on any network error
      })
      .finally(() => {
        setReady(true);
      });
  }, [setAuth]);

  if (!ready) return null;

  return <>{children}</>;
}
