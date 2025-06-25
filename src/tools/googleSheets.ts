import { z } from 'zod';
import { GoogleSheetsService } from '../google-sheets';
import { MCPToolPlugin } from '../types';

const ArgsSchema = z.object({
  query: z.string().min(1, 'query is required'),
  spreadsheetId: z.string().optional(),
  responseFormat: z.enum(['verbal', 'structured', 'both']).default('both').optional(),
});

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

    const parsedArgs = ArgsSchema.parse(args);

    const { query, spreadsheetId, responseFormat } = parsedArgs;

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