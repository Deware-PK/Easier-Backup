import express from 'express';
import http from 'http';
import 'dotenv/config';
import cors from 'cors';

// Import services
import { initializeWebSocket } from './services/websocket.service.js';
import { initializeScheduler } from './services/scheduler.service.js';

// Import Routes
import apiRouter from './api/routes/index.js';

// Properties
const port = process.env.PORT || 3001;
const app = express();
const apiVersion = '/api/v1';

// Setup
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

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

// API Router
app.use(apiVersion, apiRouter);

server.listen(port, () => {
    console.log(`Server has been started! (HTTP & WebSocket)`)
    startSyncedScheduler();
});