/**
 * Enhanced natural language query parser
 */

export interface QueryIntent {
  action: string;
  entities: Record<string, any>;
  confidence: number;
  originalQuery: string;
}

export class QueryParser {
  private static readonly DATE_PATTERNS = {
    relative: {
      today: () => {
        const date = new Date().toISOString().split('T')[0];
        return { start: date, end: date };
      },
      yesterday: () => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        const dateStr = date.toISOString().split('T')[0];
        return { start: dateStr, end: dateStr };
      },
      'this week': () => {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        return {
          start: weekStart.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        };
      },
      'last week': () => {
        const now = new Date();
        const lastWeekEnd = new Date(now);
        lastWeekEnd.setDate(now.getDate() - now.getDay() - 1);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
        return {
          start: lastWeekStart.toISOString().split('T')[0],
          end: lastWeekEnd.toISOString().split('T')[0]
        };
      },
      'this month': () => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          start: monthStart.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        };
      },
      'last month': () => {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          start: lastMonth.toISOString().split('T')[0],
          end: lastMonthEnd.toISOString().split('T')[0]
        };
      },
      'this year': () => {
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return {
          start: yearStart.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        };
      }
    },
    
    months: [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ]
  };

  /**
   * Parse date references from query
   */
  static parseDateRange(query: string): { start: string; end: string } | undefined {
    const lowerQuery = query.toLowerCase();
    
    // Check relative dates
    for (const [pattern, generator] of Object.entries(this.DATE_PATTERNS.relative)) {
      if (lowerQuery.includes(pattern)) {
        return generator();
      }
    }
    
    // Check month names
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < this.DATE_PATTERNS.months.length; i++) {
      const month = this.DATE_PATTERNS.months[i];
      if (lowerQuery.includes(month)) {
        const yearMatch = query.match(/\b(20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;
        const monthStart = new Date(year, i, 1);
        const monthEnd = new Date(year, i + 1, 0);
        return {
          start: monthStart.toISOString().split('T')[0],
          end: monthEnd.toISOString().split('T')[0]
        };
      }
    }
    
    // Check ISO date patterns
    const isoPattern = /(\d{4}-\d{2}-\d{2})(?:\s*(?:to|through|-|until)\s*(\d{4}-\d{2}-\d{2}))?/;
    const isoMatch = query.match(isoPattern);
    if (isoMatch) {
      if (isoMatch[2]) {
        return { start: isoMatch[1], end: isoMatch[2] };
      } else {
        return { start: isoMatch[1], end: isoMatch[1] };
      }
    }
    
    return undefined;
  }

  /**
   * Parse amount ranges with better currency handling
   */
  static parseAmountRange(query: string): { min: number; max: number } | undefined {
    const patterns = [
      // Between X and Y
      /(?:between|from)\s*\$?([\d,]+(?:\.\d{2})?)\s*(?:to|and|-)\s*\$?([\d,]+(?:\.\d{2})?)/i,
      // Over/above X
      /(?:over|above|greater than|more than)\s*\$?([\d,]+(?:\.\d{2})?)/i,
      // Under/below X
      /(?:under|below|less than)\s*\$?([\d,]+(?:\.\d{2})?)/i,
      // Exactly X
      /(?:exactly|equals?)\s*\$?([\d,]+(?:\.\d{2})?)/i,
    ];

    for (let i = 0; i < patterns.length; i++) {
      const match = query.match(patterns[i]);
      if (match) {
        const cleanAmount = (amt: string) => parseFloat(amt.replace(/,/g, ''));
        
        switch (i) {
          case 0: // Between
            return {
              min: cleanAmount(match[1]),
              max: cleanAmount(match[2])
            };
          case 1: // Over
            return {
              min: cleanAmount(match[1]),
              max: 999999999
            };
          case 2: // Under
            return {
              min: 0,
              max: cleanAmount(match[1])
            };
          case 3: // Exactly
            const exact = cleanAmount(match[1]);
            return {
              min: exact,
              max: exact
            };
        }
      }
    }
    
    return undefined;
  }

  /**
   * Extract entity names (customers, companies, etc.)
   */
  static extractEntities(query: string): string[] {
    const entities: string[] = [];
    
    // Look for quoted strings
    const quotedPattern = /["']([^"']+)["']/g;
    let match;
    while ((match = quotedPattern.exec(query)) !== null) {
      entities.push(match[1]);
    }
    
    // Look for proper nouns (capitalized words)
    const properNounPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    while ((match = properNounPattern.exec(query)) !== null) {
      // Skip common words
      const skipWords = ['Get', 'Show', 'Find', 'Search', 'List', 'The', 'From', 'Invoice', 'Sheet'];
      if (!skipWords.includes(match[1])) {
        entities.push(match[1]);
      }
    }
    
    return [...new Set(entities)]; // Remove duplicates
  }

  /**
   * Determine query intent with confidence scoring
   */
  static analyzeIntent(query: string): QueryIntent {
    const lowerQuery = query.toLowerCase();
    let action = 'unknown';
    let confidence = 0;
    
    // Sheet actions
    if (lowerQuery.includes('sheet') || lowerQuery.includes('spreadsheet')) {
      if (lowerQuery.includes('info') || lowerQuery.includes('detail')) {
        action = 'get_sheet_info';
        confidence = 0.9;
      } else if (lowerQuery.includes('range') || /[a-z]\d+:[a-z]\d+/i.test(query)) {
        action = 'get_range';
        confidence = 0.85;
      } else {
        action = 'get_rows';
        confidence = 0.8;
      }
    }
    
    // Invoice actions
    if (lowerQuery.includes('invoice')) {
      action = 'search_invoices';
      confidence = 0.9;
    }
    
    // Extract all entities
    const entities: Record<string, any> = {
      dateRange: this.parseDateRange(query),
      amountRange: this.parseAmountRange(query),
      namedEntities: this.extractEntities(query),
      limit: this.extractLimit(query)
    };
    
    return {
      action,
      entities,
      confidence,
      originalQuery: query
    };
  }

  /**
   * Extract limit/count from query
   */
  private static extractLimit(query: string): number | undefined {
    const patterns = [
      /(?:first|top|limit to|show)\s*(\d+)/i,
      /(\d+)\s*(?:rows?|records?|results?|items?)/i,
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }
    
    return undefined;
  }
}