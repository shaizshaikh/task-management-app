const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { testConnection, testConnectionAndSchema, pool } = require('./database');
const { AuditLogger } = require('./middleware/audit');
const RealtimeService = require('./services/realtimeService');
const routes = require('./routes');
const fileCleanupService = require('./utils/fileCleanup');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed origins from environment (comma-separated)
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:8080,http://frontend:3000")
  .split(",");

// Middleware - CORS setup
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Routes - Prefix with /api
app.use('/api', routes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Task Management Backend with WebSocket is running!',
    proxy: 'Ready for nginx reverse proxy',
    timestamp: new Date().toISOString()
  });
});

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});
app.set('io', io);

// Initialize RBAC-aware realtime service
const realtimeService = new RealtimeService(io);
app.set('realtimeService', realtimeService);

// Database connection monitoring
let lastDbStatus = null;

const checkDatabaseConnection = async () => {
  try {
    const [rows] = await pool.execute('SELECT 1 as test');
    return rows.length > 0;
  } catch (error) {
    console.error('Database connection check failed:', error.message);
    // Try to log system error (may fail if DB is down)
    try {
      await AuditLogger.logSystemEvent(
        'error',
        `Database connection check failed: ${error.message}`,
        'error'
      );
    } catch (auditError) {
      // Ignore audit logging errors when DB is down
    }
    return false;
  }
};

const monitorDatabaseStatus = async () => {
  try {
    const dbConnected = await checkDatabaseConnection();
    const currentStatus = dbConnected ? 'Connected' : 'Disconnected';

    if (lastDbStatus !== currentStatus) {
      console.log(`Database status changed: ${lastDbStatus} -> ${currentStatus}`);
      io.emit('healthUpdate', {
        database: currentStatus,
        timestamp: new Date().toISOString()
      });
      lastDbStatus = currentStatus;
    }
  } catch (error) {
    console.error('Database monitoring error:', error.message);
    if (lastDbStatus !== 'Disconnected') {
      io.emit('healthUpdate', {
        database: 'Disconnected',
        timestamp: new Date().toISOString(),
        error: error.message
      });
      lastDbStatus = 'Disconnected';
    }
  }
};

// Enhanced WebSocket handling with RBAC awareness
io.on('connection', (socket) => {
  console.log('New connection attempt:', socket.id);

  // Handle authentication
  socket.on('authenticate', async (data) => {
    const { token } = data;
    await realtimeService.handleConnection(socket, token);
  });

  // Send current database status when user connects
  checkDatabaseConnection().then(dbConnected => {
    socket.emit('healthUpdate', {
      database: dbConnected ? 'Connected' : 'Disconnected',
      timestamp: new Date().toISOString()
    });
    lastDbStatus = dbConnected ? 'Connected' : 'Disconnected';
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    realtimeService.handleDisconnection(socket);
  });

  // Handle connection stats request (admin only)
  socket.on('getConnectionStats', () => {
    const userInfo = realtimeService.connectedUsers.get(socket.id);
    if (userInfo && userInfo.global_role === 'admin') {
      socket.emit('connectionStats', realtimeService.getConnectionStats());
    }
  });

  // Debug: Test broadcast (remove in production)
  socket.on('testBroadcast', () => {
    const userInfo = realtimeService.connectedUsers.get(socket.id);
    if (userInfo) {
      console.log(`🧪 [DEBUG] Test broadcast from ${userInfo.username}`);
      io.emit('testMessage', {
        message: `Test from ${userInfo.username}`,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Health check route
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'Connected' : 'Disconnected',
    environment: {
      db_host: process.env.DB_HOST || 'localhost',
      db_name: process.env.DB_NAME || 'task_management',
      port: PORT
    }
  });
});

// Monitor database every 5 seconds
const dbMonitorInterval = setInterval(monitorDatabaseStatus, 5000);

// Graceful shutdown
const shutdown = () => {
  console.log('\nShutting down server...');
  clearInterval(dbMonitorInterval);
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Wait-for-DB function with schema check before starting server
const waitForDbAndSchema = async (retries = 10, delay = 3000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const schemaReady = await testConnectionAndSchema();
      if (schemaReady) {
        console.log('✅ Database connected and RBAC schema ready!');
        return true;
      }
      console.log(`Waiting for database and schema... (${i + 1})`);
      await new Promise(r => setTimeout(r, delay));
    } catch (err) {
      console.log(`Database/schema check failed (${i + 1}):`, err.message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Database connection or schema validation failed after retries');
};

// Start server only after DB and schema are ready
(async () => {
  try {
    await waitForDbAndSchema(); // ensures DB and RBAC schema are ready
    server.listen(PORT, '0.0.0.0', async () => {
      console.log(`Server with WebSocket running on port ${PORT}`);
      console.log(`Ready to receive requests from nginx proxy`);
      console.log(`Event-driven database monitoring active`);
      
      // Log server startup
      await AuditLogger.logSystemEvent(
        'startup',
        `Task Management Server started on port ${PORT}`,
        'info',
        {
          port: PORT,
          node_env: process.env.NODE_ENV || 'development',
          cors_origins: allowedOrigins
        }
      );
      console.log(`RBAC schema validated and ready`);
      
      // Start file cleanup service
      fileCleanupService.startScheduledCleanup();

      // Initialize DB status
      const dbConnected = await testConnection();
      lastDbStatus = dbConnected ? 'Connected' : 'Disconnected';
      console.log(`Initial database status: ${lastDbStatus}`);
    });
  } catch (err) {
    console.error(err.message);
    console.log('\n💡 If you see schema-related errors:');
    console.log('   1. Stop containers: docker-compose down');
    console.log('   2. Remove database volume: docker volume rm task-management-app_mysql_data');
    console.log('   3. Restart: docker-compose up -d');
    console.log('   This will trigger automatic RBAC migration on fresh database.');
    process.exit(1);
  }
})();
