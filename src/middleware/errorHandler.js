/**
 * Error Handler Middleware
 * Provides consistent error responses without exposing sensitive information
 */

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
  } else if (err.code === 'RATE_LIMIT_EXCEEDED') {
    statusCode = 429;
  }
  
  const response = {
    error: message,
    code: code,
    timestamp: new Date().toISOString(),
  };
  
  // Only include stack trace in development
  if (isDevelopment && err.stack) {
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
};

module.exports = { errorHandler };