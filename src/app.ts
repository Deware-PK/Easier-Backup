import express from 'express';
import http from 'http';
import 'dotenv/config';
import cors from 'cors';
import helmet from 'helmet';

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
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(helmet());
app.use(cors({ origin: allowedOrigins })); // app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '64kb' }));

// Trust proxy for rate limiting behind proxies
app.set('trust proxy', 1);

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

server.listen(port, () => {
    console.log(`Server has been started! (HTTP & WebSocket)`)
    startSyncedScheduler();
});