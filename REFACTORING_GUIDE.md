# Saturday Night Project - Refactoring Guide

## Overview

Your MCP server for Google Sheets and QuickBooks integration is solid but needs some architectural improvements for production readiness. Here's a comprehensive refactoring roadmap.

## 🔧 Immediate Fixes Completed

### 1. TypeScript Compilation Errors
- ✅ Fixed base64 encoding type issues in JWT creation
- ✅ Added missing `requestedColumns` property to interfaces
- ✅ Fixed undefined value handling in date/amount parsing
- ✅ Added `.gitignore` file

### 2. Development Tools Added
- ✅ Created `dev-utils.ts` for testing utilities
- ✅ Added error handling framework (`error-handler.ts`)
- ✅ Enhanced query parser (`query-parser.ts`)

## 🏗️ Architecture Improvements

### 1. **Separation of Concerns**

Current issue: Business logic mixed with protocol handling

**Recommendation**: Create a layered architecture
```
src/
├── api/           # HTTP request/response handling
├── services/      # Business logic (Google, QuickBooks)
├── protocols/     # MCP protocol implementation
├── parsers/       # Query parsing and NLP
├── utils/         # Shared utilities
└── config/        # Configuration management
```

### 2. **Caching Layer**

Add caching to reduce API calls:

```typescript
// src/cache/cache-manager.ts
export class CacheManager {
  private cache = new Map<string, { data: any; expires: number }>();
  
  async get<T>(key: string, fetcher: () => Promise<T>, ttl = 300): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    
    const data = await fetcher();
    this.cache.set(key, { data, expires: Date.now() + ttl * 1000 });
    return data;
  }
}
```

### 3. **Rate Limiting**

Implement rate limiting for API protection:

```typescript
// src/middleware/rate-limiter.ts
export class RateLimiter {
  private requests = new Map<string, number[]>();
  
  constructor(
    private windowMs: number = 60000,
    private maxRequests: number = 100
  ) {}
  
  check(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    const recent = requests.filter(time => time > now - this.windowMs);
    
    if (recent.length >= this.maxRequests) {
      return false;
    }
    
    recent.push(now);
    this.requests.set(identifier, recent);
    return true;
  }
}
```

## 🔐 Security Enhancements

### 1. **Input Validation**

```typescript
// src/validators/input-validator.ts
import { z } from 'zod';

export const QuerySchema = z.object({
  query: z.string().min(1).max(500),
  spreadsheetId: z.string().regex(/^[a-zA-Z0-9-_]+$/).optional(),
  responseFormat: z.enum(['verbal', 'structured', 'both']).optional()
});

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
```

### 2. **Secret Management**

```typescript
// src/config/secrets.ts
export class SecretManager {
  static getServiceAccountKey(): object {
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!key) throw new Error('Service account key not configured');
    
    try {
      return JSON.parse(key);
    } catch (e) {
      throw new Error('Invalid service account key format');
    }
  }
}
```

## 📊 Performance Optimizations

### 1. **Batch Processing**

```typescript
// src/services/batch-processor.ts
export class BatchProcessor<T, R> {
  private queue: Array<{ item: T; resolve: (value: R) => void }> = [];
  
  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private batchSize = 10,
    private delayMs = 100
  ) {
    this.processBatch();
  }
  
  async add(item: T): Promise<R> {
    return new Promise((resolve) => {
      this.queue.push({ item, resolve });
    });
  }
  
  private async processBatch() {
    setTimeout(async () => {
      if (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.batchSize);
        const results = await this.processor(batch.map(b => b.item));
        batch.forEach((b, i) => b.resolve(results[i]));
      }
      this.processBatch();
    }, this.delayMs);
  }
}
```

### 2. **Connection Pooling**

For QuickBooks OAuth tokens:

```typescript
// src/services/token-manager.ts
export class TokenManager {
  private tokens = new Map<string, { 
    accessToken: string; 
    refreshToken: string; 
    expires: number 
  }>();
  
  async getValidToken(companyId: string): Promise<string> {
    const token = this.tokens.get(companyId);
    
    if (!token || token.expires < Date.now()) {
      return this.refreshToken(companyId);
    }
    
    return token.accessToken;
  }
}
```

## 🧪 Testing Strategy

### 1. **Unit Tests**

```typescript
// src/__tests__/query-parser.test.ts
import { QueryParser } from '../query-parser';

describe('QueryParser', () => {
  describe('parseDateRange', () => {
    it('should parse "this month" correctly', () => {
      const result = QueryParser.parseDateRange('Show invoices this month');
      expect(result).toBeDefined();
      expect(result?.start).toMatch(/^\d{4}-\d{2}-01$/);
    });
  });
});
```

