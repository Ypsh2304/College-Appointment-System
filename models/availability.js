import mongoose from "mongoose";

const availabilitySchema = new mongoose.Schema({
    professorId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
});

const Availability = mongoose.model('Availability', availabilitySchema);
export { Availability };
