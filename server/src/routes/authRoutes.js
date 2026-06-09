import { Router } from "express";
import {
  activateAccount,
  forgotPassword,
  getMe,
  login,
  requestActivationCode,
  resetPassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/login", login);
router.post("/activation/request", requestActivationCode);
router.post("/activation/confirm", activateAccount);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", protect, getMe);

export default router;
