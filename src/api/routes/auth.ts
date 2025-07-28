/**
 * Authentication API Routes
 * User authentication, registration, and session management
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { 
  ApiResponse, 
  User, 
  AuthenticatedRequest 
} from '../../types/api.types';
import { generateToken, optionalAuth } from '../middleware/auth';
import { logger, authLogger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, asyncAuthHandler } from '../utils/asyncHandler';

const router = Router();

// Auth-specific rate limiting
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// More restrictive rate limiting for sensitive operations
const sensitiveAuthRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    error: 'Too many sensitive requests, please try again later.',
    code: 'SENSITIVE_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false)
});

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
  role: z.enum(['user', 'readonly']).default('user')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmNewPassword: z.string().min(1, 'New password confirmation is required')
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match",
  path: ["confirmNewPassword"],
});

// Mock user database (replace with actual database in production)
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
  }
];

// Mock password storage (in production, use proper database)
const mockPasswords: Record<string, string> = {
  'admin': '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
  'user': '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'   // password: password
};

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User authentication
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               rememberMe:
 *                 type: boolean
 *                 default: false
 *             required:
 *               - username
 *               - password
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/login',
  authRateLimit,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    try {
      const validationResult = loginSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid login data',
          details: validationResult.error.format(),
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      const { username, password, rememberMe } = validationResult.data;

      // Find user
      const user = mockUsers.find(u => u.username === username);
      if (!user) {
        authLogger.warn('Login attempt with invalid username', {
          username,
          requestId,
          ip: req.ip
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: 'Username or password is incorrect',
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      // Verify password
      const hashedPassword = mockPasswords[username];
      const isPasswordValid = await bcrypt.compare(password, hashedPassword);
      
      if (!isPasswordValid) {
        authLogger.warn('Login attempt with invalid password', {
          username,
          userId: user.id,
          requestId,
          ip: req.ip
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: 'Username or password is incorrect',
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      // Update last login
      user.lastLogin = new Date();

      // Generate JWT token
      const token = generateToken(user);

      authLogger.info('User logged in successfully', {
        userId: user.id,
        username: user.username,
        rememberMe,
        requestId,
        ip: req.ip
      });

      const response: ApiResponse = {
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            permissions: user.permissions,
            lastLogin: user.lastLogin
          },
          expiresIn: rememberMe ? '30d' : '24h'
        },
        message: 'Login successful',
        timestamp: new Date().toISOString(),
        requestId,
      };

      return res.json(response);

    } catch (error) {
      authLogger.error('Login failed', {
        requestId,
        error: (error as Error).message,
        stack: (error as Error).stack
      });

      return res.status(500).json({
        success: false,
        error: 'Login failed',
        message: 'An internal error occurred during login',
        timestamp: new Date().toISOString(),
        requestId,
      } as ApiResponse);
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: User registration
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [user, readonly]
 *                 default: user
 *             required:
 *               - username
 *               - email
 *               - password
 *               - confirmPassword
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: Invalid registration data
 *       409:
 *         description: User already exists
 */
router.post('/register',
  authRateLimit,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    try {
      const validationResult = registerSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid registration data',
          details: validationResult.error.format(),
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      const { username, email, password, role } = validationResult.data;

      // Check if user already exists
      const existingUser = mockUsers.find(u => u.username === username || u.email === email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User already exists',
          message: 'Username or email is already registered',
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      const newUser: User = {
        id: uuidv4(),
        username,
        email,
        role,
        permissions: role === 'user' ? ['query:read', 'ingest:write'] : ['query:read'],
        createdAt: new Date(),
        lastLogin: new Date()
      };

      // Store user and password (in production, use proper database)
      mockUsers.push(newUser);
      mockPasswords[username] = hashedPassword;

      // Generate JWT token
      const token = generateToken(newUser);

      authLogger.info('New user registered', {
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        requestId
      });

      return res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            permissions: newUser.permissions,
            createdAt: newUser.createdAt
          }
        },
        message: 'Registration successful',
        timestamp: new Date().toISOString(),
        requestId,
      } as ApiResponse);

    } catch (error) {
      authLogger.error('Registration failed', {
        requestId,
        error: (error as Error).message
      });

      return res.status(500).json({
        success: false,
        error: 'Registration failed',
        message: 'An internal error occurred during registration',
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/profile',
  optionalAuth,
  asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please log in to access your profile',
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        permissions: req.user.permissions,
        createdAt: req.user.createdAt,
        lastLogin: req.user.lastLogin
      },
      timestamp: new Date().toISOString(),
      requestId
    } as ApiResponse);
  }));
);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *               confirmNewPassword:
 *                 type: string
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmNewPassword
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid password data
 *       401:
 *         description: Current password is incorrect
 */
router.post('/change-password',
  authRateLimit,
  optionalAuth,
  asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    }

    try {
      const validationResult = changePasswordSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid password data',
          details: validationResult.error.format(),
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      const { currentPassword, newPassword } = validationResult.data;

      // Verify current password
      const hashedPassword = mockPasswords[req.user.username];
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, hashedPassword);

      if (!isCurrentPasswordValid) {
        authLogger.warn('Password change attempt with invalid current password', {
          userId: req.user.id,
          requestId
        });

        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect',
          timestamp: new Date().toISOString(),
          requestId
        } as ApiResponse);
      }

      // Hash new password
      const newHashedPassword = await bcrypt.hash(newPassword, 10);
      mockPasswords[req.user.username] = newHashedPassword;

      authLogger.info('Password changed successfully', {
        userId: req.user.id,
        requestId
      });

      return res.json({
        success: true,
        message: 'Password changed successfully',
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to change password',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    }
  }));
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout',
  optionalAuth,
  asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    if (req.user) {
      authLogger.info('User logged out', {
        userId: req.user.id,
        username: req.user.username,
        requestId
      });
    }

    // TODO: In production, implement token blacklisting/invalidation
    
    return res.json({
      success: true,
      message: 'Logout successful',
      timestamp: new Date().toISOString(),
      requestId
    } as ApiResponse);
  }));
);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh authentication token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired token
 */
router.post('/refresh',
  optionalAuth,
  asyncAuthHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Valid token required for refresh',
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    }

    try {
      // Generate new token
      const newToken = generateToken(req.user);

      authLogger.info('Token refreshed', {
        userId: req.user.id,
        requestId
      });

      return res.json({
        success: true,
        data: {
          token: newToken,
          expiresIn: '24h'
        },
        message: 'Token refreshed successfully',
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to refresh token',
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        requestId
      } as ApiResponse);
    }
  }));
);

export default router;