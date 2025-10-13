import cron from 'node-cron';
import prisma from '../db.js';
import { sendCommandToAgent } from './websocket.service.js';
import { CronExpressionParser } from 'cron-parser';

/**
 * Initialize Scheduler
 */
export function initializeScheduler() {
    // Scheduling every minute
    cron.schedule('*/20 * * * * *', async () => {
        console.log('Scheduler running: Checking for tasks to execute...');

        try {
            const activeTasks = await prisma.tasks.findMany({
                where: { is_active: true },
            });

            const now = new Date();

            for (const task of activeTasks) {
                //
                try {
                    const interval = CronExpressionParser.parse(task.schedule);
                    const nextRun = interval.next().toDate();

                    const oneMinuteAgo = new Date(now.getTime() - 60000);
                    if (nextRun >= oneMinuteAgo && nextRun <= now) {
                        
                        console.log(`Task ${task.id} (${task.name}) is due. Sending command...`);

                        const command = {
                            action: 'start-backup',
                            sourceFile: task.source_path,
                            destinationFolder: task.destination_path
                        };
                        sendCommandToAgent(task.computer_id.toString(), command);
                    }
                } catch (err) {
                    console.error(`Invalid cron expression for Task ID ${task.id}: "${task.schedule}"`);
                }
            }
        } catch (error) {
            console.error('Error during scheduler run:', error);
        }
    });

    console.log('Scheduler is initialized and running.');
}