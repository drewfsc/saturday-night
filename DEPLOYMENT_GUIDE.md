# 🚀 Deployment Guide - Google Sheets MCP Server

## 📋 Prerequisites Checklist

### ✅ **Google Cloud Setup** (Do This First!)

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project or select existing one
   - Note your project ID

2. **Enable Google Sheets API**
   ```bash
   # Via console: APIs & Services > Library > Search "Google Sheets API" > Enable
   # Or via CLI (if you have gcloud):
   gcloud services enable sheets.googleapis.com
   ```

3. **Create Service Account**
   - Go to IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Name: `sheets-mcp-service`
   - Description: `Service account for MCP Google Sheets integration`
   - Click "Create and Continue"

4. **Assign Roles**
   - Skip role assignment (we'll use minimal permissions)
   - Click "Continue" then "Done"

5. **Generate Service Account Key**
   - Click on your new service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create New Key"
   - Choose "JSON" format
   - Download and save the JSON file securely
   - **IMPORTANT**: Keep this file safe - it contains your credentials!

6. **Share Your Google Sheet**
   - Open your Google Sheet: `1sXrmr0GlfKMk6TicjEuLaV22_-j7M_5TEBjy7OvcnwE`
   - Click "Share" button
   - Add the service account email (found in the JSON file as `client_email`)
   - Set permission to "Viewer"
   - Click "Send"

### ✅ **Cloudflare Setup**

1. **Cloudflare Account**
   - Sign up at [cloudflare.com](https://cloudflare.com)
   - Free plan works for testing, but Workers paid plan recommended for production

2. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

3. **Authenticate Wrangler**
   ```bash
   wrangler login
   ```
   This opens a browser window to authenticate with Cloudflare.

## 🔧 **Deployment Steps**

### Step 1: Install Dependencies
```bash
cd your-project-directory
npm install
```

### Step 2: Configure Environment Variables
```bash
# Set your Google Service Account credentials
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
# When prompted, paste the ENTIRE contents of your downloaded JSON file

# Optional: Set CORS origins for OpenAI integration
wrangler secret put ALLOWED_ORIGINS
# Enter: https://chat.openai.com,*
```

### Step 3: Update Configuration (Optional)
If you want to change the default spreadsheet ID:
```bash
# Edit wrangler.toml
# Change DEFAULT_SPREADSHEET_ID = "your-sheet-id-here"
```

### Step 4: Deploy to Cloudflare
```bash
# Deploy to production
npm run deploy

# Or deploy to staging first
wrangler deploy --env staging
```

### Step 5: Test Your Deployment
```bash
# Get your worker URL from the deploy output, then test:

# Health check
curl https://your-worker.your-subdomain.workers.dev/health

# Test with your default sheet
curl "https://your-worker.your-subdomain.workers.dev/test?query=Get all rows from the first sheet"

# Test with specific sheet ID
curl "https://your-worker.your-subdomain.workers.dev/test?spreadsheetId=1sXrmr0GlfKMk6TicjEuLaV22_-j7M_5TEBjy7OvcnwE&query=Show me 5 rows"
```

## 🛠️ **Troubleshooting Common Issues**

### "Missing Google Service Account credentials"
```bash
# Check if secret was set correctly
wrangler secret list
# Should show GOOGLE_SERVICE_ACCOUNT_KEY

# Re-set the secret if needed
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
```

### "Permission denied" on Google Sheets
- Verify you shared the sheet with the service account email
- Check the email in your JSON file under `client_email`
- Make sure the service account has at least "Viewer" permission

### "Worker script not found" or deployment errors
```bash
# Check your wrangler.toml configuration
cat wrangler.toml

# Try deploying with verbose output
wrangler deploy --verbose
```

### CORS Issues (for OpenAI Custom GPT)
```bash
# Set allowed origins
wrangler secret put ALLOWED_ORIGINS
# Enter: https://chat.openai.com,*

# Redeploy
npm run deploy
```

## 🔐 **Security Best Practices**

1. **Service Account Permissions**
   - Only share sheets that the service account needs access to
   - Use "Viewer" permission (read-only) unless you need write access later

2. **Environment Variables**
   - Never commit your service account JSON to git
   - Use Cloudflare secrets for sensitive data
   - Consider using separate service accounts for staging/production

3. **CORS Configuration**
   - Be specific about allowed origins in production
   - For testing, `*` is okay, but restrict in production

## 📊 **Cost Considerations**

### Cloudflare Workers
- **Free Plan**: 100,000 requests/day, sufficient for testing
- **Workers Paid ($5/month)**: 10 million requests/month + additional features
- **Usage**: Each API call counts as one request

### Google Sheets API
- **Free Quota**: 300 requests per minute per project
- **Rate Limits**: 100 requests per 100 seconds per user
- **Cost**: Free for most use cases

## 🎯 **Success Verification**

Your deployment is successful when:

1. ✅ Health check returns `{"status": "healthy"}`
2. ✅ Test endpoint returns sheet data
3. ✅ Configuration shows your default spreadsheet ID
4. ✅ No CORS errors when testing with OpenAI

## 🔄 **Next Steps After Deployment**

1. **OpenAI Custom GPT Integration**
   - Use your worker URL in the Custom GPT Actions
   - Import the OpenAPI schema from the README
   - Test natural language queries

2. **Monitoring & Maintenance**
   - Check Cloudflare dashboard for usage metrics
   - Monitor Google Cloud console for API usage
   - Set up alerts for quota limits if needed

3. **Extensions**
   - Add more Google Workspace integrations
   - Implement caching for better performance
   - Add authentication for production use 