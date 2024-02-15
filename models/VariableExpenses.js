const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const VariableExpensesSchema = Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  businessId: {
    type: Schema.Types.ObjectId,
    ref: "business",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    enum: ["Groceries", "Entertainment", "Transportation", "Health", "Other"],
    required: true,
  },
  categoryOtherText: {
    type: String,
  },
  description: {
    type: String,
    required: true,
  },
  expenseDate: {
    type: Date,
    default: Date.now,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
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
    required: true,
  },
  receiptCurrency: {
    type: String,
    required: true,
  },
  receiptDate: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

module.exports = VariableExpenses = mongoose.model(
  "variableExpenses",
  VariableExpensesSchema
);
