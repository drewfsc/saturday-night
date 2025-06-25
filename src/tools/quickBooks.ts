import { MCPToolPlugin } from '../types';

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

    const { query, responseFormat = 'both' } = args;
    if (!query) {
      throw new Error('Query parameter is required');
    }

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