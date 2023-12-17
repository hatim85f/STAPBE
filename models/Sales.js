const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SalesSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "businesses",
  },
  version: {
    type: String,
    required: true,
  },
  salesData: [
    {
      productId: {
        type: mongoose.Types.ObjectId,
        ref: "products",
      },
      productName: {
        type: String,
        required: true,
      },
      date: {
        type: Date,
        required: true,
      },
      status: {
        type: String,
        enum: ["Pending", "In Progress", "Completed", "Cancelled"],
        default: "Completed",
      },
      quantity: {
        type: Number,
        required: true,
      },
      totalQuantity: {
        type: Number,
        required: true,
      },
      productPrice: {
        type: Number,
        required: true,
      },
      discount: {
        type: Number,
        required: true,
      },
      discountType: {
        type: String,
        enum: ["Percentage", "Fixed"],
        default: "Percentage",
      },
      clientName: {
        type: String,
        required: true,
      },
      itemValue: {
        type: Number,
        required: true,
      },
    },
  ],
  addedIn: {
    type: Date,
    default: Date.now,
  },
  updatedIn: {
    type: Date,
    default: Date.now,
  },
  addedBy: {
    type: mongoose.Types.ObjectId,
    ref: "users",
  },
  updatedBy: {
    type: mongoose.Types.ObjectId,
    ref: "users",
  },
  totalValue: {
    type: Number,
    required: true,
  },
  lastOpened: {
    type: Date,
    default: Date.now,
  },
  openedWith: {
    type: mongoose.Types.ObjectId,
    ref: "users",
  },
  isFinal: {
    type: Boolean,
    default: false,
  },
});

module.exports = Sales = mongoose.model("sales", SalesSchema);
