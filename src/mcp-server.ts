import { MCPRequest, MCPResponse, MCPTool, MCPError, VerbalResponse, QuickBooksQueryParams, MCPToolPlugin } from './types';
import { GoogleSheetsService } from './google-sheets';
import { QuickBooksService } from './quickbooks';
import { withCache } from './cache';
import googleSheetsPlugin from './tools/googleSheets';
import type { KVNamespace } from '@cloudflare/workers-types';

export class MCPServer {
  private googleSheets: GoogleSheetsService;
  private quickBooks?: QuickBooksService;
  private tools: MCPTool[];
  private plugins: MCPToolPlugin[];

  constructor(
    serviceAccountKey: string,
    defaultSpreadsheetId?: string,
    quickBooksClientId?: string,
    quickBooksClientSecret?: string,
    cacheKV?: KVNamespace,
  ) {
    this.googleSheets = new GoogleSheetsService(serviceAccountKey, defaultSpreadsheetId);
    
    // Wrap heavy methods with in-memory cache
    // Caches sheet reads and invoice searches for ttlSeconds (default 300s)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – dynamic reassignment for performance optimisation
    this.googleSheets.getSheetData = withCache(
      this.googleSheets.getSheetData.bind(this.googleSheets),
      300,
      cacheKV,
    );

    // For POC, initialize QuickBooks service with placeholder values if not provided
    // This allows testing with mock data
    if ((quickBooksClientId && quickBooksClientSecret) || 
        (!quickBooksClientId && !quickBooksClientSecret)) {
      this.quickBooks = new QuickBooksService(
        quickBooksClientId || 'POC_CLIENT_ID', 
        quickBooksClientSecret || 'POC_CLIENT_SECRET'
      );

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – dynamic reassignment for performance optimisation
      this.quickBooks.searchInvoices = withCache(
        this.quickBooks.searchInvoices.bind(this.quickBooks),
        300,
        cacheKV,
      );
    }
    
    this.plugins = this.loadPlugins();
    this.tools = this.initializeTools();
  }

  private loadPlugins(): MCPToolPlugin[] {
    return [googleSheetsPlugin];
  }

