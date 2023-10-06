const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SubscriptionSchema = new Schema({
  customer: {
    type: mongoose.Types.ObjectId,
    ref: "user", // Reference to the User model for linking to a specific user
    required: true,
  },
  package: {
    type: mongoose.Types.ObjectId,
    ref: "package", // Reference to the package model for linking to a specific package
    required: true,
  },
  subscriptionId: {
    type: String, // Stripe subscription ID
    required: true,
  },
  billingPeriod: {
    type: String, // "Monthly" or "Yearly" (or any other billing period you support)
    required: true,
  },
  price: {
    type: Number, // The subscription price in your currency (e.g., USD)
    required: true,
  },
  nextBillingDate: {
    type: String, // Date of the next billing cycle
    required: true,
  },
  paymentMethod: {
    type: String, // Stripe payment method ID (e.g., card_xxxxxx)
    required: true,
  },
  isActive: {
    type: Boolean, // Indicates whether the subscription is active
    default: true, // Set to true initially
  },
});

module.exports = Subscription = mongoose.model(
  "Subscription",
  SubscriptionSchema
);
