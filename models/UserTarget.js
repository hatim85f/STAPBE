const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserTargetSchema = new Schema({
  _id: mongoose.Types.ObjectId,
  userId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "user",
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "business",
  },
  targetPercentage: {
    type: Number,
    required: true,
  },
  startPeriod: {
    type: Date,
    required: true,
  },
  endPeriod: {
    type: Date,
    required: true,
  },
  addedIn: {
    type: Date,
    default: Date.now,
  },
  updatedIn: {
    type: Date,
    default: Date.now,
  },
  productTargets: [
    {
      productTargetId: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "productTarget",
      },
    },
  ],
});

module.exports = UserTarget = mongoose.model("userTarget", UserTargetSchema);
