# Google Sheets MCP Server - Proof of Concept

A Cloudflare-hosted MCP (Model Context Protocol) server that enables OpenAI Custom GPTs to query Google Sheets using natural language. Designed for verbal interactions with intelligent data processing.

## 🎯 Project Overview

This POC bridges the gap between conversational AI and spreadsheet data, allowing users to:
- Query Google Sheets using natural language
- Get responses optimized for verbal communication
- Integrate seamlessly with OpenAI Custom GPTs
- Handle complex spreadsheet operations through simple commands

## 🏗️ Architecture

```
User Voice Input → OpenAI Custom GPT → MCP Protocol → Cloudflare Worker → Google Sheets API
```

## ✨ Features

- **Natural Language Processing**: Converts verbal queries into Google Sheets operations
- **Multi-format Responses**: Verbal, structured, or combined response formats
- **Sheet Intelligence**: Automatic sheet detection and metadata extraction
- **Error Resilience**: Graceful handling of API errors with human-readable messages
- **CORS Support**: Cross-origin requests for web integration
- **Test Endpoints**: Built-in testing and debugging capabilities

## 🚀 Quick Start

### 1. Prerequisites

- Cloudflare account with Workers plan
- Google Cloud Console project
- OpenAI Plus subscription (for Custom GPT)
- Node.js 18+ and npm

### 2. Google Cloud Setup

