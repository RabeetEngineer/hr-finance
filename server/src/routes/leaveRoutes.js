import { Router } from "express";
import { approveLeave, createLeave, getLeaveById, listLeaves, updateLeave } from "../controllers/leaveController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(protect);
router.route("/").get(listLeaves).post(authorizeRoles("super_admin", "admin", "data_entry"), createLeave);
router.route("/:id").get(getLeaveById).put(authorizeRoles("super_admin", "admin", "data_entry"), updateLeave);
router.patch("/:id/approve", authorizeRoles("super_admin", "admin"), approveLeave);

export default router;

