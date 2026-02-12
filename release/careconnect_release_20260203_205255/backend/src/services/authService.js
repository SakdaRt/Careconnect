import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import { transaction } from '../utils/db.js';

/**
 * Authentication Service
 * Handles user registration, login, JWT management, and sessions
 */

const JWT_SECRET = process.env.JWT_SECRET || 'careconnect_jwt_secret_dev_only';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

const normalizePhoneNumber = (value) => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  let national = '';
  if (digits.startsWith('66')) {
    national = digits.slice(2);
  } else if (digits.startsWith('0')) {
    national = digits.slice(1);
  } else {
    return null;
  }
  if (national.length !== 9) return null;
  return `+66${national}`;
};

/**
 * Generate JWT access token
 * @param {object} user - User object
 * @returns {string} - JWT token
 */
export const generateAccessToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    phoneNumber: user.phone_number,
    role: user.role,
    accountType: user.account_type,
    trustLevel: user.trust_level,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'careconnect',
    subject: user.id,
  });
};

/**
 * Generate JWT refresh token
 * @param {object} user - User object
 * @returns {string} - Refresh token
 */
export const generateRefreshToken = (user) => {
  const payload = {
    userId: user.id,
    type: 'refresh',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'careconnect',
    subject: user.id,
  });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {object} - Decoded payload
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'careconnect',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * Hash password
 * @param {string} password - Plain text password
 * @returns {string} - Hashed password
 */
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

/**
 * Compare password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password
 * @returns {boolean} - True if match
 */
export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Register guest user (email + password)
 * @param {object} data - Registration data
 * @returns {object} - { user, accessToken, refreshToken }
 */
export const registerGuest = async (data) => {
  const { email, password, role } = data;

  // Validate input
  if (!email || !password || !role) {
    throw new Error('Email, password, and role are required');
  }

  if (!['hirer', 'caregiver'].includes(role)) {
    throw new Error('Role must be hirer or caregiver');
  }

  // Check if email already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  // Validate password strength (min 8 chars)
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Create user and wallet in transaction
  const result = await transaction(async (client) => {
    // Create user
    const hashedPassword = await hashPassword(password);
    const userQuery = await client.query(
      `INSERT INTO users (id, email, password_hash, account_type, role, trust_level, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [uuidv4(), email, hashedPassword, 'guest', role, 'L0', 'active']
    );
    const user = userQuery.rows[0];

    // Create wallet
    const walletType = role === 'hirer' ? 'hirer' : 'caregiver';
    await client.query(
      `INSERT INTO wallets (id, user_id, wallet_type, available_balance, held_balance, currency, created_at, updated_at)
       VALUES ($1, $2, $3, 0, 0, $4, NOW(), NOW())`,
      [uuidv4(), user.id, walletType, 'THB']
    );

    // Remove password hash from response
    delete user.password_hash;

    return user;
  });

  // Generate tokens
  const accessToken = generateAccessToken(result);
  const refreshToken = generateRefreshToken(result);

  return {
    user: result,
    accessToken,
    refreshToken,
  };
};

/**
 * Register member user (phone + password)
 * @param {object} data - Registration data
 * @returns {object} - { user, accessToken, refreshToken }
 */
export const registerMember = async (data) => {
  const { phone_number, password, role, email } = data;

  // Validate input
  if (!phone_number || !password || !role) {
    throw new Error('Phone number, password, and role are required');
  }

  if (!['hirer', 'caregiver'].includes(role)) {
    throw new Error('Role must be hirer or caregiver');
  }

  const normalizedPhone = normalizePhoneNumber(phone_number);
  if (!normalizedPhone) {
    throw new Error('Invalid phone format (use +66XXXXXXXXX)');
  }

  // Check if phone already exists
  const existingUser = await User.findByPhoneNumber(normalizedPhone);
  if (existingUser) {
    throw new Error('Phone number already registered');
  }

  // Validate password strength
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Create user and wallet in transaction
  const result = await transaction(async (client) => {
    // Create user
    const hashedPassword = await hashPassword(password);
    const userQuery = await client.query(
      `INSERT INTO users (id, email, phone_number, password_hash, account_type, role, trust_level, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [uuidv4(), email || null, normalizedPhone, hashedPassword, 'member', role, 'L0', 'active']
    );
    const user = userQuery.rows[0];

    // Create wallet
    const walletType = role === 'hirer' ? 'hirer' : 'caregiver';
    await client.query(
      `INSERT INTO wallets (id, user_id, wallet_type, available_balance, held_balance, currency, created_at, updated_at)
       VALUES ($1, $2, $3, 0, 0, $4, NOW(), NOW())`,
      [uuidv4(), user.id, walletType, 'THB']
    );

    // Remove password hash from response
    delete user.password_hash;

    return user;
  });

  // Generate tokens
  const accessToken = generateAccessToken(result);
  const refreshToken = generateRefreshToken(result);

  return {
    user: result,
    accessToken,
    refreshToken,
  };
};

/**
 * Login with email
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {object} - { user, accessToken, refreshToken }
 */
export const loginWithEmail = async (email, password) => {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  // Find user by email
  const user = await User.findByEmail(email);
  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Check if user is active
  if (user.status !== 'active') {
    throw new Error('Account is suspended or deleted');
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Update last login
  await User.updateById(user.id, {
    last_login_at: new Date(),
  });

  // Remove password hash
  delete user.password_hash;

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    user,
    accessToken,
    refreshToken,
  };
};

/**
 * Login with phone number
 * @param {string} phoneNumber - User phone number
 * @param {string} password - User password
 * @returns {object} - { user, accessToken, refreshToken }
 */
export const loginWithPhone = async (phoneNumber, password) => {
  if (!phoneNumber || !password) {
    throw new Error('Phone number and password are required');
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  if (!normalizedPhone) {
    throw new Error('Invalid phone number or password');
  }

  // Find user by phone
  const user = await User.findByPhoneNumber(normalizedPhone);
  if (!user) {
    throw new Error('Invalid phone number or password');
  }

  // Check if user is active
  if (user.status !== 'active') {
    throw new Error('Account is suspended or deleted');
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid phone number or password');
  }

  // Update last login
  await User.updateById(user.id, {
    last_login_at: new Date(),
  });

  // Remove password hash
  delete user.password_hash;

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    user,
    accessToken,
    refreshToken,
  };
};

/**
 * Refresh access token
 * @param {string} refreshToken - Refresh token
 * @returns {object} - { accessToken, refreshToken }
 */
export const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new Error('Refresh token is required');
  }

  // Verify refresh token
  let decoded;
  try {
    decoded = verifyToken(refreshToken);
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }

  // Check if it's a refresh token
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  // Get user
  const user = await User.findById(decoded.userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.status !== 'active') {
    throw new Error('Account is suspended or deleted');
  }

  // Remove password hash
  delete user.password_hash;

  // Generate new tokens
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

/**
 * Get user by token
 * @param {string} token - JWT access token
 * @returns {object} - User object
 */
export const getUserByToken = async (token) => {
  if (!token) {
    throw new Error('Token is required');
  }

  // Verify token
  const decoded = verifyToken(token);

  // Get user
  const user = await User.findById(decoded.userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.status !== 'active') {
    throw new Error('Account is suspended or deleted');
  }

  // Remove password hash
  delete user.password_hash;

  return user;
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword,
  registerGuest,
  registerMember,
  loginWithEmail,
  loginWithPhone,
  refreshAccessToken,
  getUserByToken,
};
