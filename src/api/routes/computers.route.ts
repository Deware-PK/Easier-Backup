import { Router } from "express";
import { registerComputer, getUserComputers } from "../controllers/computers.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post('/', protect, registerComputer);
router.get('/', protect, getUserComputers);

export default router;