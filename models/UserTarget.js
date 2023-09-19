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

  productTargets: [
    {
      productTargetId: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "productTarget",
      },
      targetPercentage: {
        type: Number,
        required: true,
      },
    },
  ],
});

module.exports = UserTarget = mongoose.model("userTarget", UserTargetSchema);
