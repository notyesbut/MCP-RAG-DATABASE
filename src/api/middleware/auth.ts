// Authentication and Authorization Middleware for Enterprise Multi-MCP Smart Database API
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, AuthTokenPayload, User } from '../../types/api.types';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { config } from '../config/config';
import { authLogger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock user database (replace with actual database in production)
 */
const mockUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    permissions: ['*'],
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date()
  },
  {
    id: '2',
    username: 'user',
    email: 'user@example.com',
    role: 'user',
    permissions: ['query:read', 'ingest:write'],
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date()
  },
  {
    id: '3',
    username: 'readonly',
    email: 'readonly@example.com',
    role: 'readonly',
    permissions: ['query:read'],
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date()
  }
];

/**
 * Find user by ID (replace with actual database query)
 */
const findUserById = async (userId: string): Promise<User | null> => {
  return mockUsers.find(user => user.id === userId) || null;
};

/**
 * JWT Authentication Middleware
 * Validates JWT token and attaches user to request
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No valid authorization token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify JWT token
    const decoded = jwt.verify(token, config.auth.jwtSecret) as AuthTokenPayload;
    
    // Find user in database
    const user = await findUserById(decoded.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Update last login
    user.lastLogin = new Date();
    
    // Attach user and token to request
    req.user = user;
    req.token = token;

    authLogger.info('User authenticated', {
      userId: user.id,
      username: user.username,
      role: user.role,
      requestId,
      method: req.method,
      url: req.originalUrl
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid authentication token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Authentication token has expired');
    }
    throw error;
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has required role
 */
export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      authLogger.warn('Authorization failed - insufficient role', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        method: req.method,
        url: req.originalUrl
      });
      
      throw new AuthorizationError(`Access denied. Required role: ${allowedRoles.join(' or ')}`);
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 * Checks if user has required permissions
 */
export const requirePermission = (permissions: string | string[]) => {
  const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    // Admin users with '*' permission have access to everything
    if (req.user.permissions.includes('*')) {
      return next();
    }

    // Check if user has all required permissions
    const hasPermission = requiredPermissions.every(permission => 
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      authLogger.warn('Authorization failed - insufficient permissions', {
        userId: req.user.id,
        userPermissions: req.user.permissions,
        requiredPermissions,
        method: req.method,
        url: req.originalUrl
      });
      
      throw new AuthorizationError(`Access denied. Required permissions: ${requiredPermissions.join(', ')}`);
    }

    next();
  };
};

/**
 * Admin-only middleware
 * Convenience middleware for admin-only endpoints
 */
export const requireAdmin = requireRole('admin');

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await authMiddleware(req, res, () => {});
  } catch (error) {
    // Silently continue without authentication
    authLogger.debug('Optional authentication failed', {
      error: (error as Error).message,
      method: req.method,
      url: req.originalUrl
    });
  }
  next();
};

/**
 * Rate limiting bypass for authenticated users
 * Provides higher rate limits for authenticated users
 */
export const authRateLimitSkip = (req: AuthenticatedRequest): boolean => {
  // Skip rate limiting for admin users
  if (req.user?.role === 'admin') {
    return true;
  }
  
  // Higher limits for authenticated users
  return false;
};

/**
 * Generate JWT token for user
 */
export const generateToken = (user: User): string => {
  const payload: AuthTokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000)
  };

  // Ensure expiresIn is correctly typed
  const signOptions = {
    expiresIn: config.auth.jwtExpiration,
    algorithm: 'HS256' as const
  };

  return jwt.sign(payload, config.auth.jwtSecret, signOptions as jwt.SignOptions);
};

/**
 * Validate token without attaching to request
 * Useful for WebSocket authentication
 */
export const validateToken = async (token: string): Promise<User | null> => {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as AuthTokenPayload;
    return await findUserById(decoded.userId);
  } catch (error) {
    authLogger.debug('Token validation failed', { error: (error as Error).message });
    return null;
  }
};

/**
 * Middleware to add request ID to all requests
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

/**
 * CORS preflight handler for authenticated routes
 */
export const corsPreflightHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Request-ID');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(200).end();
    return;
  }
  next();
};

export default authMiddleware;