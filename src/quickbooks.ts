import { QuickBooksQueryParams, QuickBooksResponse, QuickBooksInvoice } from './types';

export class QuickBooksService {
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private refreshToken?: string;
  private companyId?: string;
  private baseUrl: string;

  constructor(clientId: string, clientSecret: string, isProduction = false) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    // Use sandbox for development, production for live data
    this.baseUrl = isProduction 
      ? 'https://quickbooks.api.intuit.com' 
      : 'https://sandbox-quickbooks.api.intuit.com';
  }

  /**
   * Generate OAuth authorization URL for QuickBooks
   */
  generateAuthUrl(redirectUri: string, state?: string): string {
    const scope = 'com.intuit.quickbooks.accounting';
    const authUrl = 'https://appcenter.intuit.com/connect/oauth2';
    
    const params = new URLSearchParams({
      'client_id': this.clientId,
      'scope': scope,
      'redirect_uri': redirectUri,
      'response_type': 'code',
      'access_type': 'offline'
    });

    if (state) {
      params.append('state', state);
    }

    return `${authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string;
    companyId: string;
  }> {
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    
    const body = new URLSearchParams({
      'grant_type': 'authorization_code',
      'code': code,
      'redirect_uri': redirectUri
    });

    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth token exchange failed: ${error}`);
    }

    const tokenData = await response.json() as any;
    
    this.accessToken = tokenData.access_token;
    this.refreshToken = tokenData.refresh_token;
    this.companyId = tokenData.realmId;

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      companyId: tokenData.realmId
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    
    const body = new URLSearchParams({
      'grant_type': 'refresh_token',
      'refresh_token': this.refreshToken
    });

    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const tokenData = await response.json() as any;
    this.accessToken = tokenData.access_token;
    
    if (tokenData.refresh_token) {
      this.refreshToken = tokenData.refresh_token;
    }

    return tokenData.access_token;
  }

  /**
   * Set tokens for API calls (from stored values)
   */
  setTokens(accessToken: string, refreshToken: string, companyId: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.companyId = companyId;
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
   * Make authenticated API call to QuickBooks
   */
  private async makeApiCall(endpoint: string, retryOnAuth = true): Promise<any> {
    if (!this.accessToken || !this.companyId) {
      throw new Error('QuickBooks not authenticated. Please complete OAuth flow first.');
    }

    const url = `${this.baseUrl}/v3/company/${this.companyId}/${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json'
      }
    });

    // Handle token expiration
    if (response.status === 401 && retryOnAuth && this.refreshToken) {
      try {
        await this.refreshAccessToken();
        return this.makeApiCall(endpoint, false); // Retry once
      } catch (refreshError) {
        throw new Error('Authentication failed. Please re-authorize with QuickBooks.');
      }
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`QuickBooks API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Search invoices based on query parameters
   */
  async searchInvoices(params: QuickBooksQueryParams): Promise<QuickBooksResponse> {
    try {
      // Build QuickBooks SQL query
      let query = "SELECT * FROM Invoice";
      const conditions: string[] = [];

      // Add date filter
      if (params.dateRange) {
        conditions.push(`TxnDate >= '${params.dateRange.start}'`);
        conditions.push(`TxnDate <= '${params.dateRange.end}'`);
      }

      // Add amount filter
      if (params.amountRange) {
        conditions.push(`TotalAmt >= ${params.amountRange.min}`);
        conditions.push(`TotalAmt <= ${params.amountRange.max}`);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      // Add ordering and limit
      query += ' ORDER BY TxnDate DESC';
      if (params.limit) {
        query += ` MAXRESULTS ${params.limit}`;
      }

      // Make API call
      const response = await this.makeApiCall(`query?query=${encodeURIComponent(query)}`);
      
      const invoices = response.QueryResponse?.Invoice || [];
      
      // Transform QuickBooks format to our standardized format
      const transformedInvoices: QuickBooksInvoice[] = invoices.map((invoice: any) => ({
        id: invoice.Id,
        docNumber: invoice.DocNumber,
        txnDate: invoice.TxnDate,
        dueDate: invoice.DueDate,
        totalAmt: parseFloat(invoice.TotalAmt || '0'),
        balance: parseFloat(invoice.Balance || '0'),
        customerRef: {
          value: invoice.CustomerRef?.value || '',
          name: invoice.CustomerRef?.name || 'Unknown Customer'
        },
        line: invoice.Line?.map((line: any) => ({
          amount: parseFloat(line.Amount || '0'),
          detailType: line.DetailType,
          salesItemLineDetail: line.SalesItemLineDetail ? {
            itemRef: {
              value: line.SalesItemLineDetail.ItemRef?.value || '',
              name: line.SalesItemLineDetail.ItemRef?.name || 'Unknown Item'
            },
            qty: parseFloat(line.SalesItemLineDetail.Qty || '0'),
            unitPrice: parseFloat(line.SalesItemLineDetail.UnitPrice || '0')
          } : undefined
        })) || []
      }));

      return {
        companyId: this.companyId!,
        invoices: transformedInvoices,
        totalCount: transformedInvoices.length,
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
   * Get company information
   */
  async getCompanyInfo(): Promise<any> {
    try {
      const response = await this.makeApiCall('companyinfo/1');
      return response.QueryResponse?.CompanyInfo?.[0];
    } catch (error: any) {
      throw new Error(`Failed to get company info: ${error.message}`);
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