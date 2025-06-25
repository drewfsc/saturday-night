# QuickBooks OAuth Setup Guide

This guide will walk you through setting up QuickBooks OAuth authentication for your MCP server.

## Prerequisites

- QuickBooks Developer account (free)
- Access to your deployed MCP server
- QuickBooks Online account (for testing)

## Step 1: Create QuickBooks App

### 1.1 Access Developer Portal
1. Go to [QuickBooks Developer Portal](https://developer.intuit.com/)
2. Sign in with your Intuit account
3. Click "My Apps" in the top navigation

### 1.2 Create New App
1. Click "Create App" or "New App"
2. Choose **"OAuth 2.0"** as the app type
3. Fill in the app details:
   - **App Name**: `Multi-Source Data Assistant`
   - **App Description**: `MCP server for querying QuickBooks data using natural language`
   - **App Type**: `Web App`
   - **Environment**: Choose `Production` (or `Sandbox` for testing)

### 1.3 Configure OAuth Settings
1. In your app settings, find the "OAuth 2.0" section
2. Add the redirect URI:
   ```
   https://google-sheets-mcp-server.drumacmusic.workers.dev/auth/quickbooks/callback
   ```
3. Save the configuration

### 1.4 Get Credentials
1. Note your **Client ID** (looks like: `ABcdefGHijklMNopqrstUVwxyz123456789`)
2. Note your **Client Secret** (looks like: `abcdefghijklmnopqrstuvwxyz123456789`)
3. Keep these secure - you'll need them for the server configuration

## Step 2: Configure Server Credentials

### 2.1 Upload Client ID
```bash
wrangler secret put QUICKBOOKS_CLIENT_ID
```
When prompted, enter your Client ID.

### 2.2 Upload Client Secret
```bash
wrangler secret put QUICKBOOKS_CLIENT_SECRET
```
When prompted, enter your Client Secret.

### 2.3 Deploy Updated Server
```bash
wrangler deploy
```

## Step 3: Complete OAuth Flow

### 3.1 Start Authorization
1. Visit the authorization URL:
   ```
   https://google-sheets-mcp-server.drumacmusic.workers.dev/auth/quickbooks
   ```

2. You'll be redirected to QuickBooks to authorize the app

### 3.2 Authorize the App
1. Sign in to your QuickBooks account
2. Review the permissions requested
3. Click "Authorize" to grant access

### 3.3 Complete the Flow
1. You'll be redirected back to your server
2. The server will exchange the authorization code for access tokens
3. Tokens will be stored securely for future API calls

## Step 4: Verify Setup

### 4.1 Check OAuth Status
Visit: `https://google-sheets-mcp-server.drumacmusic.workers.dev/auth/quickbooks/status`

You should see a response indicating the OAuth status.

### 4.2 Test with Real Data
Visit: `https://google-sheets-mcp-server.drumacmusic.workers.dev/test/quickbooks?query=Show%20me%20invoices%20from%20this%20month`

This should return real QuickBooks data instead of mock data.

## Step 5: Update Custom GPT

### 5.1 Update Instructions
Add this to your Custom GPT instructions:

```
QUICKBOOKS IS NOW FULLY INTEGRATED:
- Real QuickBooks data is available
- OAuth authentication is configured
- You can query actual invoices, customers, and financial data
- Use natural language queries like "Show me invoices over $1000 this month"
```

### 5.2 Test QuickBooks Queries
Try these queries in your Custom GPT:
- "Show me invoices from this month over $1000"
- "Find unpaid invoices from the last 30 days"
- "Get invoices between $500-$2000 from January 2025"
- "Show me all invoices for customer 'Acme Corp'"

## Troubleshooting

### Common OAuth Issues

#### 1. "Invalid redirect URI" Error
- **Problem**: QuickBooks doesn't recognize the redirect URI
- **Solution**: 
  - Double-check the redirect URI in your app settings
  - Ensure it matches exactly: `https://google-sheets-mcp-server.drumacmusic.workers.dev/auth/quickbooks/callback`
  - Make sure there are no extra spaces or characters

#### 2. "Client ID not found" Error
- **Problem**: Server can't find the Client ID
- **Solution**:
  - Verify the secret was uploaded correctly: `wrangler secret list`
  - Re-upload if needed: `wrangler secret put QUICKBOOKS_CLIENT_ID`

#### 3. "Authorization failed" Error
- **Problem**: OAuth flow failed during authorization
- **Solution**:
  - Check that your app is in the correct environment (Production/Sandbox)
  - Verify you're using the right QuickBooks account
  - Try the authorization flow again

#### 4. "Access token expired" Error
- **Problem**: Access token has expired
- **Solution**:
  - The server should automatically refresh tokens
  - If not working, restart the OAuth flow
  - Visit the auth URL again to get new tokens

### Environment-Specific Issues

#### Sandbox vs Production
- **Sandbox**: Use for testing, limited data, free
- **Production**: Use for real data, requires app review
- **Recommendation**: Start with Sandbox for testing

#### App Review (Production Only)
If using Production environment:
1. Your app may need to go through Intuit's review process
2. This can take several days
3. Use Sandbox for immediate testing

## Advanced Configuration

### Token Storage
The server stores tokens securely. For production use, consider:
- Using Cloudflare KV for token storage
- Implementing token refresh logic
- Adding token expiration monitoring

### Scopes and Permissions
The app requests these scopes:
- `com.intuit.quickbooks.accounting` - Read access to accounting data
- `com.intuit.quickbooks.payment` - Read access to payment data

### Rate Limiting
QuickBooks has API rate limits:
- 100 requests per minute for most endpoints
- 1000 requests per day for some endpoints
- The server includes built-in rate limiting

## Security Best Practices

1. **Never commit credentials to version control**
2. **Use environment-specific apps** (Sandbox for testing, Production for live)
3. **Regularly rotate Client Secrets**
4. **Monitor API usage** for unusual patterns
5. **Implement proper error handling** for token failures

## Testing Checklist

- [ ] App created in QuickBooks Developer Portal
- [ ] Redirect URI configured correctly
- [ ] Client ID and Secret uploaded to server
- [ ] Server deployed with new credentials
- [ ] OAuth flow completed successfully
- [ ] Status endpoint shows authorized
- [ ] Test queries return real data
- [ ] Custom GPT can access QuickBooks data

## Support Resources

- [QuickBooks Developer Documentation](https://developer.intuit.com/app/developer/qbo/docs)
- [OAuth 2.0 Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
- [API Reference](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice)
- [Community Forums](https://developer.intuit.com/app/developer/qbo/community)

## Next Steps

Once OAuth is working:
1. Test various QuickBooks queries
2. Integrate with your Custom GPT
3. Set up monitoring for token expiration
4. Consider implementing additional QuickBooks entities (customers, items, etc.)
5. Add error handling for rate limits and API failures 