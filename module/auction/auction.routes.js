import express from "express";
import {
  closeAuction,
  createAuction,
  getAuction,
  getAuctions,
  placeBid,
} from "./auction.controller.js";

const auctionRouter = express.Router();

// Create auction
auctionRouter.post("/", createAuction);

// Get all auctions
auctionRouter.get("/", getAuctions);

// Get one auction
auctionRouter.get("/:id", getAuction);

// Place bid
auctionRouter.post("/:id/bids", placeBid);

// Close auction
auctionRouter.post("/:id/close", closeAuction);

export default auctionRouter;
