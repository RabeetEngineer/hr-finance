import { Router } from "express";
import { listActivityLogs } from "../controllers/activityLogController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(protect, authorizeRoles("super_admin"));
router.get("/", listActivityLogs);

export default router;
