import { MCPServer } from './mcp-server';
import { Env } from './types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCors(request, env);
    }

    try {
      // Validate environment variables
      if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        return createErrorResponse('Missing Google Service Account credentials', 500);
      }

      // Initialize MCP server
      const mcpServer = new MCPServer(env.GOOGLE_SERVICE_ACCOUNT_KEY, env.DEFAULT_SPREADSHEET_ID);

      // Handle different endpoints
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
        
        default:
          return createErrorResponse('Endpoint not found', 404);
      }

    } catch (error: any) {
      console.error('Worker error:', error);
      return createErrorResponse(`Internal server error: ${error.message}`, 500);
    }
  },
};

async function handleMCPRequest(request: Request, mcpServer: MCPServer, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return createErrorResponse('MCP endpoint only accepts POST requests', 405);
  }

  try {
    const mcpRequest = await request.json();
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

function handleHealthCheck(env: Env): Response {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: env.MCP_VERSION || '1.0.0',
    environment: env.NODE_ENV || 'production',
    services: {
      googleSheets: !!env.GOOGLE_SERVICE_ACCOUNT_KEY,
    },
    configuration: {
      defaultSpreadsheetId: env.DEFAULT_SPREADSHEET_ID || 'Not configured'
    }
  };

  return new Response(JSON.stringify(health, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function handleCors(request: Request, env: Env): Response {
  const origin = request.headers.get('Origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (env.ALLOWED_ORIGINS && origin) {
    const allowed = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    if (allowed.includes('*') || allowed.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
  }

  return new Response(null, {
    status: 204,
    headers,
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
You are a Google Sheets assistant that can query and retrieve data from Google Spreadsheets using natural language.

CAPABILITIES:
- Query Google Sheets data by spreadsheet ID
- Retrieve specific rows, ranges, or entire sheets
- Get spreadsheet information and sheet details
- Format responses for both technical and conversational use

USAGE PATTERNS:
1. "Get all rows from spreadsheet ID [SHEET_ID]"
2. "Show me the first 10 rows from the Sales sheet in [SHEET_ID]"
3. "Get information about spreadsheet [SHEET_ID]"
4. "Retrieve data from range A1:D10 in [SHEET_ID]"

RESPONSE FORMATS:
- Verbal: Natural language descriptions of the data
- Structured: Raw data in JSON format
- Both: Complete response with conversational context

Always ask for the spreadsheet ID if not provided, and confirm the query before executing.
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