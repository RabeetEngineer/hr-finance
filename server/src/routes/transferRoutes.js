import { Router } from "express";
import { createTransfer, getTransferById, listTransfers } from "../controllers/transferController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(protect, authorizeRoles("super_admin", "admin"));
router.route("/").get(listTransfers).post(createTransfer);
router.get("/:id", getTransferById);

export default router;

