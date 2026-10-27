export async function checkHealth(signal?: AbortSignal): Promise<void> {
  const response = await fetch('/api/health', { signal });
  if (!response.ok) throw new Error('Service unavailable');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('status' in body) || body.status !== 'ok') {
    throw new Error('Unexpected health response');
  }
}
