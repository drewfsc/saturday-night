import { MCPServer } from './mcp-server';
import { Env } from './types';
import { handleCors } from './cors';
import { route } from './router';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return handleCors(request, env.ALLOWED_ORIGINS);
    }

    if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return new Response(JSON.stringify({ error: 'Missing Google Service Account credentials' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mcpServer = new MCPServer(
      env.GOOGLE_SERVICE_ACCOUNT_KEY,
      env.DEFAULT_SPREADSHEET_ID,
      env.QUICKBOOKS_CLIENT_ID,
      env.QUICKBOOKS_CLIENT_SECRET,
      env.CACHE
    );

    try {
      return await route(request, env, mcpServer);
    } catch (error: any) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

// Duplicate route-handling functions were migrated to `src/router.ts`.
// Any additional helpers now live there to avoid circular dependencies.

// Additional utility functions for OpenAI Custom GPT integration
export function generateCustomGPTInstructions(): string {
  return `
You are a multi-source data assistant that can query Google Sheets and QuickBooks using natural language.

GOOGLE SHEETS CAPABILITIES:
- Query Google Sheets data by spreadsheet ID
- Retrieve specific rows, ranges, or entire sheets
- Get spreadsheet information and sheet details
- Format responses for both technical and conversational use

QUICKBOOKS CAPABILITIES:
- Search invoices by date range and amount
- Filter invoices by customer, status, and amount thresholds
- Retrieve invoice details including line items and payment status
- Natural language parsing for financial queries

USAGE PATTERNS - GOOGLE SHEETS:
1. "Get all rows from spreadsheet ID [SHEET_ID]"
2. "Show me the first 10 rows from the Sales sheet in [SHEET_ID]"
3. "Get information about spreadsheet [SHEET_ID]"
4. "Retrieve data from range A1:D10 in [SHEET_ID]"

USAGE PATTERNS - QUICKBOOKS:
1. "Show me invoices from January 2025"
2. "Find invoices over $1000 this month"
3. "Get invoices between $500 and $2000 from last week"
4. "Show unpaid invoices for Acme Corporation"

RESPONSE FORMATS:
- Verbal: Natural language descriptions of the data
- Structured: Raw data in JSON format
- Both: Complete response with conversational context

Always ask for clarification if the query could apply to multiple data sources.
`;
}

export function generateActionSchema(): object {
  return {
    "openapi": "3.1.0",
    "info": {
      "title": "Google Sheets MCP API",
      "description": "Query Google Sheets data using natural language through MCP protocol",
      "version": "1.0.0"
    },
    "servers": [
      {
        "url": "https://your-worker.your-subdomain.workers.dev"
      }
    ],
    "paths": {
      "/mcp": {
        "post": {
          "description": "Send MCP requests to query Google Sheets",
          "operationId": "queryGoogleSheets",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "method": {
                      "type": "string",
                      "enum": ["tools/call"]
                    },
                    "params": {
                      "type": "object",
                      "properties": {
                        "name": {
                          "type": "string",
                          "enum": ["query_google_sheets", "get_sheet_info"]
                        },
                        "arguments": {
                          "type": "object",
                          "properties": {
                            "query": {
                              "type": "string",
                              "description": "Natural language query for Google Sheets data"
                            },
                            "spreadsheetId": {
                              "type": "string",
                              "description": "Google Sheets spreadsheet ID"
                            },
                            "responseFormat": {
                              "type": "string",
                              "enum": ["verbal", "structured", "both"],
                              "default": "both"
                            }
                          },
                          "required": ["query"]
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Successful MCP response with Google Sheets data"
            }
          }
        }
      }
    }
  };
}

function handleQuickBooksAuth(request: Request, env: Env): Response {
  // Generate OAuth authorization URL
  if (!env.QUICKBOOKS_CLIENT_ID) {
    return createErrorResponse('QuickBooks Client ID not configured', 400);
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/auth/quickbooks/callback`;
  const state = generateRandomState();

  const authUrl = generateQuickBooksAuthUrl(env.QUICKBOOKS_CLIENT_ID, redirectUri, state);

  // For web apps, redirect to QuickBooks
  // For API usage, return the URL for manual navigation
  const userAgent = request.headers.get('User-Agent') || '';
  if (userAgent.includes('Mozilla') || userAgent.includes('Chrome')) {
    // Browser request - redirect
    return new Response(null, {
      status: 302,
      headers: { 'Location': authUrl }
    });
  } else {
    // API request - return JSON with URL
    return new Response(JSON.stringify({
      authUrl,
      instructions: 'Navigate to this URL in your browser to authorize QuickBooks access',
      callbackUrl: redirectUri
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
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
    // Exchange code for tokens
    const redirectUri = `${url.origin}/auth/quickbooks/callback`;
    const tokens = await exchangeQuickBooksCode(code, redirectUri, env);

    // Store tokens securely (in production, use KV storage or database)
    // For now, we'll return them for manual storage
    const successResponse = {
      success: true,
      message: 'QuickBooks authorization successful!',
      companyId,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in
      },
      instructions: 'Store these tokens securely. The access token expires in 1 hour, use the refresh token to get new ones.'
    };

    // Return HTML response for better user experience
    const htmlResponse = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>QuickBooks Authorization Success</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .success { color: #28a745; }
        .code { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .warning { color: #dc3545; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1 class="success">✅ QuickBooks Authorization Successful!</h1>
      <p>Your QuickBooks account has been successfully connected.</p>
      <p><strong>Company ID:</strong> ${companyId}</p>
      <p class="warning">⚠️ Store these tokens securely:</p>
      <pre class="code">${JSON.stringify(successResponse.tokens, null, 2)}</pre>
      <p><em>The access token expires in 1 hour. Use the refresh token to get new ones.</em></p>
    </body>
    </html>`;

    return new Response(htmlResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error: any) {
    return createErrorResponse(`Token exchange failed: ${error.message}`, 500);
  }
}

function handleQuickBooksAuthStatus(env: Env): Response {
  // Check if QuickBooks is configured and potentially authenticated
  const status = {
    configured: !!(env.QUICKBOOKS_CLIENT_ID && env.QUICKBOOKS_CLIENT_SECRET),
    clientIdPresent: !!env.QUICKBOOKS_CLIENT_ID,
    clientSecretPresent: !!env.QUICKBOOKS_CLIENT_SECRET,
    // In production, check if we have stored tokens
    authenticated: false, // Would check KV storage or database
    instructions: {
      configure: 'Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET environment variables',
      authenticate: 'Visit /auth/quickbooks to connect your QuickBooks account'
    }
  };

  return new Response(JSON.stringify(status, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function generateRandomState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => 
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function generateQuickBooksAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const scope = 'com.intuit.quickbooks.accounting';
  const authUrl = 'https://appcenter.intuit.com/connect/oauth2';
  
  const params = new URLSearchParams({
    'client_id': clientId,
    'scope': scope,
    'redirect_uri': redirectUri,
    'response_type': 'code',
    'access_type': 'offline',
    'state': state
  });

  return `${authUrl}?${params.toString()}`;
}

async function exchangeQuickBooksCode(code: string, redirectUri: string, env: Env): Promise<any> {
  const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  
  const body = new URLSearchParams({
    'grant_type': 'authorization_code',
    'code': code,
    'redirect_uri': redirectUri
  });

  const credentials = btoa(`${env.QUICKBOOKS_CLIENT_ID}:${env.QUICKBOOKS_CLIENT_SECRET}`);
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OAuth token exchange failed: ${error}`);
  }

  return response.json();
}

function createErrorResponse(message: string, status: number): Response {
  const error = {
    error: message,
    timestamp: new Date().toISOString(),
    status,
  };

  return new Response(JSON.stringify(error), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
} 