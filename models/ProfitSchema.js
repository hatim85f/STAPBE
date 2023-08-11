const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProfitSchema = new Schema({
  _id: mongoose.Types.ObjectId,
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "business",
    required: true,
  },
  orderId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "orders",
  },
  productId: {
    type: mongoose.Types.ObjectId,
    required: true,
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    required: true,
  },
  profitAmount: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = Profit = mongoose.model("profit", ProfitSchema);
