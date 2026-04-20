import type { JwtPayload } from '@chatrix/shared';

export interface AuthResponse {
  accessToken: string;
  user: JwtPayload;
}

const ERROR_MAP: Record<string, string> = {
  'invalid credentials': 'Incorrect email or password. Please try again.',
  unauthorized: 'Incorrect email or password. Please try again.',
  'invalid or expired reset token':
    'This reset link has expired or is no longer valid. Please request a new one.',
  'email already in use': 'An account with this email already exists. Try signing in instead.',
  'email already taken': 'An account with this email already exists. Try signing in instead.',
  'username already taken': 'This username is already taken. Please choose a different one.',
  'username already in use': 'This username is already taken. Please choose a different one.',
  'user not found': 'No account found with that email address.',
  'too many requests': 'Too many attempts. Please wait a moment before trying again.',
  'password too weak':
    'Password is too weak. Use at least 8 characters with a mix of letters and numbers.',
};

function toFriendlyMessage(raw: string, statusCode?: number): string {
  const key = raw.toLowerCase().trim();
  if (ERROR_MAP[key]) return ERROR_MAP[key];
  // Check for partial matches
  for (const [pattern, friendly] of Object.entries(ERROR_MAP)) {
    if (key.includes(pattern)) return friendly;
  }
  if (statusCode === 429) return ERROR_MAP['too many requests'] ?? 'Too many requests.';
  if (statusCode === 401 || statusCode === 403)
    return ERROR_MAP['invalid credentials'] ?? 'Incorrect email or password. Please try again.';
  return raw || 'Something went wrong. Please try again.';
}

async function extractError(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const json = JSON.parse(body) as { message?: string | string[]; statusCode?: number };
    const rawMessage = Array.isArray(json.message) ? json.message.join(', ') : (json.message ?? '');
    return toFriendlyMessage(rawMessage, json.statusCode ?? res.status);
  } catch {
    return toFriendlyMessage(body, res.status);
  }
}

async function handleResponse(res: Response): Promise<void> {
  if (!res.ok) throw new Error(await extractError(res));
}

async function handleJsonResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await extractError(res));
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
