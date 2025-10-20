import { Router } from "express";
import { registerUser, loginUser } from "../controllers/users.controller.js";
import { registerLimiter, loginLimiter } from "../../middlewares/rateLimit.middleware.js";

const router = Router();

router.post('/register', registerLimiter, registerUser);
router.post('/login', loginLimiter, loginUser);

export default router;