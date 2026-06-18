import mongoose from "mongoose";
import { Appointment } from "../models/appointment.js";
import { Availability } from "../models/availability.js";
import { HttpError } from "../models/error.js";
import { User } from "../models/user.js";

const getAvailableSlots = async (req, res, next) => {
  try {
    const { professorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(professorId)) {
      return next(new HttpError("Invalid professor ID format", 400));
    }

    const professorObjectId = new mongoose.Types.ObjectId(professorId);
    const professor = await User.findOne({
      _id: professorObjectId,
      role: "professor",
    }).select("name email");

    if (!professor) {
      return next(new HttpError("Professor not found", 404));
    }

    const now = new Date();
    const availability = await Availability.find({
      professorId: professorObjectId,
      endTime: { $gt: now },
    }).sort({ startTime: 1 });

    if (!availability || availability.length === 0) {
      return next(new HttpError("No availability found for this professor", 404));
    }

    const bookedAppointments = await Appointment.find({
      professorId: professorObjectId,
      status: "booked",
      time: { $gte: now },
    }).select("time");

    const freeAvailability = availability.filter((slot) => {
      return !bookedAppointments.some((appointment) => {
        return appointment.time >= slot.startTime && appointment.time < slot.endTime;
      });
    });

    if (freeAvailability.length === 0) {
      return next(new HttpError("No free availability found for this professor", 404));
    }

    const availableSlots = freeAvailability.map((slot) => ({
      id: slot._id.toString(),
      professor: professor.name,
      startTimeUtc: slot.startTime.toISOString(),
      endTimeUtc: slot.endTime.toISOString(),
    }));

    res.status(200).json({ availableSlots });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return next(new HttpError("Failed to fetch availability", 500));
  }
};

const bookAppointment = async (req, res, next) => {
  try {
    const { professorId, time } = req.body;
    const studentId = req.user.id;

    if (!time || !professorId) {
      return next(new HttpError("Professor ID and time are required", 400));
    }

    if (!mongoose.Types.ObjectId.isValid(professorId)) {
      return next(new HttpError("Invalid professor ID format", 400));
    }

    const appointmentTime = new Date(time);
    if (Number.isNaN(appointmentTime.getTime())) {
      return next(new HttpError("Invalid date format for booking time", 400));
    }

    const professorObjectId = new mongoose.Types.ObjectId(professorId);
    const studentObjectId = new mongoose.Types.ObjectId(studentId);
    const professor = await User.findOne({
      _id: professorObjectId,
      role: "professor",
    }).select("name email");

    if (!professor) {
      return next(new HttpError("Professor not found", 404));
    }

    const student = await User.findOne({
      _id: studentObjectId,
      role: "student",
    }).select("name email");

    if (!student) {
      return next(new HttpError("Student not found", 404));
    }

    const availability = await Availability.findOne({
      professorId: professorObjectId,
      startTime: { $lte: appointmentTime },
      endTime: { $gt: appointmentTime },
    });

    if (!availability) {
      return next(new HttpError("Selected time is not available", 400));
    }

    const existingAppointment = await Appointment.findOne({
      professorId: professorObjectId,
      time: appointmentTime,
      status: "booked",
    });

    if (existingAppointment) {
      return next(new HttpError("Appointment time already booked", 400));
    }

    const appointment = new Appointment({
      studentId: studentObjectId,
      professorId: professorObjectId,
      time: appointmentTime,
    });

    await appointment.save();

    res.status(201).json({
      message: "Appointment booked",
      appointment: {
        id: appointment._id.toString(),
        student: student.name,
        professor: professor.name,
        timeUtc: appointment.time.toISOString(),
        status: appointment.status,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(new HttpError("Appointment time already booked", 400));
    }

    console.error("Error booking appointment:", error);
    return next(new HttpError("Failed to book appointment", 500));
  }
};

const getStudentAppointments = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const studentObjectId = new mongoose.Types.ObjectId(studentId);
    const student = await User.findOne({
      _id: studentObjectId,
      role: "student",
    }).select("name email");

    if (!student) {
      return next(new HttpError("Student not found", 404));
    }

    const appointments = await Appointment.find({
      studentId: studentObjectId,
      status: "booked",
    }).populate("professorId", "name email");

    if (!appointments || appointments.length === 0) {
      return res.status(200).json({
        message: "No pending appointments",
        appointments: [],
      });
    }

    const formattedAppointments = appointments.map((appointment) => ({
      professor: appointment.professorId ? appointment.professorId.name : "Professor no longer available",
      appointmentTimeUtc: appointment.time.toISOString(),
      status: appointment.status,
    }));

    res.status(200).json({
      message: "Pending appointments",
      appointments: formattedAppointments,
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return next(new HttpError("Failed to retrieve appointments", 500));
  }
};

export { getAvailableSlots, bookAppointment, getStudentAppointments };
