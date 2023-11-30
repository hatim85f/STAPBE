const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const OrderProductsSchema = new Schema({
  _id: mongoose.Types.ObjectId,
  orderId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "order",
  },
  productId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "product",
  },
  quantity: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  discountType: {
    type: String,
    enum: ["Percentage", "Fixed"],
    default: "Percentage",
  },
  bonusUnits: {
    type: Number,
    default: 0,
  },
  productPrice: {
    type: Number,
    required: true,
  },
  totalValue: {
    type: Number,
    required: true,
  },
  timeStamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = OrderProducts = mongoose.model(
  "orderProducts",
  OrderProductsSchema
);
