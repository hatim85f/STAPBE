const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TargetSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  team: {
    type: mongoose.Types.ObjectId,
    ref: "team",
  },
  ownerId: {
    type: mongoose.Types.ObjectId,
    ref: "user",
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "business",
  },
  target: [
    {
      type: mongoose.Types.ObjectId,
      ref: "productTarget",
    },
  ],
});

module.exports = Target = mongoose.model("target", TargetSchema);
