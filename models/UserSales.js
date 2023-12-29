const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSalesSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  user: {
    type: mongoose.Types.ObjectId,
    ref: "users",
  },
  versionName: {
    type: String,
    required: true,
  },
  businessId: [
    {
      type: mongoose.Types.ObjectId,
      ref: "businesses",
    },
  ],
  addingUser: {
    type: mongoose.Types.ObjectId,
    ref: "users",
    required: true,
  },
  salesData: [
    {
      product: {
        type: mongoose.Types.ObjectId,
        ref: "products",
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
    },
  ],
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
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
  isFinal: {
    type: Boolean,
    default: false,
  },
});

module.exports = UserSales = mongoose.model("userSales", UserSalesSchema);
