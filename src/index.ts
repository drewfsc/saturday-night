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
      env.QUICKBOOKS_CLIENT_SECRET
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

async function handleMCPRequest(request: Request, mcpServer: MCPServer, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return createErrorResponse('MCP endpoint only accepts POST requests', 405);
  }

  try {
    const mcpRequest = await request.json() as any; // MCP requests are dynamic
    const mcpResponse = await mcpServer.handleRequest(mcpRequest);
    
    const headers = {
      'Content-Type': 'application/json',
      ...mcpServer.createCorsHeaders(request.headers.get('Origin') || undefined, env.ALLOWED_ORIGINS),
    };

    return new Response(JSON.stringify(mcpResponse), {
      status: 200,
      headers,
    });

  } catch (error: any) {
    console.error('MCP request error:', error);
    return createErrorResponse(`Failed to process MCP request: ${error.message}`, 400);
  }
}

async function handleTestEndpoint(request: Request, mcpServer: MCPServer, env: Env): Promise<Response> {
  // Test endpoint for development and debugging
  try {
    const url = new URL(request.url);
    const spreadsheetId = url.searchParams.get('spreadsheetId') || env.DEFAULT_SPREADSHEET_ID;
    const query = url.searchParams.get('query') || 'Get all rows from the first sheet';

    if (!spreadsheetId) {
      return createErrorResponse('No spreadsheetId provided and no default configured', 400);
    }

    // Create a test MCP request
    const testRequest = {
      method: 'tools/call',
      params: {
        name: 'query_google_sheets',
        arguments: {
          query,
          spreadsheetId,
          responseFormat: 'both'
        }
      },
      id: 'test-request'
    };

    const response = await mcpServer.handleRequest(testRequest);
    
    const headers = {
      'Content-Type': 'application/json',
      ...mcpServer.createCorsHeaders(request.headers.get('Origin') || undefined, env.ALLOWED_ORIGINS),
    };

    // Format response for easy reading
    const formattedResponse = {
      testRequest,
      mcpResponse: response,
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV || 'development'
    };

    return new Response(JSON.stringify(formattedResponse, null, 2), {
      status: 200,
      headers,
    });

  } catch (error: any) {
    console.error('Test endpoint error:', error);
    return createErrorResponse(`Test failed: ${error.message}`, 500);
  }
}

async function handleQuickBooksTestEndpoint(request: Request, mcpServer: MCPServer, env: Env): Promise<Response> {
  // Test endpoint for QuickBooks functionality
  try {
    // For POC, we'll allow testing with mock data even without credentials
    // if (!env.QUICKBOOKS_CLIENT_ID || !env.QUICKBOOKS_CLIENT_SECRET) {
    //   return createErrorResponse('QuickBooks credentials not configured', 400);
    // }

    const url = new URL(request.url);
    const query = url.searchParams.get('query') || 'show me invoices from January 2025 over $1000';

    // Create a test MCP request for QuickBooks
    const testRequest = {
      method: 'tools/call',
      params: {
        name: 'search_quickbooks_invoices',
        arguments: {
          query,
          responseFormat: 'both'
        }
      },
      id: 'quickbooks-test-request'
    };

    const response = await mcpServer.handleRequest(testRequest);
    
    const headers = {
      'Content-Type': 'application/json',
      ...mcpServer.createCorsHeaders(request.headers.get('Origin') || undefined, env.ALLOWED_ORIGINS),
    };

    // Format response for easy reading
    const formattedResponse = {
      testRequest,
      mcpResponse: response,
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV || 'development',
      note: 'This uses mock data for POC. Real QuickBooks API integration requires OAuth setup.'
    };

    return new Response(JSON.stringify(formattedResponse, null, 2), {
      status: 200,
      headers,
    });

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
      quickBooksEnabled: !!(env.QUICKBOOKS_CLIENT_ID && env.QUICKBOOKS_CLIENT_SECRET)
    }
  };

  return new Response(JSON.stringify(health, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
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