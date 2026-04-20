import type { JwtPayload } from '@chatrix/shared';

export interface AuthResponse {
  accessToken: string;
  user: JwtPayload;
}

async function handleResponse(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed with status ${res.status}`);
  }
}

async function handleJsonResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function login(data: { email: string; password: string }): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleJsonResponse<AuthResponse>(res);
}

export async function register(data: {
  email: string;
  password: string;
  username: string;
}): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleJsonResponse<AuthResponse>(res);
}

export async function logout(): Promise<void> {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  await handleResponse(res);
}

export async function requestReset(data: { email: string }): Promise<void> {
  const res = await fetch('/api/auth/request-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  await handleResponse(res);
}

export async function resetPassword(data: { token: string; newPassword: string }): Promise<void> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  await handleResponse(res);
}
