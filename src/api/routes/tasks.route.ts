import { Router } from "express";
import { createTask, getTasksForComputer, updateTask, deleteTask, getTasksForUser, getTotalTasksForUser, startTaskNow } from "../controllers/tasks.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";
import { validateBody, validateEmptyBody, v } from "../../middlewares/validate.middleware.js";

const router = Router();

// Validation สำหรับ create task
router.post('/', protect, validateBody({
  computer_id: v.requiredString(1, 50),
  name: v.requiredString(1, 100),
  source_path: v.safePath(),
  destination_path: v.safePath(),
  schedule: v.requiredString(5, 50),
  is_active: v.optionalOneOf(['true', 'false']),
  backup_keep_count: v.optionalIntIn(1, 100),
  retry_attempts: v.optionalIntIn(1, 20),
  retry_delay_seconds: v.optionalIntIn(1, 300),
  folder_prefix: v.optionalString(1, 50),
  timestamp_format: v.optionalString(1, 50),
  discord_webhook_url: v.optionalString(10, 500),
  notification_on_success: v.optionalString(0, 1000),
  notification_on_failure: v.optionalString(0, 1000),
}), createTask);

router.post('/:taskId/start-now', protect, validateEmptyBody(), startTaskNow);

router.get('/user', protect, getTasksForUser);
router.get('/user/count', protect, getTotalTasksForUser);
router.get('/computer/:computerId', protect, getTasksForComputer);

// Validation สำหรับ update task
router.put('/:taskId', protect, validateBody({
  name: v.requiredString(1, 100),
  source_path: v.safePath(),
  destination_path: v.safePath(),
  schedule: v.requiredString(5, 50),
  is_active: v.optionalOneOf(['true', 'false']),
  backup_keep_count: v.optionalIntIn(1, 100),
  retry_attempts: v.optionalIntIn(1, 20),
  retry_delay_seconds: v.optionalIntIn(1, 300),
  folder_prefix: v.optionalString(1, 50),
  timestamp_format: v.optionalString(1, 50),
  discord_webhook_url: v.optionalString(10, 500),
  notification_on_success: v.optionalString(0, 1000),
  notification_on_failure: v.optionalString(0, 1000),
}), updateTask);

router.delete('/:taskId', protect, deleteTask);

export default router;