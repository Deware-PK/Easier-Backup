import { Router } from "express";
import { registerComputer, getUserComputers, updateComputerName, deleteComputer } from "../controllers/computers.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";
import { validateBody, v } from "../../middlewares/validate.middleware.js";

const router = Router();

router.post('/', protect, validateBody({
  name: v.requiredString(1, 100),
  os: v.optionalString(0, 50),
  default_backup_keep_count: v.optionalIntIn(1, 100),
  default_retry_attempts: v.optionalIntIn(1, 20),
  default_retry_delay_seconds: v.optionalIntIn(1, 300),
}), registerComputer);

router.get('/', protect, getUserComputers);

router.put('/:computerId', protect, validateBody({
  name: v.requiredString(1, 100),
}), updateComputerName);

router.delete('/:computerId', protect, deleteComputer);

export default router;