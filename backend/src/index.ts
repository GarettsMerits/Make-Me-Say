/**
 * Express.js backend server for the "Don't Make Me Say" game.
 * Handles authentication, rate limiting, security middleware, and provides
 * API endpoints for chat, leaderboard, and target word functionality.
 */
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { initializeDatabase, checkDatabaseHealth } from './db/init.js';
import { cleanup as cleanupLLM } from './services/llm.js';
import targetWordRouter from './routes/targetWord.js';
import chatRouter from './routes/chat.js';
import leaderboardRouter from './routes/leaderboard.js';

dotenv.config();

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ?? '';
if (!DEEPSEEK_KEY || DEEPSEEK_KEY.startsWith('sk-your_')) {
  console.error(
    '\n[startup] DEEPSEEK_API_KEY is missing or still a placeholder.\n' +
    '  Set it in backend/.env (dev) or your hosting platform env vars (prod).\n'
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
const shouldLogPassphrase = (process.env.LOG_PASSPHRASE ?? 'true').toLowerCase() === 'true';

/**
 * Compute the expected passphrase for the current calendar month.
 * Centralised here so the auth gate and the verify endpoint always agree.
 */
function computeExpectedPassphrase(): string {
  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  return `Adam${month}${now.getFullYear()}`;
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting for DDoS protection
const rateLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60,
});

app.use(express.json());

// Rate limiting middleware
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rateLimiter.consume(req.ip || 'unknown');
    next();
  } catch (rejRes) {
    res.status(429).json({ error: 'Too many requests' });
  }
});

// Auth gate middleware
const authGate = (req: Request, res: Response, next: NextFunction) => {
  const passphrase = req.headers['x-passphrase'] as string;
  if (passphrase === computeExpectedPassphrase()) {
    next();
  } else {
    res.status(401).json({ error: 'Invalid passphrase' });
  }
};

// Apply auth gate to all routes except health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth gate endpoint
app.post('/api/auth/verify', (req: Request, res: Response) => {
  const { passphrase } = req.body;
  if (passphrase === computeExpectedPassphrase()) {
    res.json({ success: true, message: 'Access granted' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid passphrase' });
  }
});

// Protected routes (all other API endpoints will use authGate)
app.use('/api', authGate);

// Mount route modules
app.use('/api/target-word', targetWordRouter);
app.use('/api/chat', chatRouter);
app.use('/api/leaderboard', leaderboardRouter);

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database tables
    await initializeDatabase();
    
    // Check database health
    await checkDatabaseHealth();
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      if (shouldLogPassphrase) {
        console.log(`[debug] Current passphrase: ${computeExpectedPassphrase()}`);
      }
      console.log('🚀 API endpoints ready:');
      console.log(`   POST /api/auth/verify - Verify passphrase`);
      console.log(`   GET  /api/target-word - Get random target word`);
      console.log(`   POST /api/chat - Send chat message to LLM`);
      console.log(`   GET  /api/leaderboard - Get top scores`);
      console.log(`   POST /api/leaderboard - Submit winning score`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  cleanupLLM();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  cleanupLLM();
  process.exit(0);
});

// Start the server
startServer();