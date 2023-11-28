const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProductTargetSchema = new Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "product",
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "business",
  },
  target: [
    {
      year: {
        type: Number, // Store the year as a number
        required: true,
        default: new Date().getFullYear(),
      },
      totalUnits: {
        type: Number,
        required: true,
      },
      totalValue: {
        type: Number,
        required: true,
      },

      yearTarget: [
        {
          month: {
            type: String,
            required: true,
          },

          targetUnits: {
            type: Number,
            required: true,
          },
          productPrice: {
            type: Number,
            required: true,
          },
          targetValue: {
            type: Number,
            required: true,
          },
          phasing: {
            type: Boolean,
          },
          phasingData: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "phasing",
          },
          targetPhases: {
            type: String,
          },
          startPeriod: {
            type: Date,
            default: Date.now,
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
        },
      ],
    },
  ],
  currencyCode: {
    type: String,
  },
  currencyName: {
    type: String,
  },
  currencySymbol: {
    type: String,
  },
});

module.exports = ProductTarget = mongoose.model(
  "productTarget",
  ProductTargetSchema
);
