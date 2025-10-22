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
            const activeTasks = await prisma.tasks.findMany({
                where: { is_active: true },
                include: { 
                    computer: { 
                        select: {
                            status: true,
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
                
                try {

                    if (!/^[\d\*\/\-,\s]+$/.test(task.schedule)) {
                        console.error(`Invalid cron format for Task ID ${task.id}: "${task.schedule}"`);
                        continue;
                    }
    
                    const options = {
                        currentDate: now,
                        tz: 'Asia/Bangkok',
                    };

                    const interval = parser.CronExpressionParser.parse(task.schedule, options);
                    const previousRun = interval.prev().toDate();
                    const oneMinuteAgo = new Date(now.getTime() - 60000);

                    if (previousRun >= oneMinuteAgo) {
                        
                        if (!task.computer || task.computer.status !== 'online') {
                            console.log(`   -> Computer ID ${task.computer_id} is offline. Skipping task.`);
                            continue;
                        }
                        
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
                            timestampFormat: task.timestamp_format ?? '%Y%m%d_%H%M%S',
                            discordWebhookUrl: task.discord_webhook_url ?? null,
                            notificationOnSuccess: task.notification_on_success ?? null,
                            notificationOnFailure: task.notification_on_failure ?? null,
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

    // Clean up old backup jobs every day at 3 AM
    cron.schedule('0 3 * * *', async () => {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const result = await prisma.backup_jobs.deleteMany({
                where: {
                    started_at: {
                        lt: thirtyDaysAgo
                    }
                }
            });

            console.log(`🗑️  Cleaned up ${result.count} backup jobs older than 30 days.`);
        } catch (error) {
            console.error('❌ Error cleaning up old backup jobs:', error);
        }
    }, {
        timezone: 'Asia/Bangkok'
    });

    console.log('Scheduler is initialized and running.');
}