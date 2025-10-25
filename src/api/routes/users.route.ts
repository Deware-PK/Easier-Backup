import { Router } from "express";
import { registerUser, loginUser, logoutUser } from "../controllers/users.controller.js";
import { registerLimiter, loginLimiter } from "../../middlewares/rateLimit.middleware.js";
import { validateBody, validateEmptyBody, v } from "../../middlewares/validate.middleware.js";

const router = Router();

router.post('/register', registerLimiter, validateBody({
  username: v.requiredString(3, 50),
  email: v.email(),
  password: v.requiredString(8, 100),
}), registerUser);

router.post('/login', loginLimiter, validateBody({
  email: v.email(),
  password: v.requiredString(8, 100),
}), loginUser);

router.post('/logout', validateEmptyBody(), logoutUser);

export default router;