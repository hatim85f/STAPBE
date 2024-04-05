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
        type: String,
      },
      previousStocks: {
        type: Number,
        required: true,
      },
      totalValue: {
        type: Number,
        required: true,
      },
    },
  ],
  supplier: {
    type: mongoose.Types.ObjectId,
    ref: "supplier",
  },
  totalBill: {
    type: Number,
    required: true,
  },
  businessIds: {
    type: [mongoose.Types.ObjectId],
    ref: "business",
  },
});

module.exports = PurchaseOrder = mongoose.model(
  "purchaseOrder",
  PurchaseOrderSchema
);
