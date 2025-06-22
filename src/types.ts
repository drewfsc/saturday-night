// MCP Protocol Types
export interface MCPRequest {
  method: string;
  params?: Record<string, any>;
  id?: string | number;
}

export interface MCPResponse {
  result?: any;
  error?: MCPError;
  id?: string | number;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// Google Sheets Types
export interface SheetQueryParams {
  spreadsheetId: string;
  range?: string;
  sheetName?: string;
  limit?: number;
  offset?: number;
}

export interface SheetRow {
  [key: string]: string | number | boolean;
}

export interface SheetData {
  spreadsheetId: string;
  sheetName: string;
  range: string;
  headers: string[];
  rows: SheetRow[];
  totalRows: number;
  queryInfo: {
    limit?: number;
    offset?: number;
    executedAt: string;
  };
}

export interface VerbalResponse {
  summary: string;
  data: SheetData;
  conversationalContext: string;
}

// Cloudflare Worker Environment
export interface Env {
  GOOGLE_SERVICE_ACCOUNT_KEY: string;
  DEFAULT_SPREADSHEET_ID?: string;
  ALLOWED_ORIGINS?: string;
  NODE_ENV?: string;
  MCP_VERSION?: string;
}

// Natural Language Query Processing
export interface ParsedQuery {
  action: 'get_rows' | 'get_sheet_info' | 'get_range';
  spreadsheetId: string;
  sheetName?: string;
  range?: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
  requestedColumns?: string[];
} 