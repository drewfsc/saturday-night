export function createCorsHeaders(origin: string | null | undefined, allowedOrigins?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (allowedOrigins && origin) {
    const allowed = allowedOrigins.split(',').map((o) => o.trim());
    if (allowed.includes('*') || allowed.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
  }

  return headers;
}

export function handleCors(request: Request, allowedOrigins?: string): Response {
  const origin = request.headers.get('Origin');
  const headers: Record<string, string> = {
    ...createCorsHeaders(origin, allowedOrigins),
    'Access-Control-Max-Age': '86400',
  };

  return new Response(null, {
    status: 204,
    headers,
  });
}