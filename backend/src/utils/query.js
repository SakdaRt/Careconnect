/**
 * Query Builder Utilities
 * Helper functions for building SQL queries safely
 */

/**
 * Build INSERT query with RETURNING clause
 * @param {string} table - Table name
 * @param {object} data - Data to insert
 * @returns {object} - { text, values }
 */
export const buildInsert = (table, data) => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.join(', ');

  return {
    text: `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`,
    values,
  };
};

/**
 * Build UPDATE query
 * @param {string} table - Table name
 * @param {object} data - Data to update
 * @param {object} where - WHERE conditions
 * @returns {object} - { text, values }
 */
export const buildUpdate = (table, data, where) => {
  const dataKeys = Object.keys(data);
  const dataValues = Object.values(data);
  const whereKeys = Object.keys(where);
  const whereValues = Object.values(where);

  const setClause = dataKeys
    .map((key, i) => `${key} = $${i + 1}`)
    .join(', ');

  const whereClause = whereKeys
    .map((key, i) => `${key} = $${dataKeys.length + i + 1}`)
    .join(' AND ');

  return {
    text: `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`,
    values: [...dataValues, ...whereValues],
  };
};

/**
 * Build SELECT query with WHERE conditions
 * @param {string} table - Table name
 * @param {object} where - WHERE conditions
 * @param {array} columns - Columns to select (default: *)
 * @returns {object} - { text, values }
 */
export const buildSelect = (table, where = {}, columns = ['*']) => {
  const whereKeys = Object.keys(where);
  const whereValues = Object.values(where);
  const columnList = columns.join(', ');

  if (whereKeys.length === 0) {
    return {
      text: `SELECT ${columnList} FROM ${table}`,
      values: [],
    };
  }

  const whereClause = whereKeys
    .map((key, i) => `${key} = $${i + 1}`)
    .join(' AND ');

  return {
    text: `SELECT ${columnList} FROM ${table} WHERE ${whereClause}`,
    values: whereValues,
  };
};

/**
 * Build DELETE query
 * @param {string} table - Table name
 * @param {object} where - WHERE conditions
 * @returns {object} - { text, values }
 */
export const buildDelete = (table, where) => {
  const whereKeys = Object.keys(where);
  const whereValues = Object.values(where);

  const whereClause = whereKeys
    .map((key, i) => `${key} = $${i + 1}`)
    .join(' AND ');

  return {
    text: `DELETE FROM ${table} WHERE ${whereClause} RETURNING *`,
    values: whereValues,
  };
};

/**
 * Build paginated SELECT query
 * @param {string} table - Table name
 * @param {object} options - Query options
 * @returns {object} - { text, values }
 */
export const buildPaginatedSelect = (table, options = {}) => {
  const {
    where = {},
    columns = ['*'],
    orderBy = 'created_at',
    order = 'DESC',
    limit = 20,
    offset = 0,
  } = options;

  const whereKeys = Object.keys(where);
  const whereValues = Object.values(where);
  const columnList = columns.join(', ');

  let query = `SELECT ${columnList} FROM ${table}`;
  const values = [...whereValues];

  if (whereKeys.length > 0) {
    const whereClause = whereKeys
      .map((key, i) => `${key} = $${i + 1}`)
      .join(' AND ');
    query += ` WHERE ${whereClause}`;
  }

  query += ` ORDER BY ${orderBy} ${order}`;
  query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);

  return { text: query, values };
};

/**
 * Escape identifier (table name, column name) to prevent SQL injection
 * @param {string} identifier - Table or column name
 * @returns {string} - Escaped identifier
 */
export const escapeIdentifier = (identifier) => {
  return `"${identifier.replace(/"/g, '""')}"`;
};

/**
 * Build WHERE clause from filters
 * @param {object} filters - Filter conditions
 * @param {number} startIndex - Starting parameter index
 * @returns {object} - { clause, values }
 */
export const buildWhereClause = (filters, startIndex = 1) => {
  const keys = Object.keys(filters);
  if (keys.length === 0) {
    return { clause: '', values: [] };
  }

  const values = Object.values(filters);
  const conditions = keys.map((key, i) => {
    const value = values[i];
    if (value === null) {
      return `${key} IS NULL`;
    }
    if (Array.isArray(value)) {
      const placeholders = value
        .map((_, j) => `$${startIndex + i + j}`)
        .join(', ');
      return `${key} IN (${placeholders})`;
    }
    return `${key} = $${startIndex + i}`;
  });

  const clause = conditions.join(' AND ');
  return { clause, values };
};
