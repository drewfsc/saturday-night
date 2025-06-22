import { QuickBooksQueryParams, QuickBooksResponse, QuickBooksInvoice } from './types';

export class QuickBooksService {
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private companyId?: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Parse natural language query for QuickBooks operations
   */
  parseQuery(query: string): QuickBooksQueryParams {
    const lowerQuery = query.toLowerCase();
    
    // Determine action
    let action: QuickBooksQueryParams['action'] = 'search_invoices';
    if (lowerQuery.includes('company') || lowerQuery.includes('info')) {
      action = 'get_company_info';
    } else if (lowerQuery.includes('invoice') && /\b\d+\b/.test(query)) {
      action = 'get_invoice';
    }

    // Extract date range
    let dateRange: { start: string; end: string } | undefined;
    
    // Look for date patterns
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})\s*(?:to|through|-|until)\s*(\d{4}-\d{2}-\d{2})/i,
      /(?:between|from)\s*(\d{4}-\d{2}-\d{2})\s*(?:and|to)\s*(\d{4}-\d{2}-\d{2})/i,
      /(?:since|after|from)\s*(\d{4}-\d{2}-\d{2})/i,
      /(?:before|until)\s*(\d{4}-\d{2}-\d{2})/i,
    ];

    for (const pattern of datePatterns) {
      const match = query.match(pattern);
      if (match) {
        if (match[2]) {
          // Range found
          dateRange = { start: match[1], end: match[2] };
        } else {
          // Single date - create range
          const date = match[1];
          if (lowerQuery.includes('since') || lowerQuery.includes('after') || lowerQuery.includes('from')) {
            dateRange = { start: date, end: new Date().toISOString().split('T')[0] };
          } else {
            dateRange = { start: '2020-01-01', end: date };
          }
        }
        break;
      }
    }

    // Look for relative dates
    if (!dateRange) {
      const now = new Date();
      if (lowerQuery.includes('today')) {
        const today = now.toISOString().split('T')[0];
        dateRange = { start: today, end: today };
      } else if (lowerQuery.includes('this week')) {
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        dateRange = { 
          start: weekStart.toISOString().split('T')[0], 
          end: new Date().toISOString().split('T')[0] 
        };
      } else if (lowerQuery.includes('this month')) {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateRange = { 
          start: monthStart.toISOString().split('T')[0], 
          end: new Date().toISOString().split('T')[0] 
        };
      } else if (lowerQuery.includes('last month')) {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        dateRange = { 
          start: lastMonth.toISOString().split('T')[0], 
          end: lastMonthEnd.toISOString().split('T')[0] 
        };
      }
    }

    // Extract amount range
    let amountRange: { min: number; max: number } | undefined;
    
    const amountPatterns = [
      /(?:amount|total|value)\s*(?:between|from)\s*\$?(\d+(?:\.\d{2})?)\s*(?:to|and|-)\s*\$?(\d+(?:\.\d{2})?)/i,
      /\$?(\d+(?:\.\d{2})?)\s*(?:to|-)\s*\$?(\d+(?:\.\d{2})?)/i,
      /(?:over|above|greater than)\s*\$?(\d+(?:\.\d{2})?)/i,
      /(?:under|below|less than)\s*\$?(\d+(?:\.\d{2})?)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = query.match(pattern);
      if (match) {
        if (match[2]) {
          // Range found
          amountRange = { min: parseFloat(match[1]), max: parseFloat(match[2]) };
        } else {
          // Single amount
          const amount = parseFloat(match[1]);
          if (lowerQuery.includes('over') || lowerQuery.includes('above') || lowerQuery.includes('greater')) {
            amountRange = { min: amount, max: 999999 };
          } else {
            amountRange = { min: 0, max: amount };
          }
        }
        break;
      }
    }

    // Extract limit
    const limitMatch = query.match(/(?:first|top|limit|show)\s*(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1]) : 10; // Default to 10 invoices

    return {
      action,
      dateRange,
      amountRange,
      limit,
    };
  }

  /**
   * Get OAuth access token (for now, we'll need to implement full OAuth flow)
   * This is a simplified version - in production you'd need the full OAuth dance
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    // For POC, we'll return a placeholder
    // In production, you'd implement the full QuickBooks OAuth flow
    throw new Error('QuickBooks OAuth flow not implemented yet. This requires user authorization in production.');
  }

  /**
   * Search invoices based on query parameters
   */
  async searchInvoices(params: QuickBooksQueryParams): Promise<QuickBooksResponse> {
    try {
      // For POC, return mock data that matches the expected structure
      // In production, this would make real QuickBooks API calls
      
      const mockInvoices: QuickBooksInvoice[] = [
        {
          id: "1",
          docNumber: "INV-001",
          txnDate: "2025-01-15",
          dueDate: "2025-02-15",
          totalAmt: 1500.00,
          balance: 1500.00,
          customerRef: {
            value: "1",
            name: "Acme Corporation"
          },
          line: [{
            amount: 1500.00,
            detailType: "SalesItemLineDetail",
            salesItemLineDetail: {
              itemRef: { value: "1", name: "Consulting Services" },
              qty: 10,
              unitPrice: 150.00
            }
          }]
        },
        {
          id: "2", 
          docNumber: "INV-002",
          txnDate: "2025-01-20",
          dueDate: "2025-02-20",
          totalAmt: 750.50,
          balance: 0.00,
          customerRef: {
            value: "2",
            name: "Tech Solutions Inc"
          },
          line: [{
            amount: 750.50,
            detailType: "SalesItemLineDetail",
            salesItemLineDetail: {
              itemRef: { value: "2", name: "Software License" },
              qty: 1,
              unitPrice: 750.50
            }
          }]
        },
        {
          id: "3",
          docNumber: "INV-003", 
          txnDate: "2025-01-22",
          dueDate: "2025-02-22",
          totalAmt: 2250.00,
          balance: 2250.00,
          customerRef: {
            value: "3",
            name: "Global Enterprises"
          },
          line: [{
            amount: 2250.00,
            detailType: "SalesItemLineDetail",
            salesItemLineDetail: {
              itemRef: { value: "3", name: "Premium Support" },
              qty: 3,
              unitPrice: 750.00
            }
          }]
        }
      ];

      // Filter by date range
      let filteredInvoices = mockInvoices;
      if (params.dateRange) {
        filteredInvoices = filteredInvoices.filter(invoice => {
          const invoiceDate = new Date(invoice.txnDate);
          const startDate = new Date(params.dateRange!.start);
          const endDate = new Date(params.dateRange!.end);
          return invoiceDate >= startDate && invoiceDate <= endDate;
        });
      }

      // Filter by amount range
      if (params.amountRange) {
        filteredInvoices = filteredInvoices.filter(invoice => {
          return invoice.totalAmt >= params.amountRange!.min && 
                 invoice.totalAmt <= params.amountRange!.max;
        });
      }

      // Apply limit
      if (params.limit) {
        filteredInvoices = filteredInvoices.slice(0, params.limit);
      }

      return {
        companyId: "mock-company-123",
        invoices: filteredInvoices,
        totalCount: filteredInvoices.length,
        queryInfo: {
          dateRange: params.dateRange,
          amountRange: params.amountRange,
          limit: params.limit,
          executedAt: new Date().toISOString(),
        },
      };

    } catch (error: any) {
      throw new Error(`Failed to search QuickBooks invoices: ${error.message}`);
    }
  }

  /**
   * Format QuickBooks data for verbal/conversational response
   */
  formatForVerbalResponse(data: QuickBooksResponse, originalQuery: string): string {
    const { invoices, totalCount, queryInfo } = data;
    
    if (invoices.length === 0) {
      let response = "I didn't find any invoices";
      if (queryInfo.dateRange) {
        response += ` between ${queryInfo.dateRange.start} and ${queryInfo.dateRange.end}`;
      }
      if (queryInfo.amountRange) {
        response += ` with amounts between $${queryInfo.amountRange.min} and $${queryInfo.amountRange.max}`;
      }
      return response + ".";
    }

    let response = `I found ${totalCount} invoice${totalCount !== 1 ? 's' : ''}`;
    
    if (queryInfo.dateRange) {
      response += ` from ${queryInfo.dateRange.start} to ${queryInfo.dateRange.end}`;
    }
    
    if (queryInfo.amountRange) {
      response += ` with amounts between $${queryInfo.amountRange.min} and $${queryInfo.amountRange.max}`;
    }
    
    response += '. Here are the details:\n\n';

    // Show invoice details
    invoices.forEach((invoice, index) => {
      response += `Invoice ${index + 1}: ${invoice.docNumber}\n`;
      response += `  Customer: ${invoice.customerRef.name}\n`;
      response += `  Date: ${invoice.txnDate}\n`;
      response += `  Amount: $${invoice.totalAmt.toFixed(2)}\n`;
      response += `  Balance: $${invoice.balance.toFixed(2)}\n`;
      if (invoice.line.length > 0 && invoice.line[0].salesItemLineDetail) {
        response += `  Item: ${invoice.line[0].salesItemLineDetail.itemRef.name}\n`;
      }
      response += '\n';
    });

    return response.trim();
  }
} 