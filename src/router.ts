import { MCPServer } from './mcp-server';
import { Env } from './types';

// Utilities --------------------------------------------------------------
function createErrorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message, status, timestamp: new Date().toISOString() }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

// -----------------------------------------------------------------------
export async function route(
  request: Request,
  env: Env,
  mcpServer: MCPServer,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  switch (path) {
    case '/':
    case '/health':
      return handleHealthCheck(env);

    case '/mcp':
      return await handleMCPRequest(request, mcpServer, env);

    case '/test':
      return await handleTestEndpoint(request, mcpServer, env);

    case '/test/quickbooks':
      return await handleQuickBooksTestEndpoint(request, mcpServer, env);

    case '/auth/quickbooks':
      return handleQuickBooksAuth(request, env);

    case '/auth/quickbooks/callback':
      return await handleQuickBooksCallback(request, env);

    case '/auth/quickbooks/status':
      return handleQuickBooksAuthStatus(env);

    default:
      return createErrorResponse('Endpoint not found', 404);
  }
}

// -------------------------- Route Handlers -----------------------------
async function handleMCPRequest(
  request: Request,
  mcpServer: MCPServer,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') {
    return createErrorResponse('MCP endpoint only accepts POST requests', 405);
  }

  try {
    const mcpRequest = (await request.json()) as any; // dynamic shape
    const mcpResponse = await mcpServer.handleRequest(mcpRequest);

    const headers = {
      'Content-Type': 'application/json',
      ...mcpServer.createCorsHeaders(request.headers.get('Origin') || undefined, env.ALLOWED_ORIGINS),
    };

    return new Response(JSON.stringify(mcpResponse), { status: 200, headers });
  } catch (error: any) {
    console.error('MCP request error:', error);
    return createErrorResponse(`Failed to process MCP request: ${error.message}`, 400);
  }
}

async function handleTestEndpoint(
  request: Request,
  mcpServer: MCPServer,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const spreadsheetId = url.searchParams.get('spreadsheetId') || env.DEFAULT_SPREADSHEET_ID;
    const query = url.searchParams.get('query') || 'Get all rows from the first sheet';

    if (!spreadsheetId) {
      return createErrorResponse('No spreadsheetId provided and no default configured', 400);
    }

    const testRequest = {
      method: 'tools/call',
      params: {
        name: 'query_google_sheets',
        arguments: {
          query,
          spreadsheetId,
          responseFormat: 'both',
        },
      },
      id: 'test-request',
    };

    const response = await mcpServer.handleRequest(testRequest);

    const headers = {
      'Content-Type': 'application/json',
      ...mcpServer.createCorsHeaders(request.headers.get('Origin') || undefined, env.ALLOWED_ORIGINS),
    };

    const formatted = {
      testRequest,
      mcpResponse: response,
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV || 'development',
    };

    return new Response(JSON.stringify(formatted, null, 2), { status: 200, headers });
  } catch (error: any) {
    console.error('Test endpoint error:', error);
    return createErrorResponse(`Test failed: ${error.message}`, 500);
  }
}

async function handleQuickBooksTestEndpoint(
  request: Request,
  mcpServer: MCPServer,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || 'show me invoices from January 2025 over $1000';

    const testRequest = {
      method: 'tools/call',
      params: {
        name: 'search_quickbooks_invoices',
        arguments: {
          query,
          responseFormat: 'both',
        },
      },
      id: 'quickbooks-test-request',
    };

    const response = await mcpServer.handleRequest(testRequest);

    const headers = {
      'Content-Type': 'application/json',
      ...mcpServer.createCorsHeaders(request.headers.get('Origin') || undefined, env.ALLOWED_ORIGINS),
    };

    const formatted = {
      testRequest,
      mcpResponse: response,
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV || 'development',
      note: 'This uses mock data for POC. Real QuickBooks API integration requires OAuth setup.',
    };

    return new Response(JSON.stringify(formatted, null, 2), { status: 200, headers });
  } catch (error: any) {
    console.error('QuickBooks test endpoint error:', error);
    return createErrorResponse(`QuickBooks test failed: ${error.message}`, 500);
  }
}

