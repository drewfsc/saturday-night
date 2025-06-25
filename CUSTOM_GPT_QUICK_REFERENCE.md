# Custom GPT Quick Reference

## Server URL
```
https://google-sheets-mcp-server.drumacmusic.workers.dev
```

## OpenAPI Schema
Use this complete schema in your Custom GPT actions:

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Multi-Source Data MCP API",
    "description": "Query Google Sheets and QuickBooks data using natural language through MCP protocol",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://google-sheets-mcp-server.drumacmusic.workers.dev"
    }
  ],
  "paths": {
    "/mcp": {
      "post": {
        "description": "Send MCP requests to query Google Sheets and QuickBooks data",
        "operationId": "queryMultiSourceData",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "method": {
                    "type": "string",
                    "enum": ["tools/call"]
                  },
                  "params": {
                    "type": "object",
                    "properties": {
                      "name": {
                        "type": "string",
                        "enum": ["query_google_sheets", "get_sheet_info", "search_quickbooks_invoices"]
                      },
                      "arguments": {
                        "type": "object",
                        "properties": {
                          "query": {
                            "type": "string",
                            "description": "Natural language query describing what data to retrieve"
                          },
                          "spreadsheetId": {
                            "type": "string",
                            "description": "Google Sheets spreadsheet ID (required for Google Sheets queries)"
                          },
                          "responseFormat": {
                            "type": "string",
                            "enum": ["verbal", "structured", "both"],
                            "default": "both",
                            "description": "Format of response - verbal for conversational output, structured for raw data, both for complete response"
                          }
                        },
                        "required": ["query"]
                      }
                    },
                    "required": ["name", "arguments"]
                  },
                  "id": {
                    "type": "string",
                    "description": "Request ID for tracking"
                  }
                },
                "required": ["method", "params"]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful MCP response with data",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "result": {
                      "type": "object",
                      "description": "Response data containing verbal response, structured data, and conversational context"
                    },
                    "error": {
                      "type": "object",
                      "description": "Error information if request failed"
                    },
                    "id": {
                      "type": "string",
                      "description": "Request ID for tracking"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Bad request - invalid parameters or query"
          },
          "500": {
            "description": "Internal server error"
          }
        }
      }
    }
  }
}
```

## GPT Instructions
```
You are a multi-source data assistant that can query Google Sheets and QuickBooks using natural language.

GOOGLE SHEETS CAPABILITIES:
- Query Google Sheets data by spreadsheet ID
- Retrieve specific rows, ranges, or entire sheets
- Get spreadsheet information and sheet details
- Format responses for both technical and conversational use
- Filter data by columns and apply limits
- Parse natural language queries into structured requests

QUICKBOOKS CAPABILITIES:
- Search invoices by date range and amount thresholds
- Filter invoices by customer name, status, and payment terms
- Retrieve invoice details including line items and payment status
- Natural language parsing for financial queries
- Support for amount ranges (e.g., "over $1000", "between $500-$2000")
- Date range parsing (e.g., "this month", "last week", "January 2025")

USAGE PATTERNS - GOOGLE SHEETS:
1. "Get all rows from spreadsheet ID [SHEET_ID]"
2. "Show me the first 10 rows from the Sales sheet in [SHEET_ID]"
3. "Get information about spreadsheet [SHEET_ID]"
4. "Retrieve data from range A1:D10 in [SHEET_ID]"
5. "Get only the Name and Email columns from [SHEET_ID]"
6. "Show me rows 5-15 from [SHEET_ID]"

USAGE PATTERNS - QUICKBOOKS:
1. "Show me invoices from January 2025"
2. "Find invoices over $1000 this month"
3. "Get invoices between $500 and $2000 from last week"
4. "Show unpaid invoices for Acme Corporation"
5. "Find invoices for customer John Smith from last month"
6. "Get all invoices with amounts greater than $5000"
7. "Show me overdue invoices from the past 30 days"
8. "Find invoices with status 'pending' from this quarter"

RESPONSE FORMATS:
- Verbal: Natural language descriptions of the data
- Structured: Raw data in JSON format
- Both: Complete response with conversational context

QUERY EXAMPLES:
Google Sheets:
- "Get first 5 rows from the default spreadsheet"
- "Show me data from columns A, B, and C"
- "Retrieve rows 10-20 from the sheet"

QuickBooks:
- "Show me invoices from this month over $1000"
- "Find unpaid invoices for the last 30 days"
- "Get invoices between $500-$2000 from January 2025"
- "Show me all invoices for customer 'Acme Corp'"

Always ask for clarification if the query could apply to multiple data sources. For Google Sheets queries, use the default spreadsheet ID if none is specified. For QuickBooks queries, provide helpful context about the data found and suggest follow-up questions.
```

## Test Queries

### Google Sheets
- "Get the first 5 rows from my spreadsheet"
- "Show me data from columns A and B"
- "What's in my spreadsheet?"

### QuickBooks
- "Show me invoices from this month over $1000"
- "Find unpaid invoices from the last 30 days"
- "Get invoices between $500-$2000 from January 2025"

## Server Test Endpoints

- **Health Check**: `https://google-sheets-mcp-server.drumacmusic.workers.dev/health`
- **Google Sheets Test**: `https://google-sheets-mcp-server.drumacmusic.workers.dev/test?query=Get%20first%205%20rows`
- **QuickBooks Test**: `https://google-sheets-mcp-server.drumacmusic.workers.dev/test/quickbooks?query=Show%20me%20invoices%20over%20%241000`
- **QuickBooks Auth**: `https://google-sheets-mcp-server.drumacmusic.workers.dev/auth/quickbooks`
- **QuickBooks Status**: `https://google-sheets-mcp-server.drumacmusic.workers.dev/auth/quickbooks/status`

## Available Tools

1. **query_google_sheets** - Query Google Sheets data
2. **get_sheet_info** - Get spreadsheet metadata
3. **search_quickbooks_invoices** - Search QuickBooks invoices

## Response Formats

- **verbal** - Natural language response
- **structured** - Raw JSON data
- **both** - Complete response with context (default) 