import { Router } from "express";
import {
  createOffice,
  deleteOffice,
  getOfficeById,
  listOfficeTree,
  listOffices,
  moveOrganizationUnit,
  updateOffice,
} from "../controllers/organizationUnitController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(protect, authorizeRoles("super_admin", "admin"));
router.get("/tree", listOfficeTree);
router.patch("/:id/move", moveOrganizationUnit);
router.route("/").get(listOffices).post(createOffice);
router.route("/:id").get(getOfficeById).put(updateOffice).delete(deleteOffice);

export default router;
