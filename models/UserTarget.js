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

  productsTargets: [
    {
      year: {
        type: Number,
        required: true,
      },
      target: [
        {
          productId: {
            type: mongoose.Types.ObjectId,
            required: true,
            ref: "product",
          },
          targetUnits: {
            type: Number,
            required: true,
          },
          targetValue: {
            type: Number,
            required: true,
          },
        },
      ],
    },
  ],
});

module.exports = UserTarget = mongoose.model("userTarget", UserTargetSchema);
