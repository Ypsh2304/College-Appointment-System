import express from "express";
import { authMiddleware, studentMiddleware } from "../middleware/auth.js";
import { getAvailableSlots, bookAppointment, getStudentAppointments } from "../controllers/general.js";

const router = express.Router();

router.get("/professor/:professorId/availability", authMiddleware, getAvailableSlots);
router.post("/book", authMiddleware, studentMiddleware, bookAppointment);
router.get("/appointments", authMiddleware, studentMiddleware, getStudentAppointments);

export default router;
