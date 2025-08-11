import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export interface ApiError extends Error {
  statusCode?: number
  code?: string
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  logger.error('Error handled:', {
    error: message,
    statusCode,
    code: err.code,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  })

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: err.code,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  })
}

export const createError = (message: string, statusCode: number = 500, code?: string): ApiError => {
  const error = new Error(message) as ApiError
  error.statusCode = statusCode
  error.code = code
  return error
}