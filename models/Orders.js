const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
  _id: mongoose.Types.ObjectId,
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "business",
    required: true,
  },
  userId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "user",
  },
  clientId: {
    type: mongoose.Types.ObjectId,
    ref: "client",
    required: true,
  },
  details: {
    type: Array,
    required: true,
  },
  status: {
    type: String,
    enum: ["Pending", "In Progress", "Completed", "Cancelled"],
    default: "Pending",
  },
  disocunt: {
    type: Number,
    default: 0,
  },
  discountType: {
    type: String,
    enum: ["Percentage", "Fixed"],
    default: "Percentage",
  },
  totalValue: {
    type: Number,
  },
  timeStamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = Order = mongoose.model("order", OrderSchema);
