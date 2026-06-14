export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers
    }
  });
  const body = await response.json().catch(() => undefined) as { error?: string } | undefined;

  if (!body) {
    throw new Error(`Server returned invalid JSON for ${path}.`);
  }

  if (!response.ok) {
    throw new Error(body.error || `Request failed for ${path}.`);
  }

  return body as T;
}

