import mongoose from "mongoose";


// ============================
// BID SCHEMA
// ============================

const bidSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: true
  }
);


// ============================
// AUCTION SCHEMA
// ============================

const auctionSchema = new mongoose.Schema(
  {
    item: {
      type: String,
      required: true,
      trim: true
    },

    startingPrice: {
      type: Number,
      required: true,
      min: 0
    },

    minIncrement: {
      type: Number,
      required: true,
      min: 0
    },

    startTime: {
      type: Date,
      required: true
    },

    endTime: {
      type: Date,
      required: true
    },

    status: {
      type: String,

      enum: [
        "SCHEDULED",
        "OPEN",
        "CLOSED"
      ],

      default: "SCHEDULED"
    },

    currentHighestBid: {
      type: Number,
      default: 0
    },

    highestBidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    bids: {
      type: [bidSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);


export const Auction = mongoose.model(
  "Auction",
  auctionSchema
);