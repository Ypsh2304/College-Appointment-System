import jwt from "jsonwebtoken";
import { HttpError } from "../models/error.js";

const authMiddleware = async (req, res, next) => {
  const authorization = req.headers.authorization || req.headers.Authorization;  

  if (authorization && authorization.startsWith("Bearer ")) {
    const token = authorization.split(" ")[1]; // Extract the token
    jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] } , (err, info) => {
      if (err) {
        return next(new HttpError("Unauthorized, Invalid token", 401));
      }
      req.user = info;
      next();
    });
  } else {
    return next(new HttpError("Unauthorized, No token", 401));
  }
};

const profMiddleware = async(req,res,next) => {
    if (req.user.role !== "professor") {
        return next(new HttpError("Access denied, only professors can add availability", 403));
      }
      next();
    };

const studentMiddleware = async(req,res,next)=>{
  if (req.user.role !== "student"){
    return next(new HttpError("Access denied , only students can perform this action",403));
  }

  next();
}

export  { authMiddleware, profMiddleware, studentMiddleware };