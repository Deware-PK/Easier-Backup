import { Router } from "express";
import { getJobsForTask } from "../controllers/backup_jobs.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get('/task/:taskId', protect, getJobsForTask);

export default router;