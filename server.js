import "dotenv/config";

import express from "express";
import cors from "cors";

import { connectDB } from "./config/db.js";

// import authRoutes from "./module/auth/auth.routes.js";
// import auctionRoutes from "./module/auction/auction.routes.js";

const app = express();

// DATABASE
await connectDB();

// MIDDLEWARE
app.use(cors());

app.use(express.json());

// HEALTH CHECK
app.get("/", (req, res) => {
  console.log("Health check endpoint hit");
  return res.status(200).json({
      message: "Auction API is running",
  });
});

// ROUTES
// app.use("/api/auth", authRoutes);

// app.use("/api/auctions", auctionRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

// SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
