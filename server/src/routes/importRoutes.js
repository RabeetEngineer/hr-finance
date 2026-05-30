import { Router } from "express";
import {
  commitIncumbencyImport,
  createMissingImportDesignations,
  previewIncumbencyImport,
} from "../controllers/importController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(protect, authorizeRoles("super_admin", "admin"));
router.post("/incumbency/preview", previewIncumbencyImport);
router.post("/incumbency/create-missing-designations", createMissingImportDesignations);
router.post("/incumbency/commit", commitIncumbencyImport);

export default router;
