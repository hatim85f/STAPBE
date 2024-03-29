const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const FixedExpensesSchema = Schema({
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
    enum: ["Rent", "Utilities", "Insurance", "Salaries", "Other"],
    required: true,
  },
  categoryOtherText: {
    type: String,
  },
  dueIn: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  recurringDay: {
    type: Number,
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
  recurringType: {
    type: String,
    enum: ["Weekly", "Monthly", "Quarterly", "Yearly"],
    required: true,
  },
  source: {
    type: String,
    required: true,
  },
});

module.exports = FiexedExpenses = mongoose.model(
  "fixedExpenses",
  FixedExpensesSchema
);
