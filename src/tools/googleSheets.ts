import { GoogleSheetsService } from '../google-sheets';
import { MCPToolPlugin } from '../types';

const plugin: MCPToolPlugin = {
  meta: {
    name: 'query_google_sheets',
    description: 'Query Google Sheets data using natural language. Supports getting rows, sheet information, and specific ranges.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query describing what data to retrieve from Google Sheets',
        },
        spreadsheetId: {
          type: 'string',
          description: 'Google Sheets spreadsheet ID (optional if default is configured)',
        },
        responseFormat: {
          type: 'string',
          enum: ['verbal', 'structured', 'both'],
          description: 'Format of response - verbal, structured, or both',
        },
      },
      required: ['query'],
    },
  },

  async run(args: any, { services }): Promise<any> {
    const { googleSheets } = services;

    const { query, spreadsheetId, responseFormat = 'both' } = args;
    if (!query) {
      throw new Error('Query parameter is required');
    }

    // Parse query
    const parsed = googleSheets.parseQuery(query, spreadsheetId);
    const data = await googleSheets.getSheetData({
      spreadsheetId: parsed.spreadsheetId,
      sheetName: parsed.sheetName,
      range: parsed.range,
      limit: parsed.limit,
      offset: parsed.offset,
    });

    const result: any = {};
    if (responseFormat === 'verbal' || responseFormat === 'both') {
      result.verbalResponse = googleSheets.formatForVerbalResponse(data, query);
    }
    if (responseFormat === 'structured' || responseFormat === 'both') {
      result.data = data;
    }

    return result;
  },
};

export default plugin;