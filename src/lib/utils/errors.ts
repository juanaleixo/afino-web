/**
 * Enhanced error handling utilities for Afino Finance
 * Provides consistent error handling across the application
 */

// Custom error types
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTH_REQUIRED', 401)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'PERMISSION_DENIED', 403)
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests', 'RATE_LIMITED', 429, { retryAfter })
    this.name = 'RateLimitError'
  }
}

// Error codes enum
export enum ErrorCode {
  // Authentication & Authorization
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Resource
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // Rate Limiting
  RATE_LIMITED = 'RATE_LIMITED',
  
  // System
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  
  // Business Logic
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_TRANSACTION = 'INVALID_TRANSACTION',
  PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED',
}

// Error response format
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: unknown
    timestamp: string
    requestId?: string
  }
}

// Create standardized error response
export function createErrorResponse(
  error: AppError | Error,
  requestId?: string
): ErrorResponse {
  const isAppError = error instanceof AppError
  
  return {
    error: {
      code: isAppError ? error.code : ErrorCode.INTERNAL_ERROR,
      message: error.message,
      details: isAppError ? error.details : undefined,
      timestamp: new Date().toISOString(),
      requestId,
    }
  }
}

// Error handler for API routes
export function handleApiError(error: unknown): Response {
  console.error('API Error:', error)
  
  if (error instanceof AppError) {
    return Response.json(
      createErrorResponse(error),
      { status: error.statusCode }
    )
  }
  
  if (error instanceof Error) {
    // Handle Supabase errors
    if (error.message.includes('JWT')) {
      const authError = new AuthenticationError('Invalid or expired token')
      return Response.json(
        createErrorResponse(authError),
        { status: 401 }
      )
    }
    
    if (error.message.includes('Row level security')) {
      const authzError = new AuthorizationError()
      return Response.json(
        createErrorResponse(authzError),
        { status: 403 }
      )
    }
  }
  
  // Generic error
  const genericError = new AppError(
    'An unexpected error occurred',
    ErrorCode.INTERNAL_ERROR,
    500
  )
  
  return Response.json(
    createErrorResponse(genericError),
    { status: 500 }
  )
}

// Safe error logger
export function logError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error instanceof AppError && {
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
      })
    } : error,
  }
  
  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to Sentry or similar
    console.error(JSON.stringify(errorInfo))
  } else {
    console.error('Error logged:', errorInfo)
  }
}

// Async error wrapper for route handlers
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error)
    }
  }) as T
}

// React error boundary fallback
export function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error
  resetErrorBoundary: () => void
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center">
        <h2 className="mb-2 text-lg font-semibold text-destructive">
          Oops! Algo deu errado
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {error.message || 'Ocorreu um erro inesperado'}
        </p>
        <button
          onClick={resetErrorBoundary}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}

// Type guard for AppError
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

// Extract error message safely
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unknown error occurred'
}

// Create user-friendly error messages
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    return 'Por favor, verifique os dados informados'
  }
  if (error instanceof AuthenticationError) {
    return 'Você precisa fazer login para continuar'
  }
  if (error instanceof AuthorizationError) {
    return 'Você não tem permissão para realizar esta ação'
  }
  if (error instanceof NotFoundError) {
    return 'O item solicitado não foi encontrado'
  }
  if (error instanceof RateLimitError) {
    return 'Muitas tentativas. Por favor, aguarde um momento'
  }
  
  return 'Ocorreu um erro. Por favor, tente novamente'
}