1. **Create/Select Project**: Go to [Google Cloud Console](https://console.cloud.google.com)
2. **Enable APIs**: Enable the Google Sheets API
3. **Create Service Account**:
   ```bash
   # Go to IAM & Admin > Service Accounts
   # Click "Create Service Account"
   # Name: "sheets-mcp-service"
   # Role: "Viewer" (or custom role with Sheets read permissions)
   ```
4. **Generate Key**: Download JSON credentials
5. **Share Sheets**: Share your Google Sheets with the service account email

### 3. Installation & Deployment

```bash
# Install dependencies
npm install

# Set up Wrangler (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Set environment variables
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
# Paste the entire JSON content from your downloaded service account key

# Optional: Set allowed origins for CORS
wrangler secret put ALLOWED_ORIGINS
# Example: "https://chat.openai.com,*" for OpenAI and development

# Deploy to Cloudflare
npm run deploy
```

### 4. Test Your Deployment

```bash
# Test health endpoint
curl https://your-worker.your-subdomain.workers.dev/health

# Test with default Google Sheet (no ID needed)
curl "https://your-worker.your-subdomain.workers.dev/test?query=Get all rows from the first sheet"

# Test with specific Google Sheet ID
curl "https://your-worker.your-subdomain.workers.dev/test?spreadsheetId=YOUR_SHEET_ID&query=Get all rows from the first sheet"
```

## 🤖 OpenAI Custom GPT Integration

### Custom GPT Instructions

```text
You are a Google Sheets assistant powered by an MCP server. You can query and analyze Google Spreadsheet data using natural language.

CAPABILITIES:
- Query Google Sheets by spreadsheet ID
- Retrieve rows, ranges, and sheet information
- Format responses for conversation and analysis
- Handle multiple sheets within a spreadsheet

USAGE EXAMPLES:
- "Get all data from spreadsheet 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
- "Show me the first 5 rows from the Sales sheet"
- "What information is available in this spreadsheet?"

Always confirm spreadsheet IDs with users and explain what data you're retrieving.
```

### Actions Configuration

1. **Create Custom GPT**: Go to OpenAI → Create a GPT
2. **Add Action**: Import the OpenAPI schema:

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Google Sheets MCP API",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://your-worker.your-subdomain.workers.dev"
    }
  ],
  "paths": {
    "/mcp": {
      "post": {
        "description": "Query Google Sheets using MCP protocol",
        "operationId": "queryGoogleSheets",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "method": {"type": "string", "enum": ["tools/call"]},
                  "params": {
                    "type": "object",
                    "properties": {
                      "name": {"type": "string", "enum": ["query_google_sheets"]},
                      "arguments": {
                        "type": "object",
                        "properties": {
                          "query": {"type": "string"},
                          "spreadsheetId": {"type": "string"},
                          "responseFormat": {"type": "string", "enum": ["both"], "default": "both"}
                        },
                        "required": ["query"]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## 💬 Usage Examples

### Natural Language Queries

**Basic Data Retrieval:**
```
User: "Get all rows from my spreadsheet"
Response: "I found 15 rows from the 'Class Data' sheet. Here's the data:
Columns: Name, Gender, Class Level, Home State, Major, Extracurricular Activity
Row 1: Name: Alexandra, Gender: Female, Class Level: 4, Home State: CA, Major: English, Extracurricular Activity: Drama Club
..."
```

**Specific Sheet ID (Override Default):**
```
User: "Get all rows from spreadsheet 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
Response: "I found data from the specified spreadsheet..."
```

**Specific Sheet Queries:**
```
User: "Show me the first 10 rows from the Sales sheet in my spreadsheet"
Response: "I found 10 rows from the 'Sales' sheet (showing first 10 of 150 total rows). Here's the data:..."
```

**Sheet Information:**
```
User: "What sheets are available in spreadsheet ABC123?"
Response: "The spreadsheet 'Q4 Sales Data' contains 3 sheets: Sales, Customers, Products."
```

### API Examples

**Direct MCP Request:**
```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "query_google_sheets",
      "arguments": {
        "query": "Get the first 5 rows from the main sheet",
        "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
        "responseFormat": "both"
      }
    },
    "id": "request-1"
  }'
```

## 🔄 Changing the Default Sheet ID

To change to a different Google Sheet as your default:

1. **Update `wrangler.toml`**:
   ```toml
   DEFAULT_SPREADSHEET_ID = "your-new-sheet-id-here"
   ```

2. **Redeploy to Cloudflare**:
   ```bash
   npm run deploy
   ```

3. **Verify the change**:
   ```bash
   curl https://your-worker.your-subdomain.workers.dev/health
   ```
   Check the `configuration.defaultSpreadsheetId` field in the response.

**Alternative: Environment Variable Method**
```bash
# Set as environment variable instead of in wrangler.toml
wrangler secret put DEFAULT_SPREADSHEET_ID
# Enter your new sheet ID when prompted

# Deploy
npm run deploy
```

## 🔧 Development

### Local Development

```bash
# Start development server
npm run dev

# Test locally with default sheet
curl "http://localhost:8787/test?query=Get all rows"

# Test locally with specific sheet
curl "http://localhost:8787/test?spreadsheetId=YOUR_SHEET_ID&query=Get all rows"
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON string of service account credentials | Yes |
| `DEFAULT_SPREADSHEET_ID` | Default Google Sheets ID to use when none specified | No |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `MCP_VERSION` | API version | No |

### Project Structure

```
/
├── src/
│   ├── index.ts           # Cloudflare Worker entry point
│   ├── mcp-server.ts      # MCP protocol implementation
│   ├── google-sheets.ts   # Google Sheets API integration
│   └── types.ts           # TypeScript definitions
├── wrangler.toml          # Cloudflare configuration
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

## 🔒 Security Considerations

- **Service Account Permissions**: Use minimal required permissions (read-only recommended)
- **Environment Variables**: Store credentials securely in Cloudflare secrets
- **CORS Configuration**: Restrict origins to trusted domains
- **Input Validation**: All queries are validated before processing
- **Rate Limiting**: Consider implementing rate limits for production use

## 🛠️ Troubleshooting

### Common Issues

**"Missing Google Service Account credentials"**
- Ensure `GOOGLE_SERVICE_ACCOUNT_KEY` is set via `wrangler secret put`
- Verify the JSON is valid and properly formatted

**"Permission denied" on Google Sheets**
- Share your Google Sheet with the service account email
- Check service account has appropriate permissions

**CORS errors in Custom GPT**
- Set `ALLOWED_ORIGINS` to include `https://chat.openai.com`
- Verify CORS headers are properly configured

### Debug Endpoints

- **Health Check**: `GET /health` - Service status and configuration
- **Test Endpoint**: `GET /test?spreadsheetId=ID&query=QUERY` - Direct testing
- **MCP Endpoint**: `POST /mcp` - Main MCP protocol endpoint

## 🔮 Future Extensions

This POC provides the foundation for expanded Google Workspace integration:

- **Google Calendar**: Event creation, querying, and management
- **Google Drive**: File operations and content analysis
- **Advanced Queries**: Filtering, sorting, and data aggregation
- **Batch Operations**: Multiple sheet operations in single requests
- **Caching Layer**: Performance optimization for repeated queries
- **Webhook Support**: Real-time data synchronization

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Built with modern web standards for seamless AI-human-data interaction. Perfect for transforming static spreadsheets into conversational data experiences.** 