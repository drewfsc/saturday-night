/**
 * Development utilities for testing and debugging the MCP server
 */

import { MCPRequest, MCPResponse } from './types';

export class DevUtils {
  /**
   * Create a test MCP request
   */
  static createTestRequest(
    toolName: string,
    args: Record<string, any>,
    id: string = 'test-request'
  ): MCPRequest {
    return {
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      },
      id
    };
  }

  /**
   * Format MCP response for pretty printing
   */
  static formatResponse(response: MCPResponse): string {
    return JSON.stringify(response, null, 2);
  }

  /**
   * Test data generators
   */
  static generateTestQueries() {
    return {
      googleSheets: [
        "Get all rows from the first sheet",
        "Show me the first 10 rows from the Sales sheet",
        "Get data from range A1:D10",
        "Show only Subject, Date, and From columns"
      ],
      quickBooks: [
        "Show me invoices from January 2025",
        "Find invoices over $1000 this month",
        "Get invoices between $500 and $2000 from last week",
        "Show unpaid invoices for Acme Corporation"
      ]
    };
  }

  /**
   * Validate MCP response structure
   */
  static validateResponse(response: MCPResponse): boolean {
    if (response.error) {
      console.error('Response contains error:', response.error);
      return false;
    }

    if (!response.result) {
      console.error('Response missing result field');
      return false;
    }

    return true;
  }

  /**
   * Create mock Google Sheets data for testing
   */
  static createMockSheetData() {
    return {
      values: [
        ['Name', 'Email', 'Department', 'Salary'],
        ['John Doe', 'john@example.com', 'Engineering', '120000'],
        ['Jane Smith', 'jane@example.com', 'Marketing', '95000'],
        ['Bob Johnson', 'bob@example.com', 'Sales', '85000']
      ]
    };
  }

  /**
   * Create mock QuickBooks invoice data
   */
  static createMockInvoiceData() {
    return {
      QueryResponse: {
        Invoice: [
          {
            Id: '123',
            DocNumber: 'INV-001',
            TxnDate: '2025-01-15',
            DueDate: '2025-02-15',
            TotalAmt: '1500.00',
            Balance: '500.00',
            CustomerRef: {
              value: '456',
              name: 'Acme Corporation'
            },
            Line: [{
              Amount: '1500.00',
              DetailType: 'SalesItemLineDetail',
              SalesItemLineDetail: {
                ItemRef: {
                  value: '789',
                  name: 'Consulting Services'
                },
                Qty: '10',
                UnitPrice: '150'
              }
            }]
          }
        ]
      }
    };
  }
}