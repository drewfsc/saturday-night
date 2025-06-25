/**
 * Centralized error handling for the MCP server
 */

export enum ErrorCode {
  // Authentication errors
  AUTH_MISSING_CREDENTIALS = 'AUTH_001',
  AUTH_INVALID_TOKEN = 'AUTH_002',
  AUTH_EXPIRED_TOKEN = 'AUTH_003',
  
  // API errors
  API_RATE_LIMIT = 'API_001',
  API_QUOTA_EXCEEDED = 'API_002',
  API_SERVICE_UNAVAILABLE = 'API_003',
  
  // Data errors
  DATA_NOT_FOUND = 'DATA_001',
  DATA_INVALID_FORMAT = 'DATA_002',
  DATA_PERMISSION_DENIED = 'DATA_003',
  
  // Query errors
  QUERY_INVALID_SYNTAX = 'QUERY_001',
  QUERY_MISSING_PARAMS = 'QUERY_002',
  
  // System errors
  SYSTEM_INTERNAL_ERROR = 'SYS_001',
  SYSTEM_TIMEOUT = 'SYS_002'
}

export class MCPError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }

  toMCPError() {
    return {
      code: -32603,
      message: this.message,
      data: {
        errorCode: this.code,
        details: this.details
      }
    };
  }
}

export class ErrorHandler {
  /**
   * Wrap async functions with error handling
   */
  static async handleAsync<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      console.error(`Error in ${context}:`, error);
      
      // Handle specific error types
      if (error.message?.includes('401')) {
        throw new MCPError(
          ErrorCode.AUTH_INVALID_TOKEN,
          'Authentication failed. Please check credentials.',
          401
        );
      }
      
      if (error.message?.includes('429')) {
        throw new MCPError(
          ErrorCode.API_RATE_LIMIT,
          'Rate limit exceeded. Please try again later.',
          429
        );
      }
      
      if (error.message?.includes('Permission denied')) {
        throw new MCPError(
          ErrorCode.DATA_PERMISSION_DENIED,
          'Permission denied. Please check sharing settings.',
          403
        );
      }
      
      // Default error
      throw new MCPError(
        ErrorCode.SYSTEM_INTERNAL_ERROR,
        `Operation failed: ${error.message}`,
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Create user-friendly error messages
   */
  static getUserMessage(error: MCPError): string {
    switch (error.code) {
      case ErrorCode.AUTH_MISSING_CREDENTIALS:
        return "I need authentication credentials to access this service.";
      case ErrorCode.AUTH_INVALID_TOKEN:
        return "The authentication token is invalid. Please re-authenticate.";
      case ErrorCode.API_RATE_LIMIT:
        return "I'm making too many requests. Let's wait a moment and try again.";
      case ErrorCode.DATA_NOT_FOUND:
        return "I couldn't find the data you're looking for.";
      case ErrorCode.DATA_PERMISSION_DENIED:
        return "I don't have permission to access this data. Please check sharing settings.";
      default:
        return "Something went wrong. Here's what happened: " + error.message;
    }
  }
}