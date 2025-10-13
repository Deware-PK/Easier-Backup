import express from 'express';
import 'dotenv/config';

// Import Routes
import userRoutes from './api/routes/users.route.js';

// Use Routes
const apiVersion = '/api/v1';
const userRouteBasePath = `${apiVersion}/users`;

// Properties
const port = process.env.PORT || 3000;
const app = express();

// Setup
app.use(express.json());
app.use(userRouteBasePath, userRoutes);

app.listen(port, () => {
    console.log(`Server has been started!`)
});