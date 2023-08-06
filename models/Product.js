const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProductSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "user",
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "business",
  },
  productName: {
    type: String,
    required: true,
  },
  nickName: {
    type: String,
  },
  productType: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  image: {
    type: String,
  },
  retailPrice: {
    type: Number,
    required: true,
  },
  costPrice: {
    type: Number,
    required: true,
  },
  publicSellingPrice: {
    type: Number,
    required: true,
  },
});

module.exports = Product = mongoose.model("product", ProductSchema);
