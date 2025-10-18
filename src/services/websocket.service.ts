import { WebSocketServer, WebSocket } from 'ws';
import { type IncomingMessage } from 'http';
import url from 'url';
import prisma from '../db.js';

const activeConnections = new Map<string, WebSocket>();

/**
 * Initialize function for websocket
 * @param server - HTTP Server ที่สร้างจาก Express
 */
export function initializeWebSocket(server: import('http').Server) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
        const computerId = await authenticateAgent(req);

        if (!computerId) {
            console.log('WebSocket connection rejected: Invalid token.');
            ws.close(1008, 'Invalid authentication token');
            return;
        }

        const computerIdStr = computerId.toString();
        console.log(`Agent connected: Computer ID ${computerIdStr}`);

        activeConnections.set(computerIdStr, ws);
        await updateComputerStatus(computerId, 'online');

        ws.on('message', async (message: Buffer) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.action === 'heartbeat') {
                    console.log(`Heartbeat received from Computer ID ${computerIdStr}`);

                    await prisma.computers.update({
                        where: { id: BigInt(computerId.toString()) },
                        data: { last_seen_at: new Date() },
                    });
                } else if (data.action === 'update-job-status') {
                    const { jobId, status, details } = data;

                    if (jobId && (status === 'success' || status === 'failed')) {
                        console.log(`Job status update received for Job ID ${jobId}: ${status}`);
                        const updatedJob = await prisma.backup_jobs.update({ // เก็บผลลัพธ์ไว้
                            where: { id: BigInt(jobId) },
                            data: { status: status, completed_at: new Date(), details: details || null },
                            include: { task: true } 
                        });

                        
                        if (updatedJob.task.discord_webhook_url) {
                            let message = '';
                            if (status === 'success') {
                                message = updatedJob.task.notification_on_success || `✅ Backup task "${updatedJob.task.name}" completed successfully.`;
                            } else {
                                message = updatedJob.task.notification_on_failure || `❌ Backup task "${updatedJob.task.name}" failed.`;
                                if (details) {
                                    message += `\nError: ${details}`;
                                }
                            }
                            
                            console.log(`Sending Discord notification for Job ID ${jobId}`);
                        }
                    }

                }

            } catch (e) {
                console.error('Invalid message from agent:', message.toString());
            }
        });

        ws.on('close', async () => {
            console.log(`Agent disconnected: Computer ID ${computerIdStr}`);
            activeConnections.delete(computerIdStr);
            await updateComputerStatus(computerId, 'offline');
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    console.log('WebSocket Server is initialized and running.');
}

/**
 * Function for authentication for Agent from Auth Token
 */
async function authenticateAgent(req: IncomingMessage): Promise<BigInt | null> {
    const { query } = url.parse(req.url || '', true);
    const token = query.token;

    if (typeof token !== 'string' || !token) {
        return null;
    }

    try {
        const computer = await prisma.computers.findUnique({
            where: { auth_token: token },
        });
        return computer ? computer.id : null;
    } catch (error) {
        return null;
    }
}

/**
 * Function for updating computer status
 */
async function updateComputerStatus(computerId: BigInt, status: 'online' | 'offline') {
    try {
        await prisma.computers.update({
            where: { id: BigInt(computerId.toString()) },
            data: { 
                status: status,
                last_seen_at: new Date()
            },
        });
    } catch (error) {
        console.error(`Failed to update status for computer ${computerId}:`, error);
    }
}

/**
 * Function for sending command to specific agent
 */
export function sendCommandToAgent(computerId: string, command: object): boolean {
    const ws = activeConnections.get(computerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(command));
        console.log(`Command sent to Computer ID ${computerId}:`, command);
        return true;
    }
    console.warn(`Could not send command: Agent ${computerId} is not connected.`);
    return false;
}