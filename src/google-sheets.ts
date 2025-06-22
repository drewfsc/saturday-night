import { SheetQueryParams, SheetData, SheetRow, ParsedQuery } from './types';

export class GoogleSheetsService {
  private serviceAccountKey: any;
  private defaultSpreadsheetId?: string;

  constructor(serviceAccountKey: string, defaultSpreadsheetId?: string) {
    this.defaultSpreadsheetId = defaultSpreadsheetId;
    this.serviceAccountKey = JSON.parse(serviceAccountKey);
  }

  /**
   * Create JWT token for Google API authentication
   */
  private async createJWT(): Promise<string> {
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.serviceAccountKey.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const encodedHeader = btoa(JSON.stringify(header)).replace(/[+/=]/g, (m) => 
      ({'+': '-', '/': '_', '=': ''}[m as keyof typeof m] || m)
    );
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/[+/=]/g, (m) => 
      ({'+': '-', '/': '_', '=': ''}[m as keyof typeof m] || m)
    );

    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    // Import the private key
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      this.pemToArrayBuffer(this.serviceAccountKey.private_key),
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    );

    // Sign the token
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(unsignedToken)
    );

    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/[+/=]/g, (m) => ({'+': '-', '/': '_', '=': ''}[m as keyof typeof m] || m));

    return `${unsignedToken}.${encodedSignature}`;
  }

  /**
   * Convert PEM private key to ArrayBuffer
   */
  private pemToArrayBuffer(pem: string): ArrayBuffer {
    const pemContents = pem
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');
    
    const binaryString = atob(pemContents);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get access token from Google OAuth
   */
  private async getAccessToken(): Promise<string> {
    const jwt = await this.createJWT();

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = await response.json() as { access_token: string };
    return data.access_token;
  }

  /**
   * Parse natural language query into structured parameters
   */
  parseQuery(query: string, overrideSpreadsheetId?: string): ParsedQuery {
    const lowerQuery = query.toLowerCase();
    
    // Extract spreadsheet ID from query, override parameter, or use default
    const spreadsheetIdMatch = query.match(/(?:spreadsheet|sheet)[\s\w]*id[:\s]*([a-zA-Z0-9-_]+)/i);
    const spreadsheetId = spreadsheetIdMatch?.[1] || overrideSpreadsheetId || this.defaultSpreadsheetId;
    
    if (!spreadsheetId) {
      throw new Error('No spreadsheet ID provided in query, parameter, or default configuration');
    }

    // Extract sheet name
    const sheetNameMatch = query.match(/(?:sheet|tab)[\s\w]*(?:named|called)?[\s]*["']?([^"'\n]+)["']?/i);
    const sheetName = sheetNameMatch?.[1]?.trim();

    // Extract column filters (Subject, Date, From fields, etc.)
    const columnMatch = query.match(/(?:only|just|fields?|columns?)[\s]*[:]*[\s]*(.+?)(?:\s|$)/i);
    const requestedColumns = columnMatch?.[1]?.split(/[,&\s]+/).map(col => col.trim()).filter(col => col.length > 0);

    // Extract limit/count
    const limitMatch = query.match(/(?:first|last|top|limit|show)[\s]*(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1]) : 5; // Default to 5 rows to prevent large responses

    // Determine action
    let action: ParsedQuery['action'] = 'get_rows';
    if (lowerQuery.includes('info') || lowerQuery.includes('details')) {
      action = 'get_sheet_info';
    } else if (lowerQuery.includes('range') || lowerQuery.includes('cells')) {
      action = 'get_range';
    }

    return {
      action,
      spreadsheetId,
      sheetName,
      limit,
      offset: lowerQuery.includes('last') ? undefined : 0,
      requestedColumns
    };
  }

  /**
   * Get sheet data using Google Sheets REST API
   */
  async getSheetData(params: SheetQueryParams): Promise<SheetData> {
    try {
      const accessToken = await this.getAccessToken();

      // First, get spreadsheet metadata
      const metadataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!metadataResponse.ok) {
        throw new Error(`Failed to get spreadsheet metadata: ${metadataResponse.statusText}`);
      }

      const metadata = await metadataResponse.json() as any;
      const sheets = metadata.sheets || [];
      let targetSheet = sheets[0];

      // Find specific sheet if name provided
      if (params.sheetName) {
        const foundSheet = sheets.find((sheet: any) => 
          sheet.properties?.title?.toLowerCase() === params.sheetName.toLowerCase()
        );
        if (foundSheet) {
          targetSheet = foundSheet;
        }
      }

      const sheetName = targetSheet?.properties?.title || 'Sheet1';
      
      // Determine range
      let range = params.range || `${sheetName}!A:Z`;
      if (params.limit && !params.range) {
        range = `${sheetName}!A1:Z${params.limit + 1}`;
      }

      // Get the data
      const dataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${encodeURIComponent(range)}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!dataResponse.ok) {
        throw new Error(`Failed to get sheet data: ${dataResponse.statusText}`);
      }

      const dataResult = await dataResponse.json() as { values?: string[][] };
      const values = dataResult.values || [];
      
      if (values.length === 0) {
        return {
          spreadsheetId: params.spreadsheetId,
          sheetName,
          range,
          headers: [],
          rows: [],
          totalRows: 0,
          queryInfo: {
            limit: params.limit,
            offset: params.offset,
            executedAt: new Date().toISOString(),
          },
        };
      }

      // Process headers and rows
      const headers = values[0] as string[];
      const dataRows = values.slice(1);
      
      // Apply limit and offset
      let processedRows = dataRows;
      if (params.offset) {
        processedRows = processedRows.slice(params.offset);
      }
      if (params.limit) {
        processedRows = processedRows.slice(0, params.limit);
      }

      // Filter columns if requested
      let filteredHeaders = headers;
      let filteredProcessedRows = processedRows;
      
      if (params.requestedColumns && params.requestedColumns.length > 0) {
        const columnIndices: number[] = [];
        filteredHeaders = [];
        
        params.requestedColumns.forEach(requestedCol => {
          const index = headers.findIndex(header => 
            header.toLowerCase().includes(requestedCol.toLowerCase()) ||
            requestedCol.toLowerCase().includes(header.toLowerCase())
          );
          if (index !== -1) {
            columnIndices.push(index);
            filteredHeaders.push(headers[index]);
          }
        });
        
        // Filter each row to only include requested columns
        filteredProcessedRows = processedRows.map(row => 
          columnIndices.map(index => row[index] || '')
        );
      }

      // Convert to structured rows
      const rows: SheetRow[] = filteredProcessedRows.map((row: string[]) => {
        const rowData: SheetRow = {};
        filteredHeaders.forEach((header, index) => {
          rowData[header] = row[index] || '';
        });
        return rowData;
      });

      return {
        spreadsheetId: params.spreadsheetId,
        sheetName,
        range,
        headers: filteredHeaders,
        rows,
        totalRows: dataRows.length,
        queryInfo: {
          limit: params.limit,
          offset: params.offset,
          executedAt: new Date().toISOString(),
          filteredColumns: params.requestedColumns,
        },
      };

    } catch (error: any) {
      throw new Error(`Failed to fetch sheet data: ${error.message}`);
    }
  }

  /**
   * Format sheet data for verbal/conversational response
   */
  formatForVerbalResponse(data: SheetData, originalQuery: string): string {
    const { rows, headers, totalRows, queryInfo } = data;
    
    if (rows.length === 0) {
      return `I found the sheet "${data.sheetName}" but it appears to be empty or has no data in the requested range.`;
    }

    let response = `I found ${rows.length} row${rows.length !== 1 ? 's' : ''} from the "${data.sheetName}" sheet`;
    
    if (queryInfo.limit && totalRows > queryInfo.limit) {
      response += ` (showing first ${queryInfo.limit} of ${totalRows} total rows)`;
    }
    
    response += '. Here\'s the data:\n\n';

    // Add headers
    response += `Columns: ${headers.join(', ')}\n\n`;

    // Add row data (limit for verbal responses)
    const displayLimit = Math.min(rows.length, 10);
    for (let i = 0; i < displayLimit; i++) {
      const row = rows[i];
      response += `Row ${i + 1}: `;
      const rowData = headers.map(header => `${header}: ${row[header]}`).join(', ');
      response += rowData + '\n';
    }

    if (rows.length > displayLimit) {
      response += `\n... and ${rows.length - displayLimit} more rows.`;
    }

    return response.trim();
  }

  /**
   * Get basic sheet information
   */
  async getSheetInfo(spreadsheetId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get sheet info: ${response.statusText}`);
      }

      const spreadsheet = await response.json() as any;
      const sheets = spreadsheet.sheets || [];

      return {
        title: spreadsheet.properties?.title,
        spreadsheetId,
        sheets: sheets.map((sheet: any) => ({
          name: sheet.properties?.title,
          id: sheet.properties?.sheetId,
          rowCount: sheet.properties?.gridProperties?.rowCount,
          columnCount: sheet.properties?.gridProperties?.columnCount,
        })),
        totalSheets: sheets.length,
      };
    } catch (error: any) {
      throw new Error(`Failed to get sheet info: ${error.message}`);
    }
  }
} 