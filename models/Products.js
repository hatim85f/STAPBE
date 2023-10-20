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
  minimumDiscount: {
    type: Number,
    default: 0,
  },
  maximumDiscount: {
    type: Number,
    default: 0,
  },
  category: {
    type: String,
  },
  productType: {
    type: String,
  },
  currencyCode: {
    type: String,
    required: true,
  },
  currencyName: {
    type: String,
    required: true,
  },
  currencySymbol: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    default: 0,
  },
});

module.exports = Product = mongoose.model("product", ProductSchema);
