import express from "express";
import { register ,login, getUserProfile} from "../controllers/user.js"; 
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Route for registering a user
router.post("/register", register);
router.post("/login", login);
router.get("/profile/:id", authMiddleware, getUserProfile);


export default router;
