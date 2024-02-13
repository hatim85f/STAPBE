const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MarketingExpensesSchema = Schema({
  businessId: {
    type: Schema.Types.ObjectId,
    ref: "business",
    required: true,
  },
  requestedBy: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  requestAgainst: {
    type: Schema.Types.ObjectId,
    ref: "products",
    required: true,
  },
  requestedFor: {
    type: String,
    required: true,
  },
  rationale: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  isReceiptAvailable: {
    type: Boolean,
    default: false,
  },
  receiptImage: {
    type: String,
  },
  receiptAmount: {
    type: Number,
  },
  receiptCurrency: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  dueIn: {
    type: Date,
  },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected", "Under Revision", "Revised"],
    default: "Pending",
  },
  isRevised: {
    type: Boolean,
    default: false,
  },
  revisedBy: {
    type: Schema.Types.ObjectId,
    ref: "users",
  },
  revisedByName: {
    type: String,
  },
  revisedAt: {
    type: Date,
  },
  revisionComment: {
    type: String,
  },
  isRevisionPassed: {
    type: Boolean,
    default: false,
  },
  isRevisionReturn: {
    type: Boolean,
    default: false,
  },
  revisionReturnTo: {
    type: Schema.Types.ObjectId,
    ref: "users",
  },
  statusChangedBy: {
    type: Schema.Types.ObjectId,
    ref: "users",
  },
  statusChangedByName: {
    type: String,
  },
  statusChangedAt: {
    type: Date,
  },
  statusChangeComment: {
    type: String,
  },
  isStatusReturn: {
    type: Boolean,
    default: false,
  },
  statusReturnTo: {
    type: Schema.Types.ObjectId,
    ref: "users",
  },
  isReceiptSubmitted: {
    type: Boolean,
    default: false,
  },
  receiptSubmittedAt: {
    type: Date,
  },
  closed: {
    type: Boolean,
    default: false,
  },
  isClaimed: {
    type: Boolean,
    default: false,
  },
  claimedBy: {
    type: Schema.Types.ObjectId,
    ref: "users",
  },
  calimedAt: {
    type: Date,
  },
});

module.exports = MarketingExpenses = mongoose.model(
  "marketingExpenses",
  MarketingExpensesSchema
);
