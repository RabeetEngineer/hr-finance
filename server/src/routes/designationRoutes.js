import { Router } from "express";
import {
  createDesignation,
  deleteDesignation,
  getDesignationById,
  listDesignations,
  updateDesignation,
} from "../controllers/designationController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.route("/").get(listDesignations);

router.use(protect, authorizeRoles("super_admin", "admin"));
router.route("/").post(createDesignation);
router.route("/:id").get(getDesignationById).put(updateDesignation).delete(deleteDesignation);

export default router;
