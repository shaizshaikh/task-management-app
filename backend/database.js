const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 20, // Increased from 10 for better concurrency
  queueLimit: 0,
  connectTimeout: 30000, // 30 seconds
  acquireTimeout: 30000, // 30 seconds
  timeout: 60000, // 60 seconds for query execution
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connected successfully!');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

// Verify RBAC schema is ready (migration runs automatically via docker-compose)
async function verifyRBACSchema() {
  try {
    // Check if RBAC tables exist
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('teams', 'team_members', 'task_attachments')
    `, [process.env.DB_NAME]);

    const hasRBACTables = tables.length === 3;
    
    if (hasRBACTables) {
      console.log('RBAC schema verified and ready');
      return true;
    } else {
      console.log('⏳ RBAC schema not ready yet, waiting for automatic migration...');
      return false;
    }
  } catch (error) {
    console.error('RBAC schema verification failed:', error);
    return false;
  }
}

// Enhanced connection test with schema verification
async function testConnectionAndSchema() {
  const connected = await testConnection();
  if (!connected) return false;
  
  const schemaReady = await verifyRBACSchema();
  return schemaReady;
}

module.exports = { 
  pool, 
  testConnection, 
  verifyRBACSchema,
  testConnectionAndSchema 
};