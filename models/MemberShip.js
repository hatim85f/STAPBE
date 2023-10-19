const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// applying memberShip schema connected to user
// should contains user id, value, packageName, startDate, endDate

const MembershipSchema = new Schema({
  user: {
    type: mongoose.Types.ObjectId,
    ref: "user",
    required: true,
  },
  package: {
    type: mongoose.Types.ObjectId,
    ref: "package",
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isSubscription: {
    type: Boolean,
    default: false,
  },
  subscriptionId: {
    type: mongoose.Types.ObjectId,
    ref: "subscription",
  },
  // Payment-related fields
  payments: [
    {
      amount: {
        type: Number,
        required: true,
      },
      paymentDate: {
        type: Date,
        required: true,
      },
      paymentMethod: {
        type: String,
        required: true,
      },
      // Add other payment-related fields as needed (e.g., transaction ID, payment status)
    },
  ],
  autoRenew: {
    type: Boolean,
    default: false, // Membership doesn't auto-renew by default
  },
  lastFourDigits: {
    type: String, // Store last 4 digits of the card
  },
  savePaymentMethod: {
    type: Boolean,
    default: false, // Do not save payment method by default
  },
  cancelledAttheEndOfBillingCycle: {
    type: Boolean,
    default: false, // Do not cancel at the end of billing cycle by default
  },
});

module.exports = Membership = mongoose.model("membership", MembershipSchema);
