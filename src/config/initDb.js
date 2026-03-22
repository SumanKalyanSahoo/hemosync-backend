// src/config/initDb.js
// Run once: node src/config/initDb.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDb() {
  // Connect to postgres (default) db first to create hemosync db if needed
  const adminPool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: 'postgres',
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    // Create database if it doesn't exist
    const { rows } = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [process.env.DB_NAME]
    );

    if (rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
      console.log(`✅ Database "${process.env.DB_NAME}" created.`);
    } else {
      console.log(`ℹ️  Database "${process.env.DB_NAME}" already exists.`);
    }
  } finally {
    await adminPool.end();
  }

  // Now connect to the hemosync database and run schema
  const appPool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    const schemaPath = path.join(__dirname, '../../sql/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await appPool.query(schema);
    console.log('✅ Schema applied successfully.');
    console.log('✅ Seed data inserted.');
    console.log('\nDemo accounts:');
    console.log('  Hospital  → admin@hospital.com  / password123');
    console.log('  Donor     → donor@gmail.com     / password123');
    console.log('  Individual→ user@gmail.com      / password123');
  } catch (err) {
    console.error('❌ Error applying schema:', err.message);
  } finally {
    await appPool.end();
  }
}

// ✅ Export the function AND keep direct call when run standalone
if (require.main === module) {
  initDb().catch(console.error);
}

module.exports = initDb;
