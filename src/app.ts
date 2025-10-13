import express from 'express';
import http from 'http';
import 'dotenv/config';

// Import services
import { initializeWebSocket } from './services/websocket.service.js';
import { initializeScheduler } from './services/scheduler.service.js';

// Import Routes
import apiRouter from './api/routes/index.js';

// Properties
const port = process.env.PORT || 3000;
const app = express();
const apiVersion = '/api/v1';

// Setup
app.use(express.json());

// HTTP Server
const server = http.createServer(app);
initializeWebSocket(server);

// -- Start schuduling -- 
initializeScheduler();

// API Router
app.use(apiVersion, apiRouter);

app.listen(port, () => {
    console.log(`Server has been started! (HTTP & WebSocket)`)
});