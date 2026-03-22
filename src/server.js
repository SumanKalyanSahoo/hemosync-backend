// src/server.js
require('dotenv').config();

const app    = require('./app');
const { pool } = require('./config/db');
const initDb = require('./config/initDb'); // ← ADD THIS

const PORT = parseInt(process.env.PORT || '5000');

async function startServer() {
  // Verify database connection before accepting traffic
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ PostgreSQL connected successfully');
  } catch (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  }

  // ← ADD THIS BLOCK
  try {
    await initDb();
    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Failed to initialize database:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`\n🚀 HemoSync API running on port ${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   API base URL: http://localhost:${PORT}/api\n`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await pool.end();
      console.log('PostgreSQL pool closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
  });
}

startServer();