import { Router } from "express";
import { createWing, deleteWing, getWingById, listWings, updateWing } from "../controllers/wingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(protect, authorizeRoles("super_admin", "admin"));
router.route("/").get(listWings).post(createWing);
router.route("/:id").get(getWingById).put(updateWing).delete(deleteWing);

export default router;

