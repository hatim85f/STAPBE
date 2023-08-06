const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TeamSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "business",
  },
  members: [
    {
      type: mongoose.Types.ObjectId,
      ref: "user",
    },
  ],
  ownerId: {
    type: mongoose.Types.ObjectId,
    ref: "user",
  },
});

module.exports = Team = mongoose.model("team", TeamSchema);
