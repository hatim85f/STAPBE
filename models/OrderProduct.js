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
  specialDiscount: {
    type: Number,
    default: 0,
  },
  bonusUnits: {
    type: Number,
    default: 0,
  },
  totalValue: {
    type: Number,
    required: true,
  },
});

module.exports = OrderProducts = mongoose.model(
  "orderProducts",
  OrderProductsSchema
);
