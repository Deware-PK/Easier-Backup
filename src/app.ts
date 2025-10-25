import 'dotenv/config';
import express from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';

// Import services
import { initializeWebSocket } from './services/websocket.service.js';
import { initializeScheduler } from './services/scheduler.service.js';

// Import Routes
import apiRouter from './api/routes/index.js';
import { generalApiLimiter } from './middlewares/rateLimit.middleware.js';

// Properties
const port = process.env.PORT || 3001;
const app = express();
const apiVersion = '/api/v1';

// Setup
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000'];
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 15552000, includeSubDomains: true, preload: true }
    : undefined
}));
app.use(cors({ origin: (origin, cb) => {
  if (!origin) return cb(null, true);
  return allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS'));
}, credentials: true }));

app.use(express.json({ limit: process.env.BODY_LIMIT || '64kb' }));

// Trust proxy for rate limiting behind proxies
app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

// Enforce HTTPS when in production (behind proxy)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
    const host = req.headers.host || '';
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });
}

// HTTP Server
const server = http.createServer(app);
initializeWebSocket(server);

// -- Start schuduling with synced time -- 
function startSyncedScheduler() {
    const now = new Date();
    const seconds = now.getSeconds();

    if (seconds === 0) {
        console.log('Server synced to the minute. Initializing scheduler now.');
        initializeScheduler();
    } else {
        const secondsToWait = 60 - seconds;
        const delayInMs = secondsToWait * 1000;
        
        console.log(`Waiting ${secondsToWait} seconds to sync scheduler to the top of the minute...`);
        
        setTimeout(() => {
            console.log('Server synced! Initializing scheduler at the top of the minute.');
            initializeScheduler();
        }, delayInMs);
    }
}

// Limiter
app.use(apiVersion, (req, res, next) => {

    if (req.method === 'GET')
        return next();
    
    generalApiLimiter(req, res, next);
});

// API Router
app.use(apiVersion, apiRouter);

server.listen(Number(port), '127.0.0.1', () => {
    console.log(`Server has been started! (HTTP & WebSocket)`)
    startSyncedScheduler();
});