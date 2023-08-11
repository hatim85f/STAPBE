const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
  _id: mongoose.Types.ObjectId,
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "business",
    required: true,
  },
  userId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "user",
  },
  clientId: {
    type: mongoose.Types.ObjectId,
    required: true,
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    required: true,
  },
  status: {
    type: String,
    enum: ["Pending", "In Progress", "Completed", "Cancelled"],
    default: "Pending",
  },
  // Additional fields as needed
});

module.exports = Order = mongoose.model("order", OrderSchema);
