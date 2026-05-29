import { Router } from "express";
import {
  assignAdditionalCharge,
  assignSeat,
  createSeat,
  deleteSeat,
  getSeatById,
  listSeats,
  listVacantSeats,
  updateSeat,
  vacateSeat,
} from "../controllers/seatController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(protect);
router.get("/vacant", listVacantSeats);
router.route("/").get(listSeats).post(authorizeRoles("super_admin", "admin"), createSeat);
router.route("/:id").get(getSeatById).put(authorizeRoles("super_admin", "admin"), updateSeat).delete(authorizeRoles("super_admin", "admin"), deleteSeat);
router.patch("/:id/assign", authorizeRoles("super_admin", "admin"), assignSeat);
router.patch("/:id/vacate", authorizeRoles("super_admin", "admin"), vacateSeat);
router.patch("/:id/additional-charge", authorizeRoles("super_admin", "admin"), assignAdditionalCharge);

export default router;
