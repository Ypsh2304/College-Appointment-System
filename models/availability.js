import mongoose from "mongoose";

const availabilitySchema = new mongoose.Schema(
  {
    professorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: { type: Date, required: true },
    endTime: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return !this.startTime || value > this.startTime;
        },
        message: "End time must be after start time",
      },
    },
  },
  { timestamps: true }
);

availabilitySchema.index({ professorId: 1, startTime: 1, endTime: 1 });

const Availability = mongoose.model("Availability", availabilitySchema);
export { Availability };
