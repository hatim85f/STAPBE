const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PackageSchema = Schema({
  name: {
    type: String,
    required: true,
  },
  subTitle: {
    type: String,
    required: true,
  },
  backgroundColor: {
    type: String,
    required: true,
  },
  price: {
    monthly: {
      type: Number,
      required: true,
    },
    yearly: {
      type: Number,
      required: true,
    },
  },
  limits: {
    businesses: {
      type: Number,
      required: true,
    },
    valuePerBusiness: {
      type: Number,
      required: true,
    },
    teamMembers: {
      type: Number,
      required: true,
    },
    admins: {
      type: Number,
      required: true,
    },
    products: {
      type: Number,
      required: true,
    },
    clients: {
      type: Number,
      required: true,
    },
  },
  features: {
    visualizedReport: {
      type: [String], // Use an array of strings for multiple options
      required: true,
    },
    inventory: Boolean,
    manufacturingManagement: Boolean,
    supplyChainManagement: Boolean,
    marketingManagement: Boolean,
    invoicing: Boolean,
    paymentLinkCreation: Boolean,
    salesManagement: Boolean,
    crm: Boolean,
    teamTarget: Boolean,
    productsTarget: Boolean,
  },
  prices: {
    businessOwner: {
      type: Number,
      required: true,
    },
    teamMember: {
      type: Number,
      required: true,
    },
    admin: {
      type: Number,
      required: true,
    },
  },
  totalMonthlyPrice: {
    type: Number,
    required: true,
  },
  totalYearlyPrice: {
    type: Number,
    required: true,
  },
  isAvailable: {
    type: Boolean,
    required: true,
  },
  stripeProductId: {
    type: String,
  },
  stripeMonthlyPriceId: {
    type: String,
  },
  stripeYearlyPriceId: {
    type: String,
  },
});

module.exports = Package = mongoose.model("package", PackageSchema);
