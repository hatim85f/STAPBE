const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PurchaseOrderSchema = Schema({
  order: [
    {
      product: {
        type: mongoose.Types.ObjectId,
        ref: "product",
      },
      quantity: {
        type: Number,
        required: true,
      },
      costPrice: {
        type: Number,
        required: true,
      },
      sellingPrice: {
        type: Number,
        required: true,
      },
      bonus: {
        type: Number,
        required: true,
      },
      totalQuantity: {
        type: Number,
        required: true,
      },
      expiryDate: {
        type: Date,
        default: new Date(new Date().setMonth(new Date().getMonth() + 24)),
      },
      previousStocks: {
        type: Number,
        required: true,
      },
    },
  ],
  spplier: {
    type: mongoose.Types.ObjectId,
    ref: "supplier",
  },
  totalBill: {
    type: Number,
    required: true,
  },
});

module.exports = PurchaseOrder = mongoose.model(
  "purchaseOrder",
  PurchaseOrderSchema
);
