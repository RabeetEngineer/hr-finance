import { Router } from "express";
import {
  additionalChargeReport,
  dashboardReport,
  incumbencyReport,
  leaveReport,
  retirementDueReport,
  summaryByDimension,
  transferHistoryReport,
  vacantSeatsReport,
} from "../controllers/reportController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect);
router.get("/dashboard", dashboardReport);
router.get("/incumbency", incumbencyReport);
router.get("/vacant-seats", vacantSeatsReport);
router.get("/additional-charge", additionalChargeReport);
router.get("/transfers", transferHistoryReport);
router.get("/leaves", leaveReport);
router.get("/retirements-due", retirementDueReport);
router.get("/summary/:dimension", summaryByDimension);

export default router;