### 2. **Integration Tests**

```typescript
// src/__tests__/integration/mcp-server.test.ts
describe('MCP Server Integration', () => {
  it('should handle Google Sheets query', async () => {
    const request = {
      method: 'tools/call',
      params: {
        name: 'query_google_sheets',
        arguments: { query: 'Get first 5 rows' }
      }
    };
    
    const response = await mcpServer.handleRequest(request);
    expect(response.result).toBeDefined();
  });
});
```

## 📈 Monitoring & Observability

### 1. **Structured Logging**

```typescript
// src/utils/logger.ts
export class Logger {
  static log(level: 'info' | 'warn' | 'error', message: string, context?: any) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      environment: process.env.NODE_ENV
    }));
  }
}
```

### 2. **Metrics Collection**

```typescript
// src/metrics/collector.ts
export class MetricsCollector {
  private metrics = {
    requests: 0,
    errors: 0,
    latency: [] as number[]
  };
  
  recordRequest(duration: number, success: boolean) {
    this.metrics.requests++;
    if (!success) this.metrics.errors++;
    this.metrics.latency.push(duration);
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      avgLatency: this.metrics.latency.reduce((a, b) => a + b, 0) / this.metrics.latency.length
    };
  }
}
```

## 🚀 Deployment Improvements

### 1. **Environment-Specific Configs**

```typescript
// src/config/environment.ts
export const config = {
  development: {
    logLevel: 'debug',
    cacheEnabled: false,
    rateLimitRequests: 1000
  },
  production: {
    logLevel: 'info',
    cacheEnabled: true,
    rateLimitRequests: 100
  }
}[process.env.NODE_ENV || 'development'];
```

### 2. **Health Checks**

```typescript
// src/health/health-checker.ts
export class HealthChecker {
  async check(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkGoogleSheets(),
      this.checkQuickBooks(),
      this.checkMemory()
    ]);
    
    return {
      status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded',
      checks: checks.map((c, i) => ({
        name: ['google_sheets', 'quickbooks', 'memory'][i],
        status: c.status === 'fulfilled' ? 'pass' : 'fail'
      }))
    };
  }
}
```

## 📱 API Evolution

### 1. **Versioning Strategy**

```typescript
// src/api/versioning.ts
export function versionedEndpoint(version: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = async function(...args: any[]) {
      const [request] = args;
      const requestedVersion = request.headers.get('API-Version') || 'v1';
      
      if (requestedVersion !== version) {
        throw new Error(`API version ${requestedVersion} not supported`);
      }
      
      return originalMethod.apply(this, args);
    };
  };
}
```

### 2. **OpenAPI Documentation**

Generate OpenAPI spec automatically:

```typescript
// src/docs/openapi-generator.ts
export function generateOpenAPISpec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'MCP Server API',
      version: '1.1.0',
      description: 'Multi-source data integration via MCP protocol'
    },
    paths: {
      '/mcp': {
        post: {
          summary: 'Execute MCP request',
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MCPRequest' }
              }
            }
          }
        }
      }
    }
  };
}
```

## 🎯 Next Steps

1. **Immediate** (Week 1):
   - Implement input validation
   - Add basic caching
   - Set up unit tests

2. **Short-term** (Month 1):
   - Refactor to layered architecture
   - Add comprehensive error handling
   - Implement rate limiting

3. **Long-term** (Quarter 1):
   - Add monitoring and metrics
   - Implement batch processing
   - Create admin dashboard

## 💡 Pro Tips

1. **Use TypeScript strict mode**: Add `"strict": true` to tsconfig.json
2. **Implement request tracing**: Add request IDs for debugging
3. **Document edge cases**: Especially date parsing and amount formats
4. **Consider GraphQL**: For more flexible querying in the future
5. **Add webhook support**: For real-time data sync

## 🔗 Resources

- [MCP Protocol Spec](https://modelcontextprotocol.io/docs)
- [Cloudflare Workers Best Practices](https://developers.cloudflare.com/workers/platform/best-practices/)
- [Google Sheets API Performance](https://developers.google.com/sheets/api/guides/performance)
- [QuickBooks API Rate Limits](https://developer.intuit.com/app/developer/qbo/docs/learn/rest-api-features#rate-limits)

---

Remember: Great code is not just about working features, but about maintainability, scalability, and developer experience. Each refactoring step moves you closer to a production-ready system that can handle real-world complexity with grace.