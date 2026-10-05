import mongoose from "mongoose";

import { Auction } from "./auction.model.js";
import { User } from "../user/user.model.js";
import { getAuctionStatus } from "../../utils/auctionStatus.js";

// ==================================================
// CREATE AUCTION
// ==================================================

export const createAuction = async (req, res) => {
  try {
    const { item, startingPrice, minIncrement, startTime, endTime } = req.body;

    // Validate required fields
    if (
      !item ||
      startingPrice === undefined ||
      minIncrement === undefined ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        message: "All auction fields are required",
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    // Validate dates
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        message: "Invalid start or end time",
      });
    }

    // End must be after start
    if (end <= start) {
      return res.status(422).json({
        message: "End time must be after start time",
      });
    }

    // Validate prices
    if (startingPrice < 0) {
      return res.status(422).json({
        message: "Starting price cannot be negative",
      });
    }

    if (minIncrement <= 0) {
      return res.status(422).json({
        message: "Minimum increment must be greater than zero",
      });
    }

    const now = new Date();

    let status = "SCHEDULED";

    if (start <= now && now < end) {
      status = "OPEN";
    }

    if (now >= end) {
      return res.status(422).json({
        message: "Auction end time must be in the future",
      });
    }

    // Create auction
    const auction = await Auction.create({
      item,
      startingPrice,
      minIncrement,
      startTime: start,
      endTime: end,
      status,
      currentHighestBid: startingPrice,
      highestBidder: null,
    });

    return res.status(201).json({
      message: "Auction created successfully",
      auction,
    });
  } catch (error) {
    console.error("Create auction error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// ==================================================
// GET ALL AUCTIONS
// ==================================================

export const getAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find()
      .sort({
        createdAt: -1,
      })
      .populate("highestBidder", "email");

    const now = new Date();

    const results = auctions.map((auction) => {
      const status = getAuctionStatus(auction, now);

      return {
        ...auction.toObject(),
        status,
      };
    });

    return res.status(200).json({
      auctions: results,
    });
  } catch (error) {
    console.error("Get auctions error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// ==================================================
// GET SINGLE AUCTION
// ==================================================

export const getAuction = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid auction id",
      });
    }

    const auction = await Auction.findById(id)
      .populate("highestBidder", "email")
      .populate("bids.user", "email");

    if (!auction) {
      return res.status(404).json({
        message: "Auction not found",
      });
    }

    const now = new Date();

    const status = getAuctionStatus(auction, now);

    return res.status(200).json({
      auction: {
        ...auction.toObject(),
        status,
      },
    });
  } catch (error) {
    console.error("Get auction error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// ==================================================
// PLACE BID
// ==================================================

export const placeBid = async (req, res) => {
  try {
    const { id } = req.params;

    const { userId, amount } = req.body;

    // Validate auction ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid auction id",
      });
    }

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        message: "Invalid user id",
      });
    }

    // Validate amount
    if (amount === undefined || typeof amount !== "number" || amount <= 0) {
      return res.status(422).json({
        message: "Invalid bid amount",
      });
    }

    // Make sure user exists
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Get current auction
    const auction = await Auction.findById(id);

    if (!auction) {
      return res.status(404).json({
        message: "Auction not found",
      });
    }

    const now = new Date();

    // Auction hasn't started
    if (now < auction.startTime) {
      return res.status(409).json({
        message: "Auction has not started",
      });
    }

    // Auction has ended
    if (now >= auction.endTime) {
      // Mark closed
      await Auction.findByIdAndUpdate(id, {
        $set: {
          status: "CLOSED",
        },
      });

      return res.status(410).json({
        message: "Auction has ended",
      });
    }

    // Already closed
    if (auction.status === "CLOSED") {
      return res.status(410).json({
        message: "Auction is closed",
      });
    }

    // User cannot outbid themselves
    if (
      auction.highestBidder &&
      auction.highestBidder.toString() === userId.toString()
    ) {
      return res.status(409).json({
        message: "You are already the highest bidder",
      });
    }

    // Calculate minimum acceptable bid
    const minimumBid = auction.currentHighestBid + auction.minIncrement;

    if (amount < minimumBid) {
      return res.status(409).json({
        message: `Bid must be at least ${minimumBid}`,
      });
    }

    /*
     * IMPORTANT
     *
     * We perform an atomic update.
     *
     * The document must still have the exact
     * highest bid that we read above.
     *
     * If another request changes the auction
     * first, this update matches zero documents.
     */

    const updatedAuction = await Auction.findOneAndUpdate(
      {
        _id: id,

        status: {
          $in: ["OPEN", "SCHEDULED"],
        },

        startTime: {
          $lte: now,
        },

        endTime: {
          $gt: now,
        },

        currentHighestBid: auction.currentHighestBid,

        highestBidder: auction.highestBidder ?? null,
      },

      {
        $set: {
          status: "OPEN",

          currentHighestBid: amount,

          highestBidder: user._id,
        },

        $push: {
          bids: {
            user: user._id,
            amount,
            createdAt: now,
          },
        },
      },

      {
        new: true,
      },
    );

    // Another bid won the race
    if (!updatedAuction) {
      return res.status(409).json({
        message: "Bid was not accepted because another bid was placed first",
      });
    }

    return res.status(201).json({
      message: "Bid placed successfully",

      auction: {
        id: updatedAuction._id,

        currentHighestBid: updatedAuction.currentHighestBid,

        highestBidder: updatedAuction.highestBidder,

        bidCount: updatedAuction.bids.length,
      },
    });
  } catch (error) {
    console.error("Place bid error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// ==================================================
// CLOSE AUCTION
// ==================================================

export const closeAuction = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid auction id",
      });
    }

    const auction = await Auction.findById(id);

    if (!auction) {
      return res.status(404).json({
        message: "Auction not found",
      });
    }

    const now = new Date();

    // Cannot close before end time
    if (now < auction.endTime) {
      return res.status(409).json({
        message: "Auction cannot be closed before its end time",
      });
    }

    auction.status = "CLOSED";

    await auction.save();

    return res.status(200).json({
      message: "Auction closed",

      result: {
        winner: auction.highestBidder,

        finalAmount: auction.currentHighestBid,
      },
    });
  } catch (error) {
    console.error("Close auction error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};
