import { z } from 'zod';
import { MCPToolPlugin } from '../types';

const ArgsSchema = z.object({
  query: z.string().min(1, 'query is required'),
  responseFormat: z.enum(['verbal', 'structured', 'both']).default('both').optional(),
});

const plugin: MCPToolPlugin = {
  meta: {
    name: 'search_quickbooks_invoices',
    description: 'Search QuickBooks invoices using natural language. Supports filtering by date range, amount range, customer, and status.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query describing what invoices to find',
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
    const { quickBooks } = services;
    if (!quickBooks) {
      throw new Error('QuickBooks service is not configured');
    }

    const parsedArgs = ArgsSchema.parse(args);
    const { query, responseFormat } = parsedArgs;

    const parsed = quickBooks.parseQuery(query);
    const data = await quickBooks.searchInvoices(parsed);

    const result: any = {};
    if (responseFormat === 'verbal' || responseFormat === 'both') {
      result.verbalResponse = quickBooks.formatForVerbalResponse(data, query);
    }
    if (responseFormat === 'structured' || responseFormat === 'both') {
      result.data = data;
    }
    return result;
  },
};

export default plugin;