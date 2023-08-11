const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProductSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  type: {
    type: String,
    required: false,
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "business",
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  productNickName: {
    type: String,
  },
  costPrice: {
    type: Number,
  },
  retailPrice: {
    type: Number,
    required: true,
  },
  sellingPrice: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  imageURL: {
    type: String,
    required: true,
  },
  minimunmDiscount: {
    type: Number,
  },
  maximumDiscount: {
    type: Number,
  },
  currency: {
    type: String,
    required: true,
  },
});

module.exports = Product = mongoose.model("product", ProductSchema);