  private initializeTools(): MCPTool[] {
    const tools: MCPTool[] = [
      // Plugin metas
      ...this.plugins.map((p) => p.meta),
      // Legacy built-in tools
      {
        name: 'get_sheet_info',
        description: 'Get basic information about a Google Spreadsheet including sheet names and properties.',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: {
              type: 'string',
              description: 'Google Sheets spreadsheet ID'
            }
          },
          required: ['spreadsheetId']
        }
      }
    ];

    // Add QuickBooks tools if service is available
    if (this.quickBooks) {
      tools.push(
        {
          name: 'search_quickbooks_invoices',
          description: 'Search QuickBooks invoices using natural language. Supports filtering by date range, amount range, customer, and status.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language query describing what invoices to find (e.g., "invoices from January 2025 over $1000", "invoices for Acme Corp this month")'
              },
              responseFormat: {
                type: 'string',
                enum: ['verbal', 'structured', 'both'],
                description: 'Format of response - verbal for conversational output, structured for raw data, both for complete response'
              }
            },
            required: ['query']
          }
        }
      );
    }

    return tools;
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize();
        
        case 'tools/list':
          return this.handleListTools();
        
        case 'tools/call':
          return await this.handleToolCall(request);
        
        default:
          return this.createErrorResponse(
            -32601, 
            `Method '${request.method}' not found`,
            request.id
          );
      }
    } catch (error: any) {
      return this.createErrorResponse(
        -32603,
        `Internal error: ${error.message}`,
        request.id
      );
    }
  }

  private handleInitialize(): MCPResponse {
            return {
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'Multi-Source MCP Server',
              version: '1.1.0',
              description: 'MCP Server supporting Google Sheets and QuickBooks integration',
            },
          },
        };
  }

  private handleListTools(): MCPResponse {
    return {
      result: {
        tools: this.tools,
      },
    };
  }

  private async handleToolCall(request: MCPRequest): Promise<MCPResponse> {
    const { name, arguments: args } = request.params || {};

    // Check plugins first
    const plugin = this.plugins.find((p) => p.meta.name === name);
    if (plugin) {
      try {
        const result = await plugin.run(args, { services: { googleSheets: this.googleSheets, quickBooks: this.quickBooks } });
        return { result, id: request.id };
      } catch (err: any) {
        return this.createErrorResponse(-32603, `Plugin error: ${err.message}`, request.id);
      }
    }

    switch (name) {
      case 'get_sheet_info':
        return await this.handleSheetInfo(args, request.id);
      case 'search_quickbooks_invoices':
        return await this.handleQuickBooksQuery(args, request.id);
      default:
        return this.createErrorResponse(-32602, `Unknown tool: ${name}`, request.id);
    }
  }

  private async handleSheetInfo(args: any, requestId?: string | number): Promise<MCPResponse> {
    try {
      const { spreadsheetId } = args;

      if (!spreadsheetId) {
        return this.createErrorResponse(
          -32602,
          'Spreadsheet ID is required',
          requestId
        );
      }

      const info = await this.googleSheets.getSheetInfo(spreadsheetId);

      return {
        result: {
          spreadsheetInfo: info,
          verbalSummary: `The spreadsheet "${info.title}" contains ${info.totalSheets} sheet${info.totalSheets !== 1 ? 's' : ''}: ${info.sheets.map((s: any) => s.name).join(', ')}.`
        },
        id: requestId,
      };

    } catch (error: any) {
      return this.createErrorResponse(
        -32603,
        `Failed to get sheet info: ${error.message}`,
        requestId
      );
    }
  }

  private async handleQuickBooksQuery(args: any, requestId?: string | number): Promise<MCPResponse> {
    try {
      if (!this.quickBooks) {
        return this.createErrorResponse(
          -32601,
          'QuickBooks service is not configured. Please provide QuickBooks credentials.',
          requestId
        );
      }

      const { query, responseFormat = 'both' } = args;

      if (!query) {
        return this.createErrorResponse(
          -32602,
          'Query parameter is required',
          requestId
        );
      }

      // Parse the natural language query
      const parsedQuery = this.quickBooks.parseQuery(query);
      
      // Execute the query
      const invoiceData = await this.quickBooks.searchInvoices(parsedQuery);

      // Format response based on requested format
      let result: any = {};

      if (responseFormat === 'verbal' || responseFormat === 'both') {
        result.verbalResponse = this.quickBooks.formatForVerbalResponse(invoiceData, query);
      }

      if (responseFormat === 'structured' || responseFormat === 'both') {
        result.data = invoiceData;
      }

      if (responseFormat === 'both') {
        result.conversationalContext = this.generateQuickBooksContext(invoiceData, query);
      }

      return {
        result,
        id: requestId,
      };

    } catch (error: any) {
      return this.createErrorResponse(
        -32603,
        `Failed to query QuickBooks: ${error.message}`,
        requestId
      );
    }
  }

  private generateQuickBooksContext(invoiceData: any, originalQuery: string): string {
    const { invoices, totalCount, queryInfo } = invoiceData;
    
    let context = `Based on your query "${originalQuery}", I searched QuickBooks invoices. `;
    
    if (invoices.length === 0) {
      context += 'No invoices matched your criteria.';
    } else {
      context += `I found ${totalCount} invoice${totalCount !== 1 ? 's' : ''} `;
      
      if (queryInfo.dateRange) {
        context += `from ${queryInfo.dateRange.start} to ${queryInfo.dateRange.end} `;
      }
      
      if (queryInfo.amountRange) {
        context += `with amounts between $${queryInfo.amountRange.min} and $${queryInfo.amountRange.max} `;
      }
      
      context += '. I can provide more details about specific invoices or help you analyze this data further.';
    }
    
    return context;
  }

  private createErrorResponse(code: number, message: string, id?: string | number): MCPResponse {
    return {
      error: {
        code,
        message,
      },
      id,
    };
  }

  // CORS helper
  createCorsHeaders(origin?: string, allowedOrigins?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (allowedOrigins && origin) {
      const allowed = allowedOrigins.split(',').map(o => o.trim());
      if (allowed.includes('*') || allowed.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
      }
    }

    return headers;
  }
} 