import { Router } from "express";
import { getMe, login } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/login", login);
router.get("/me", protect, getMe);

export default router;

