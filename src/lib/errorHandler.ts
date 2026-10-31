import { toast } from "sonner";

// Error types for better categorization
export enum ErrorType {
  NETWORK = 'network',
  API = 'api',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  RATE_LIMIT = 'rate_limit',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  UNKNOWN = 'unknown'
}

// User-friendly error messages
const ERROR_MESSAGES = {
  [ErrorType.NETWORK]: "Connection problem. Please check your internet and try again.",
  [ErrorType.API]: "Something went wrong on our end. Please try again in a moment.",
  [ErrorType.VALIDATION]: "Please check your input and try again.",
  [ErrorType.AUTHENTICATION]: "Please sign in to continue.",
  [ErrorType.PERMISSION]: "You don't have permission to perform this action.",
  [ErrorType.RATE_LIMIT]: "Too many requests. Please wait a moment before trying again.",
  [ErrorType.SERVICE_UNAVAILABLE]: "Service is temporarily unavailable. Please try again later.",
  [ErrorType.UNKNOWN]: "This service is temporarily unavailable,prolly an error occurred. Please try again later."
};

// Specific error messages for common scenarios
const SPECIFIC_MESSAGES = {
  // Quiz generation errors
  "Failed to generate questions": "Unable to create quiz questions right now. Please try again.",
  "Failed to generate flashcards": "Unable to create flashcards right now. Please try again.",
  "Invalid response format": "Received an unexpected response. Please try again.",

  // File upload errors
  "File too large": "File is too large. Please choose a smaller file.",
  "Invalid file type": "File type not supported. Please choose a different file.",
  "Upload failed": "Failed to upload file. Please try again.",

  // AI service errors
  "AI service unavailable": "AI services are temporarily busy. Please try again in a few minutes.",
  "Content generation failed": "Unable to generate content right now. Please try again.",

  // Payment errors
  "Payment failed": "Payment could not be processed. Please check your payment details and try again.",
  "Subscription required": "This feature requires a premium subscription.",

  // Authentication errors
  "Session expired": "Your session has expired. Please sign in again.",
  "Invalid credentials": "Invalid email or password. Please try again.",

  // Database errors
  "Failed to save": "Unable to save your changes. Please try again.",
  "Failed to load": "Unable to load data. Please refresh and try again."
};

/**
 * Categorizes an error based on its properties
 */
function categorizeError(error: any): ErrorType {
  if (!error) return ErrorType.UNKNOWN;

  // Network errors
  if (error.name === 'NetworkError' || error.message?.includes('fetch')) {
    return ErrorType.NETWORK;
  }

  // Supabase/PostgREST errors
  if (error.code) {
    switch (error.code) {
      case 'PGRST301': // Row not found
      case 'PGRST116': // No rows found
        return ErrorType.VALIDATION;
      case '42501': // Insufficient privilege
        return ErrorType.PERMISSION;
      case '23505': // Unique violation
        return ErrorType.VALIDATION;
      default:
        return ErrorType.API;
    }
  }

  // HTTP status codes
  if (error.status) {
    switch (error.status) {
      case 401:
      case 403:
        return ErrorType.AUTHENTICATION;
      case 429:
        return ErrorType.RATE_LIMIT;
      case 500:
      case 502:
      case 503:
      case 504:
        return ErrorType.SERVICE_UNAVAILABLE;
      case 400:
      case 422:
        return ErrorType.VALIDATION;
      default:
        return ErrorType.API;
    }
  }

  // Error message patterns
  const message = error.message?.toLowerCase() || '';
  if (message.includes('network') || message.includes('connection')) {
    return ErrorType.NETWORK;
  }
  if (message.includes('unauthorized') || message.includes('forbidden')) {
    return ErrorType.AUTHENTICATION;
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return ErrorType.RATE_LIMIT;
  }
  if (message.includes('service unavailable') || message.includes('maintenance')) {
    return ErrorType.SERVICE_UNAVAILABLE;
  }

  return ErrorType.UNKNOWN;
}

/**
 * Gets a user-friendly error message
 */
function getUserFriendlyMessage(error: any): string {
  if (!error) return ERROR_MESSAGES[ErrorType.UNKNOWN];

  // Check for specific error messages first
  const errorMessage = error.message || error.error || '';
  if (SPECIFIC_MESSAGES[errorMessage]) {
    return SPECIFIC_MESSAGES[errorMessage];
  }

  // Check for partial matches in specific messages
  for (const [key, message] of Object.entries(SPECIFIC_MESSAGES)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return message;
    }
  }

  // Categorize and return appropriate message
  const errorType = categorizeError(error);
  return ERROR_MESSAGES[errorType];
}

/**
 * Handles errors professionally with user-friendly messages
 */
export function handleError(error: any, context?: string, showToast: boolean = true): void {
  // Log technical details for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error);
  } else {
    // In production, log minimal info for monitoring
    console.error(`Error${context ? ` in ${context}` : ''}:`, {
      message: error?.message,
      type: categorizeError(error),
      timestamp: new Date().toISOString()
    });
  }

  // Show user-friendly message
  if (showToast) {
    const userMessage = getUserFriendlyMessage(error);
    toast.error(userMessage);
  }
}

/**
 * Wraps async operations with professional error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string,
  showToast: boolean = true
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context, showToast);
    return null;
  }
}

/**
 * Creates a safe async function that handles errors internally
 */
export function createSafeAsyncFunction<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string,
  showToast: boolean = true
) {
  return async (...args: T): Promise<R | null> => {
    return withErrorHandling(() => fn(...args), context, showToast);
  };
}

/**
 * Validates common input errors before API calls
 */
export function validateInput(value: any, fieldName: string): string | null {
  if (!value) {
    return `${fieldName} is required`;
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return `${fieldName} cannot be empty`;
  }

  if (fieldName.toLowerCase().includes('email') && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
  }

  return null;
}

/**
 * Handles file upload errors specifically
 */
export function handleFileUploadError(error: any, fileName?: string): void {
  let message = "Failed to upload file";

  if (error.message?.includes('size')) {
    message = "File is too large. Please choose a smaller file.";
  } else if (error.message?.includes('type') || error.message?.includes('format')) {
    message = "File type not supported. Please choose a different file.";
  } else if (error.status === 413) {
    message = "File is too large for upload.";
  }

  toast.error(message);
}