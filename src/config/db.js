// src/config/db.js
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'hemosync',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  // Connection pool settings
  max:                20,   // max connections in pool
  idleTimeoutMillis:  30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }   // required by Railway / Render / Heroku
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error:', err);
});

// Convenience helper: run a single parameterised query
const query = (text, params) => pool.query(text, params);

// Convenience helper: get a client for transactions
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
