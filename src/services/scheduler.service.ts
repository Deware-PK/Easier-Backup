import cron from 'node-cron';
import prisma from '../db.js';
import { sendCommandToAgent } from './websocket.service.js';
import parser from 'cron-parser';

/**
 * Initialize Scheduler
 */
export function initializeScheduler() {
    // Scheduling every minute
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        console.log(`\n⏰ Scheduler running at ${now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);

        
        try {
            // 👇 2. Include computer data
            const activeTasks = await prisma.tasks.findMany({
                where: { is_active: true },
                include: { 
                    computer: { 
                        select: {
                            default_backup_keep_count: true,
                            default_retry_attempts: true,
                            default_retry_delay_seconds: true
                        }
                    } 
                } 
            });

            if (!activeTasks.length) {
                console.log('   -> No active tasks to check.');
                return;
            }

            for (const task of activeTasks) {
                //
                try {

                    const options = {
                        currentDate: now,
                        tz: 'Asia/Bangkok',
                    };

                    const interval = parser.CronExpressionParser.parse(task.schedule, options);
                    const previousRun = interval.prev().toDate();
                    const oneMinuteAgo = new Date(now.getTime() - 60000);

                    if (previousRun >= oneMinuteAgo) {
                        
                        console.log(`Task ${task.id} (${task.name}) is due. Sending command...`);
                        
                        const newJob = await prisma.backup_jobs.create({
                            data: {
                                task_id: task.id,
                                status: 'running'
                            }
                        });

                        const command = {
                            action: 'start-backup',
                            jobId: newJob.id.toString(),
                            sourceFile: task.source_path,
                            destinationBaseFolder: task.destination_path,
                            keepCount: task.backup_keep_count ?? task.computer.default_backup_keep_count ?? 3, // ใส่ fallback สุดท้าย
                            retryAttempts: task.retry_attempts ?? task.computer.default_retry_attempts ?? 3,
                            retryDelay: task.retry_delay_seconds ?? task.computer.default_retry_delay_seconds ?? 5,
                            folderPrefix: task.folder_prefix ?? 'backup_',
                            timestampFormat: task.timestamp_format ?? '%Y%m%d_%H%M%S'
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