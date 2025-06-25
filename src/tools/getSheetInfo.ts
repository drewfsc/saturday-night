import { z } from 'zod';
import { MCPToolPlugin } from '../types';

const plugin: MCPToolPlugin = {
  meta: {
    name: 'get_sheet_info',
    description: 'Get basic information about a Google Spreadsheet including sheet names and properties.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'Google Sheets spreadsheet ID',
        },
      },
      required: ['spreadsheetId'],
    },
  },

  async run(args: any, { services }): Promise<any> {
    const { googleSheets } = services;
    const { spreadsheetId } = z.object({
      spreadsheetId: z.string().min(1, 'Spreadsheet ID is required'),
    }).parse(args);
    const info = await googleSheets.getSheetInfo(spreadsheetId);
    return {
      spreadsheetInfo: info,
      verbalSummary: `The spreadsheet "${info.title}" contains ${info.totalSheets} sheet${info.totalSheets !== 1 ? 's' : ''}: ${info.sheets.map((s: any) => s.name).join(', ')}.`,
    };
  },
};

export default plugin;