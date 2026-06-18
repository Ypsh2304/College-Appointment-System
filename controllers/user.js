import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { HttpError } from "../models/error.js";
import { User } from "../models/user.js";

const hasText = (value) => typeof value === "string" && value.trim().length > 0;

const register = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    if (![name, email, password, confirmPassword, role].every(hasText)) {
      return next(new HttpError("All fields are required", 422));
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toLowerCase();

    if (!["student", "professor"].includes(normalizedRole)) {
      return next(new HttpError("Role must be student or professor", 422));
    }

    const emailExists = await User.findOne({ email: normalizedEmail });
    if (emailExists) {
      return next(new HttpError("Email already exists", 422));
    }

    if (password.length < 3) {
      return next(new HttpError("Password must be at least 3 characters", 422));
    }

    if (password !== confirmPassword) {
      return next(new HttpError("Passwords do not match", 422));
    }

    const salt = await bcrypt.genSalt(11);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: normalizedRole,
    });

    const user = newUser.toObject();
    delete user.password;

    res.status(201).json({ user });
  } catch (error) {
    if (error.code === 11000) {
      return next(new HttpError("Email already exists", 422));
    }

    return next(new HttpError("Registration failed", 500));
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!hasText(email) || !hasText(password)) {
      return next(new HttpError("Email and password are required", 422));
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return next(new HttpError("Invalid credentials", 422));
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return next(new HttpError("Invalid credentials", 422));
    }

    const { _id: id, name, role } = user;
    const token = jwt.sign({ id, name, role }, process.env.JWT_SECRET, { expiresIn: "2d" });

    res.status(200).json({ token, id, name, role });
  } catch (error) {
    return next(new HttpError("Login failed", 500));
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new HttpError("Invalid user ID format", 400));
    }

    const user = await User.findById(id).select("-password");
    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    res.status(200).json(user);
  } catch (error) {
    return next(new HttpError("Failed to get user profile", 500));
  }
};

export { register, login, getUserProfile };
