import { Router } from "express";
import { createTask, getTasksForComputer, updateTask, deleteTask } from "../controllers/tasks.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";

const router = Router();


router.post('/', protect, createTask);
router.get('/computer/:computerId', protect, getTasksForComputer);
router.put('/:taskId', protect, updateTask);
router.delete('/:taskId', protect, deleteTask);


export default router;