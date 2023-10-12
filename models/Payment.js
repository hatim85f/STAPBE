const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
  user: {
    type: mongoose.Types.ObjectId,
    ref: "user",
    required: true,
  },
  subscription: {
    type: mongoose.Types.ObjectId,
    ref: "subscription",
  },
  membership: {
    type: mongoose.Types.ObjectId,
    ref: "membership",
  },
  package: {
    type: mongoose.Types.ObjectId,
    ref: "package",
  },
  amount: {
    type: Number, // The payment amount in your currency (e.g., USD)
    required: true,
  },
  paymentMethod: {
    type: String, // Stripe payment method ID (e.g., card_xxxxxx)
    required: true,
  },
  paymentDate: {
    type: Date, // Date and time when the payment was made
    default: Date.now, // Automatically set to the current date and time
  },
  last4: {
    type: String,
  },
  paymentCardExpiry: {
    type: Date,
  },
  // Additional payment-related fields can be added here as needed
});

module.exports = Payment = mongoose.model("Payment", PaymentSchema);
