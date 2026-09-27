import './server/env_init';
import express from 'express';
import { createServer } from 'http';
import os from 'os';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import router from './server/routes';
import { setupSocketIO } from './server/socket';
import { connectDB } from './server/database';
import { seedAdmin } from './server/seed/seedAdmin';

async function startServer() {
  // Establish MongoDB connection (safely handles connection failures)
  try {
    await connectDB();
    // Run Admin seeder on MongoDB connection success, before Express starts listening
    await seedAdmin();
  } catch (dbErr) {
    console.error('SERVER INITIALIZATION: Database connection failed on startup. Server is routing traffic but DB operations may be blocked:', dbErr);
  }

  const app = express();
  
  // Configure Express to trust reverse proxy headers (handles cloud load balancers and sets req.ip correctly)
  app.set('trust proxy', 1);

  const server = createServer(app);
  const PORT = 3000;

  // 1. High-security headers using Helmet
  app.use(helmet({
    contentSecurityPolicy: false, // Ensure iframe previews work seamlessly
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
  }));

  // 2. Cookie parser for authenticating HttpOnly Cookies
  app.use(cookieParser());

  // 3. Robust CORS with credential support
  const allowedOrigin = process.env.CLIENT_URL;
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || origin === allowedOrigin || allowedOrigin === '*' || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(null, origin); // Handle dynamic sandbox environments safely
      }
    },
    credentials: true
  }));

  // 4. Rate Limiting protection mechanics
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3000, // Relaxed limit to support multiple collaborative browsers and sandboxing
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: 'Too many requests, please try again after 15 minutes.' }
  });
  // Apply only to API routes to ensure static assets and Vite scripts load unhindered
  app.use('/api', globalLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Increased to support multiple test windows and sandbox profiles
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: 'Too many authentication attempts, please try again after 15 minutes.' }
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.use('/api', router);

  // Health probe
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Hot Dev / Production Serve Middleware routing
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite development middleware integrated successfully.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`Serving static production build from: ${distPath}`);
  }

  // Socket setup
  setupSocketIO(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server launched successfully.`);
    console.log(`Running in environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Point your endpoints directly to host port: http://0.0.0.0:${PORT}`);

    // Verification links are emailed, so "localhost" is useless to a phone.
    // Surface the LAN address at boot so the link is obvious.
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        const isIPv4 = (net as any).family === 4 || (net as any).family === 'IPv4';
        if (isIPv4 && !net.internal) {
          console.log(`Phone / LAN access (same Wi-Fi): http://${net.address}:${PORT}`);
        }
      }
    }
  });
}

startServer().catch(err => {
  console.error('Failed to initiate CollabZ Server:', err);
});
