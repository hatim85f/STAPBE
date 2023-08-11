const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ReturnsSchema = new Schema({
  _id: mongoose.Types.ObjectId,
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "business",
    required: true,
  },
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
  clientId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "client",
  },
  returnedQuantity: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
});

module.exports = Returns = mongoose.model("returns", ReturnsSchema);
