import {HttpError} from "../models/error.js"
import {Availability} from "../models/availability.js"
import { Appointment } from "../models/appointment.js";
import { User } from "../models/user.js";
import mongoose from "mongoose";

const formatAvailabilityResponse = (availability, professor) => ({
  id: availability._id.toString(),
  professor: professor.name,
  startTimeUtc: availability.startTime.toISOString(),
  endTimeUtc: availability.endTime.toISOString(),
});



// Controller to set availability
const setAvailability = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new HttpError("No professor ID found", 400));
    }

    const professorId = new mongoose.Types.ObjectId(req.user.id);
    const professor = await User.findOne({
      _id: professorId,
      role: "professor",
    }).select("name email");

    if (!professor) {
      return next(new HttpError("Professor not found", 404));
    }

    const slots = Array.isArray(req.body) ? req.body : [req.body];

    if (slots.length === 0) {
      return next(new HttpError("At least one availability slot is required", 400));
    }

    const normalizedSlots = [];

    for (const [index, slot] of slots.entries()) {
      const { startTime, endTime } = slot || {};

      if (!startTime || !endTime) {
        return next(new HttpError(`Start time and end time are required for slot ${index + 1}`, 400));
      }

      const newStartTime = new Date(startTime);
      const newEndTime = new Date(endTime);

      if (Number.isNaN(newStartTime.getTime()) || Number.isNaN(newEndTime.getTime())) {
        return next(new HttpError(`Invalid date format for slot ${index + 1}`, 400));
      }

      if (newStartTime >= newEndTime) {
        return next(new HttpError(`Start time must be before end time for slot ${index + 1}`, 400));
      }

      normalizedSlots.push({ startTime: newStartTime, endTime: newEndTime });
    }

    const sortedSlots = [...normalizedSlots].sort((a, b) => a.startTime - b.startTime);

    for (let i = 1; i < sortedSlots.length; i += 1) {
      if (sortedSlots[i - 1].endTime > sortedSlots[i].startTime) {
        return next(new HttpError("Availability slots in the request cannot overlap each other", 400));
      }
    }

    const existingAvailability = await Availability.findOne({
      professorId,
      $or: normalizedSlots.map((slot) => ({
        startTime: { $lt: slot.endTime },
        endTime: { $gt: slot.startTime },
      })),
    });

    if (existingAvailability) {
      return next(new HttpError(`One or more slots overlap with an existing availability for Professor ${professor.name}`, 400));
    }

    const createdAvailability = await Availability.insertMany(
      normalizedSlots.map((slot) => ({
        professorId,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }))
    );

    res.status(201).json({
      message: `${createdAvailability.length} availability slot${createdAvailability.length === 1 ? "" : "s"} added successfully for Professor ${professor.name}.`,
      availability: createdAvailability.map((availability) => formatAvailabilityResponse(availability, professor)),
    });
  } catch (error) {
    console.error("Error adding availability:", error);
    return next(new HttpError("Adding availability failed", 500));
  }
};



  const cancelAppointments = async(req,res,next) => {
    try {
      const { studentId } = req.params;  // Student's ID from params
      const professorId = req.user.id;   // Professor's ID from the authenticated user

      // Ensuring professor is authenticated and studentId is provided
      if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
        return next(new HttpError("Invalid or missing student ID", 400));
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
  
      // Finding the  appointments between this professor and student
      const appointments = await Appointment.find({
        studentId: studentObjectId,
        professorId: professorObjectId,
        status: 'booked' // Only cancel booked appointments
      });
  
      if (!appointments || appointments.length === 0) {
        return next(new HttpError(`No booked appointments found between Professor ${professor.name} and Student ${student.name}`, 404));
      }
  
      // Updating the status of all appointments to "canceled"
      await Appointment.updateMany(
        {
          studentId: studentObjectId,
          professorId: professorObjectId,
          status: 'booked'
        },
        { status: 'cancelled' } //  the status  needs to be canceled
      );
  
      res.status(200).json({
        message: `All booked appointments between Professor ${professor.name} and Student ${student.name} have been cancelled.`
      });
  
    } catch (error) {
      console.error("Error cancelling appointments:", error);
      return next(new HttpError(error.message || "Failed to cancel appointments", 500));
    }
  };


const updateAvailability = async (req, res, next) => {
  try {
    const { availabilityId } = req.params;
    const { startTime, endTime } = req.body;
    const professorId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(availabilityId)) {
      return next(new HttpError("Invalid availability ID format", 400));
    }

    const professorObjectId = new mongoose.Types.ObjectId(professorId);
    const professor = await User.findOne({
      _id: professorObjectId,
      role: "professor",
    }).select("name email");

    if (!professor) {
      return next(new HttpError("Professor not found", 404));
    }

    if (!startTime || !endTime) {
      return next(new HttpError("Start time and end time are required", 400));
    }

    const newStartTime = new Date(startTime);
    const newEndTime = new Date(endTime);

    if (Number.isNaN(newStartTime.getTime()) || Number.isNaN(newEndTime.getTime())) {
      return next(new HttpError("Invalid date format for start time or end time", 400));
    }

    if (newStartTime >= newEndTime) {
      return next(new HttpError("Start time must be before end time", 400));
    }

    const availability = await Availability.findOne({
      _id: availabilityId,
      professorId: professorObjectId,
    });

    if (!availability) {
      return next(new HttpError("Availability slot not found or you are not authorized to update it", 404));
    }

    const activeBooking = await Appointment.findOne({
      professorId: professorObjectId,
      status: "booked",
      time: {
        $gte: availability.startTime,
        $lt: availability.endTime,
      },
    });

    if (activeBooking) {
      const student = await User.findById(activeBooking.studentId).select("name email");
      const studentLabel = student ? student.name : "another student";
      return next(new HttpError(`Cannot update this slot for Professor ${professor.name} because it has an active booking with Student ${studentLabel}`, 400));
    }

    const overlappingAvailability = await Availability.findOne({
      professorId: professorObjectId,
      _id: { $ne: availabilityId },
      startTime: { $lt: newEndTime },
      endTime: { $gt: newStartTime },
    });

    if (overlappingAvailability) {
      return next(new HttpError(`Updated time slot overlaps with another availability slot for Professor ${professor.name}`, 400));
    }

    availability.startTime = newStartTime;
    availability.endTime = newEndTime;
    await availability.save();

    res.status(200).json({
      message: "Availability updated successfully!",
      availability: formatAvailabilityResponse(availability, professor),
    });
  } catch (error) {
    console.error("Error updating availability:", error);
    return next(new HttpError(error.message || "Updating availability failed", 500));
  }
};
export { setAvailability, cancelAppointments, updateAvailability };
