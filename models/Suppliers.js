const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SupplierSchema = Schema({
  supplierName: {
    type: String,
    required: true,
  },
  supplierEmail: {
    type: String,
    required: true,
  },
  supplierPhone: {
    type: String,
    required: true,
  },
  supplierAddress: {
    type: String,
    required: true,
  },
  supplierCity: {
    type: String,
    required: true,
  },
  contactPerson: {
    type: String,
    required: true,
  },
  contactPersonPhone: {
    type: String,
    required: true,
  },
  contactPersonEmail: {
    type: String,
    required: true,
  },
  paymentPeriod: {
    type: Number,
    required: true,
  },
  lastOrder: {
    type: Date,
  },
  currency: {
    type: String,
    required: true,
  },
  businessIds: {
    type: [Schema.Types.ObjectId],
    ref: "business",
  },
  purchaseOrders: [
    {
      type: Schema.Types.ObjectId,
      ref: "purchaseOrder",
    },
  ],
});

module.exports = Supplier = mongoose.model("supplier", SupplierSchema);
