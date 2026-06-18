import jwt from "jsonwebtoken";
import { HttpError } from "../models/error.js";

const authMiddleware = async (req, res, next) => {
  const authorization = req.headers.authorization || req.headers.Authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return next(new HttpError("Authentication token required", 401));
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }, (err, info) => {
    if (err) {
      return next(new HttpError("Invalid or expired token", 401));
    }

    req.user = info;
    next();
  });
};

const profMiddleware = async (req, res, next) => {
  if (!req.user || req.user.role !== "professor") {
    return next(new HttpError("Professor access required", 403));
  }

  next();
};

const studentMiddleware = async (req, res, next) => {
  if (!req.user || req.user.role !== "student") {
    return next(new HttpError("Student access required", 403));
  }

  next();
};

export { authMiddleware, profMiddleware, studentMiddleware };
