const express = require("express");
const http = require("http");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const userRouter = require("./routes/user");
const depositRouter = require("./routes/deposit");
const kycRouter = require("./routes/kyc");
const validateCard = require("./routes/validateCard");
const walletRouter = require("./routes/wallets");
const notificationRouter = require("./routes/notifications");
const TransactionHistory = require("./routes/transactionHistoryWallet");
const billsRouter = require("./routes/bills");
const bankRouter = require("./routes/banks");
const withdrawalRouter = require("./routes/withdrawal");
const webhooksRouter = require("./routes/webhooks");
const virtualAccountRouter = require("./routes/virtualAccount");
const dataPlansRouter = require("./routes/dataPlans");
const adminRouter = require("./routes/admin");
const { v4 } = require("uuid");
const cors = require("cors");
const { startGiftCardSyncCron } = require("./utils/giftCardSync");
const rateLimit = require("express-rate-limit");

dotenv.config();

// MongoDB connection function
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB connected successfully");
    } catch (err) {
        console.error("MongoDB connection failed:", err.message);
        console.error(err.stack); // Log stack trace
        process.exit(1);
    }
};

// Initialize Express
const app = express();

// Trust proxy to handle X-Forwarded-For headers properly
app.set("trust proxy", 1);

app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    })
);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Middleware to parse JSON
app.use(express.json());

// For URL-encoded bodies (if needed)
app.use(express.urlencoded({ extended: true }));

app.use("/api", userRouter);
app.use("/api", depositRouter);
app.use("/api", kycRouter);
app.use("/api", validateCard);
app.use("/api", walletRouter);
app.use("/api", notificationRouter);
app.use("/api", TransactionHistory);
app.use("/api", bankRouter);
app.use("/api", billsRouter);
app.use("/api", withdrawalRouter);
app.use("/api", webhooksRouter);
app.use("/api", virtualAccountRouter);
app.use("/api", adminRouter);
app.use("/api", dataPlansRouter);

app.get("/", (req, res) => {
    res.send("Zangapay Server is up and running");
});

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    const response = {
        success: false,
        message: err.message || "Server Error",
    };

    // Include stack trace in development mode
    if (process.env.NODE_ENV === "development") {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
});

// Create HTTP server and attach the Express app
const server = http.createServer(app);

// Create WebSocket server and attach it to the HTTP server
const io = new Server(server);

const connectedUsers = {}; // Store connected users with their socket IDs
const useSocketMap = {};

io.on("connection", (socket) => {
    console.log("Socket.IO connection established");

    // Get the userId from the socket query
    const userId = socket.handshake.query.userId;

    if (userId) {
        // Store the connected user and their socket ID
        connectedUsers[userId] = socket.id;
        useSocketMap[userId] = socket.id;
        socket.join(userId); // Join room named by userId

        // Listen for client disconnect
        socket.on("disconnect", () => {
            console.log(`User ${userId} disconnected`);
            delete connectedUsers[userId]; // Remove user from connected users
        });
    }
});

// Define the Port
const PORT = process.env.PORT || 3000;

// Connect to the database first, then start the server
server.listen(PORT, async () => {
    try {
        console.log("Server connected");
        await connectDB();

        // Start the gift card sync cron job
        startGiftCardSyncCron();

        console.log("Connected to database");
    } catch (err) {
        console.error("Error starting server:", err.message);
    }
});

