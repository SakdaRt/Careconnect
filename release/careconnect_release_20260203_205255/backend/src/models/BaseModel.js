import { query } from '../utils/db.js';
import {
  buildInsert,
  buildUpdate,
  buildSelect,
  buildDelete,
  buildPaginatedSelect,
} from '../utils/query.js';

/**
 * Base Model Class
 * Provides common CRUD operations for all models
 */
class BaseModel {
  /**
   * @param {string} tableName - Database table name
   */
  constructor(tableName) {
    this.tableName = tableName;
  }

  /**
   * Find record by ID
   * @param {string} id - Record ID (UUID)
   * @returns {object|null} - Record or null
   */
  async findById(id) {
    const { text, values } = buildSelect(this.tableName, { id });
    const result = await query(text, values);
    return result.rows[0] || null;
  }

  /**
   * Find one record by conditions
   * @param {object} where - WHERE conditions
   * @returns {object|null} - Record or null
   */
  async findOne(where) {
    const { text, values } = buildSelect(this.tableName, where);
    const result = await query(text, values);
    return result.rows[0] || null;
  }

  /**
   * Find all records matching conditions
   * @param {object} where - WHERE conditions
   * @param {array} columns - Columns to select
   * @returns {array} - Array of records
   */
  async findAll(where = {}, columns = ['*']) {
    const { text, values } = buildSelect(this.tableName, where, columns);
    const result = await query(text, values);
    return result.rows;
  }

  /**
   * Find records with pagination
   * @param {object} options - Query options
   * @returns {object} - { data, total, page, limit }
   */
  async findPaginated(options = {}) {
    const {
      where = {},
      columns = ['*'],
      orderBy = 'created_at',
      order = 'DESC',
      limit = 20,
      offset = 0,
      page = 1,
    } = options;

    // Calculate offset from page if provided
    const actualOffset = page ? (page - 1) * limit : offset;

    // Get paginated results
    const { text, values } = buildPaginatedSelect(this.tableName, {
      where,
      columns,
      orderBy,
      order,
      limit,
      offset: actualOffset,
    });
    const result = await query(text, values);

    // Get total count
    const countQuery = buildSelect(this.tableName, where, ['COUNT(*) as total']);
    const countResult = await query(countQuery.text, countQuery.values);
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      data: result.rows,
      total,
      page: page || Math.floor(actualOffset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create new record
   * @param {object} data - Record data
   * @returns {object} - Created record
   */
  async create(data) {
    const { text, values } = buildInsert(this.tableName, data);
    const result = await query(text, values);
    return result.rows[0];
  }

  /**
   * Update record by ID
   * @param {string} id - Record ID
   * @param {object} data - Data to update
   * @returns {object|null} - Updated record or null
   */
  async updateById(id, data) {
    const { text, values } = buildUpdate(this.tableName, data, { id });
    const result = await query(text, values);
    return result.rows[0] || null;
  }

  /**
   * Update records matching conditions
   * @param {object} where - WHERE conditions
   * @param {object} data - Data to update
   * @returns {array} - Updated records
   */
  async updateWhere(where, data) {
    const { text, values } = buildUpdate(this.tableName, data, where);
    const result = await query(text, values);
    return result.rows;
  }

  /**
   * Delete record by ID
   * @param {string} id - Record ID
   * @returns {object|null} - Deleted record or null
   */
  async deleteById(id) {
    const { text, values } = buildDelete(this.tableName, { id });
    const result = await query(text, values);
    return result.rows[0] || null;
  }

  /**
   * Delete records matching conditions
   * @param {object} where - WHERE conditions
   * @returns {array} - Deleted records
   */
  async deleteWhere(where) {
    const { text, values } = buildDelete(this.tableName, where);
    const result = await query(text, values);
    return result.rows;
  }

  /**
   * Count records matching conditions
   * @param {object} where - WHERE conditions
   * @returns {number} - Count
   */
  async count(where = {}) {
    const { text, values } = buildSelect(this.tableName, where, ['COUNT(*) as total']);
    const result = await query(text, values);
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Check if record exists
   * @param {object} where - WHERE conditions
   * @returns {boolean} - True if exists
   */
  async exists(where) {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * Execute raw query
   * @param {string} text - SQL query
   * @param {array} values - Query parameters
   * @returns {object} - Query result
   */
  async raw(text, values = []) {
    return await query(text, values);
  }
}

export default BaseModel;
