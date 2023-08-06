const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProductTarget = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  productId: {
    type: mongoose.Types.ObjectId,
    ref: "product",
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "business",
  },
  targetUnits: {
    type: Number,
    required: true,
  },
});

module.exports = ProductTarget = mongoose.model("productTarget", ProductTarget);
