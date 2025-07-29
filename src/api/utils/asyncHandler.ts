/**
 * Async Handler Utility
 * Wraps async route handlers to properly handle errors
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types/api.types';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

type AsyncAuthRequestHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<any>;

/**
 * Wraps an async request handler to catch errors and pass them to Express error handling
 */
export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Wraps an async authenticated request handler to catch errors and pass them to Express error handling
 */
export const asyncAuthHandler = (fn: AsyncAuthRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthenticatedRequest, res, next)).catch(next);
  };
};