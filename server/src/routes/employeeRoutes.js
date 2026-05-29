import { Router } from "express";
import {
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee,
  updateEmployeeStatus,
} from "../controllers/employeeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(protect);
router.route("/").get(listEmployees).post(authorizeRoles("super_admin", "admin", "data_entry"), createEmployee);
router.route("/:id").get(getEmployeeById).put(authorizeRoles("super_admin", "admin", "data_entry"), updateEmployee).delete(authorizeRoles("super_admin", "admin"), deleteEmployee);
router.patch("/:id/status", authorizeRoles("super_admin", "admin"), updateEmployeeStatus);

export default router;

