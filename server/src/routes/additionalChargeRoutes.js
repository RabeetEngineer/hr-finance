import { Router } from "express";
import {
  createAdditionalCharge,
  endAdditionalCharge,
  getAdditionalChargeById,
  listAdditionalCharges,
  updateAdditionalCharge,
} from "../controllers/additionalChargeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(protect, authorizeRoles("super_admin", "admin"));
router.route("/").get(listAdditionalCharges).post(createAdditionalCharge);
router.route("/:id").get(getAdditionalChargeById).put(updateAdditionalCharge);
router.patch("/:id/end", endAdditionalCharge);

export default router;

