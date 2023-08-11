const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProductTargetSchema = new Schema({
  _id: mongoose.Types.ObjectId,
  productId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "product",
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "business",
  },
  targetUnits: {
    type: Number,
    required: true,
  },
  targetValue: {
    type: Number,
    required: true,
  },
  startPeriod: {
    type: String,
    required: true,
  },
  endPeriod: {
    type: String,
    required: true,
  },
  addedIn: {
    type: Date,
    default: Date.now,
  },
  updatedIn: {
    type: Date,
    default: Date.now,
  },
});

module.exports = ProductTarget = mongoose.model(
  "productTarget",
  ProductTargetSchema
);
