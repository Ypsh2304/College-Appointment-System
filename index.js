import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import dotenv from "dotenv"
import helmet from "helmet"
import morgan from "morgan" 
import {notFound, errorMiddleware} from "./middleware/error.js"

// import errorMiddleware from "./middleware/error.js"
import userRoutes from "./routes/user.js"
import professorRoutes from "./routes/proff.js"
import generalRoutes from "./routes/general.js"


dotenv.config();
if (!process.env.JWT_SECRET || !process.env.MONGO_URL){
    console.error("FATAL: JWT_SECRET or MONGO_URL missing from .env");
    process.exit(1);
}
const app = express();


app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({policy: "cross-origin"}));
app.use(morgan("common"))
app.use(express.urlencoded({ extended: false }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*",
  methods: ["GET", "POST", "PATCH", "DELETE"],
}));

// The order of these routes are important
app.use('/users', userRoutes);
app.use('/professor',professorRoutes);
app.use('/general', generalRoutes);
app.use(notFound)
app.use(errorMiddleware)

const PORT = process.env.PORT  || 5001;
const dbOptions = process.env.USE_DOCDB === "true"
  ? { tlsCAFile: process.env.DOCDB_CA_FILE || "./global-bundle.pem" }
  : {};

mongoose.connect(process.env.MONGO_URL, dbOptions)
  .then(() => {
    app.listen(PORT, () => console.log(`Server Port: ${PORT}`));
  })
  .catch((error) => console.log(`${error} did not connect`));
