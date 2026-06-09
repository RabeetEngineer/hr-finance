import { Router } from "express";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  activateUserManually,
  resendUserActivation,
  resetUserPasswordManually,
  updateUser,
  updateUserRole,
  updateUserStatus,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(protect, authorizeRoles("super_admin"));
router.route("/").get(listUsers).post(createUser);
router.route("/:id").get(getUserById).put(updateUser).delete(deleteUser);
router.patch("/:id/status", updateUserStatus);
router.patch("/:id/role", updateUserRole);
router.patch("/:id/activate", activateUserManually);
router.post("/:id/reset-password", resetUserPasswordManually);
router.post("/:id/resend-activation", resendUserActivation);

export default router;
