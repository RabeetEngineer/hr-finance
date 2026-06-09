import { Router } from "express";
import { listActivityLogs, recentActivityTimeline } from "../controllers/activityLogController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(protect);
router.get("/recent", recentActivityTimeline);
router.get("/", authorizeRoles("super_admin"), listActivityLogs);

export default router;
