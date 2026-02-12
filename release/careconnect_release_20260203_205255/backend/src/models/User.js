import BaseModel from './BaseModel.js';
import { query } from '../utils/db.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

/**
 * User Model
 * Handles user CRUD operations and authentication
 */
class User extends BaseModel {
  constructor() {
    super('users');
  }

  /**
   * Create new user with hashed password
   * @param {object} userData - User data
   * @returns {object} - Created user (without password)
   */
  async createUser(userData) {
    const {
      email,
      phone_number,
      password_hash,
      role,
      account_type,
    } = userData;

    // Hash password if provided
    let hashedPassword = password_hash;
    if (password_hash && !password_hash.startsWith('$2b$')) {
      hashedPassword = await bcrypt.hash(password_hash, 10);
    }

    // Validate account_type and required fields
    const accountType = account_type || (email && !phone_number ? 'guest' : 'member');

    if (accountType === 'guest' && !email) {
      throw new Error('Guest account requires email');
    }
    if (accountType === 'member' && !phone_number) {
      throw new Error('Member account requires phone number');
    }

    const newUser = await this.create({
      id: uuidv4(),
      email: email || null,
      phone_number: phone_number || null,
      password_hash: hashedPassword,
      account_type: accountType,
      role,
      trust_level: 'L0', // Default trust level
      status: 'active',
      is_email_verified: false,
      is_phone_verified: false,
      two_factor_enabled: false,
      trust_score: 0,
      completed_jobs_count: 0,
      first_job_waiver_used: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Don't return password hash
    delete newUser.password_hash;
    return newUser;
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {object|null} - User or null
   */
  async findByEmail(email) {
    return await this.findOne({ email });
  }

  /**
   * Find user by phone number
   * @param {string} phoneNumber - User phone number
   * @returns {object|null} - User or null
   */
  async findByPhoneNumber(phoneNumber) {
    return await this.findOne({ phone_number: phoneNumber });
  }

  /**
   * Verify user password
   * @param {string} userId - User ID
   * @param {string} password - Plain text password
   * @returns {boolean} - True if password matches
   */
  async verifyPassword(userId, password) {
    const user = await this.findById(userId);
    if (!user || !user.password_hash) {
      return false;
    }
    return await bcrypt.compare(password, user.password_hash);
  }

  /**
   * Update user password
   * @param {string} userId - User ID
   * @param {string} newPassword - New plain text password
   * @returns {boolean} - True if updated
   */
  async updatePassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updated = await this.updateById(userId, {
      password_hash: hashedPassword,
      updated_at: new Date(),
    });
    return !!updated;
  }

  /**
   * Verify user email
   * @param {string} userId - User ID
   * @returns {object} - Updated user
   */
  async verifyEmail(userId) {
    return await this.updateById(userId, {
      is_email_verified: true,
      email_verified_at: new Date(),
      updated_at: new Date(),
    });
  }

  /**
   * Verify user phone
   * @param {string} userId - User ID
   * @returns {object} - Updated user
   */
  async verifyPhone(userId) {
    return await this.updateById(userId, {
      is_phone_verified: true,
      phone_verified_at: new Date(),
      updated_at: new Date(),
    });
  }

  /**
   * Update user trust level
   * @param {string} userId - User ID
   * @param {string} trustLevel - New trust level (L0, L1, L2, L3)
   * @returns {object} - Updated user
   */
  async updateTrustLevel(userId, trustLevel) {
    return await this.updateById(userId, {
      trust_level: trustLevel,
      updated_at: new Date(),
    });
  }

  /**
   * Suspend user
   * @param {string} userId - User ID
   * @param {string} reason - Suspension reason
   * @returns {object} - Updated user
   */
  async suspendUser(userId, _reason) {
    return await this.updateById(userId, {
      status: 'suspended',
      updated_at: new Date(),
    });
  }

  /**
   * Reactivate user
   * @param {string} userId - User ID
   * @returns {object} - Updated user
   */
  async reactivateUser(userId) {
    return await this.updateById(userId, {
      status: 'active',
      updated_at: new Date(),
    });
  }

  /**
   * Soft delete user
   * @param {string} userId - User ID
   * @returns {object} - Updated user
   */
  async softDeleteUser(userId) {
    return await this.updateById(userId, {
      status: 'deleted',
      deleted_at: new Date(),
      updated_at: new Date(),
    });
  }

  /**
   * Get user with profile (hirer or caregiver)
   * @param {string} userId - User ID
   * @returns {object|null} - User with profile
   */
  async getUserWithProfile(userId) {
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }

    // Remove password hash
    delete user.password_hash;

    // Fetch profile based on role
    if (user.role === 'hirer') {
      const profileQuery = await query(
        'SELECT * FROM hirer_profiles WHERE user_id = $1',
        [userId]
      );
      user.profile = profileQuery.rows[0] || null;
    } else if (user.role === 'caregiver') {
      const profileQuery = await query(
        'SELECT * FROM caregiver_profiles WHERE user_id = $1',
        [userId]
      );
      user.profile = profileQuery.rows[0] || null;
    }

    return user;
  }

  /**
   * Get users by role
   * @param {string} role - User role (hirer, caregiver, admin)
   * @param {object} options - Pagination options
   * @returns {object} - Paginated users
   */
  async getUsersByRole(role, options = {}) {
    return await this.findPaginated({
      ...options,
      where: { role, status: 'active' },
    });
  }

  /**
   * Search users by display name or email
   * @param {string} searchTerm - Search term
   * @param {object} options - Pagination options
   * @returns {array} - Matching users
   */
  async searchUsers(searchTerm, options = {}) {
    const { limit = 20, offset = 0 } = options;

    const result = await query(
      `SELECT * FROM users
       WHERE (display_name ILIKE $1 OR email ILIKE $1)
       AND status = 'active'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${searchTerm}%`, limit, offset]
    );

    // Remove password hashes
    result.rows.forEach((user) => delete user.password_hash);

    return result.rows;
  }

  /**
   * Get user statistics
   * @returns {object} - User stats
   */
  async getUserStats() {
    const result = await query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE role = 'hirer') as total_hirers,
        COUNT(*) FILTER (WHERE role = 'caregiver') as total_caregivers,
        COUNT(*) FILTER (WHERE status = 'active') as active_users,
        COUNT(*) FILTER (WHERE is_email_verified = true) as verified_emails,
        COUNT(*) FILTER (WHERE is_phone_verified = true) as verified_phones,
        COUNT(*) FILTER (WHERE trust_level = 'L0') as level_L0,
        COUNT(*) FILTER (WHERE trust_level = 'L1') as level_L1,
        COUNT(*) FILTER (WHERE trust_level = 'L2') as level_L2,
        COUNT(*) FILTER (WHERE trust_level = 'L3') as level_L3
      FROM users
    `);

    return result.rows[0];
  }
}

export default new User();