function handleHealthCheck(env: Env): Response {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: env.MCP_VERSION || '1.1.0',
    environment: env.NODE_ENV || 'production',
    services: {
      googleSheets: !!env.GOOGLE_SERVICE_ACCOUNT_KEY,
      quickBooks: !!(env.QUICKBOOKS_CLIENT_ID && env.QUICKBOOKS_CLIENT_SECRET),
    },
    configuration: {
      defaultSpreadsheetId: env.DEFAULT_SPREADSHEET_ID || 'Not configured',
      quickBooksEnabled: !!(env.QUICKBOOKS_CLIENT_ID && env.QUICKBOOKS_CLIENT_SECRET),
    },
  };

  return new Response(JSON.stringify(health, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// QuickBooks OAuth helpers ------------------------------------------------
function generateRandomState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function generateQuickBooksAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const scope = 'com.intuit.quickbooks.accounting';
  const authUrl = 'https://appcenter.intuit.com/connect/oauth2';
  const params = new URLSearchParams({
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    state,
  });
  return `${authUrl}?${params.toString()}`;
}

function handleQuickBooksAuth(request: Request, env: Env): Response {
  if (!env.QUICKBOOKS_CLIENT_ID) {
    return createErrorResponse('QuickBooks Client ID not configured', 400);
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/auth/quickbooks/callback`;
  const state = generateRandomState();
  const authUrl = generateQuickBooksAuthUrl(env.QUICKBOOKS_CLIENT_ID, redirectUri, state);

  const userAgent = request.headers.get('User-Agent') || '';
  if (userAgent.includes('Mozilla') || userAgent.includes('Chrome')) {
    return new Response(null, { status: 302, headers: { Location: authUrl } });
  }
  return new Response(
    JSON.stringify({ authUrl, instructions: 'Navigate to this URL in your browser to authorize QuickBooks access', callbackUrl: redirectUri }, null, 2),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

async function exchangeQuickBooksCode(code: string, redirectUri: string, env: Env): Promise<any> {
  const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  const credentials = btoa(`${env.QUICKBOOKS_CLIENT_ID}:${env.QUICKBOOKS_CLIENT_SECRET}`);
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OAuth token exchange failed: ${error}`);
  }
  return response.json();
}

async function handleQuickBooksCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const companyId = url.searchParams.get('realmId');

  if (error) {
    return createErrorResponse(`QuickBooks authorization failed: ${error}`, 400);
  }
  if (!code || !companyId) {
    return createErrorResponse('Missing authorization code or company ID', 400);
  }

  try {
    const redirectUri = `${url.origin}/auth/quickbooks/callback`;
    const tokens = await exchangeQuickBooksCode(code, redirectUri, env);

    const successResponse = {
      success: true,
      message: 'QuickBooks authorization successful!',
      companyId,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
      },
      instructions: 'Store these tokens securely. The access token expires in 1 hour, use the refresh token to get new ones.',
    };

    const html = `<!DOCTYPE html><html><head><title>QuickBooks Auth Success</title><style>body{font-family:Arial, sans-serif; margin:40px;}pre{background:#f3f3f3;padding:15px;border-radius:6px;overflow-x:auto}</style></head><body><h1>✅ QuickBooks Authorization Successful!</h1><p>Your QuickBooks account has been connected.</p><p><strong>Company ID:</strong> ${companyId}</p><p>⚠️ <strong>Store these tokens securely:</strong></p><pre>${JSON.stringify(successResponse.tokens, null, 2)}</pre><p><em>The access token expires in 1 hour. Use the refresh token to get new ones.</em></p></body></html>`;
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
  } catch (err: any) {
    return createErrorResponse(`Token exchange failed: ${err.message}`, 500);
  }
}

function handleQuickBooksAuthStatus(env: Env): Response {
  const status = {
    configured: !!(env.QUICKBOOKS_CLIENT_ID && env.QUICKBOOKS_CLIENT_SECRET),
    clientIdPresent: !!env.QUICKBOOKS_CLIENT_ID,
    clientSecretPresent: !!env.QUICKBOOKS_CLIENT_SECRET,
    authenticated: false,
  };
  return new Response(JSON.stringify(status, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
}