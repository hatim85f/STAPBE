const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PricingSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  name: {
    type: String,
    required: true,
  },
  businesses: {
    types: Number,
  },
  team_members: {
    type: Number,
  },
  admins: {
    type: Number,
  },
  clients: {
    type: Number,
  },

  visualized_report: {
    type: Array,
  },
  inventory: {
    type: Boolean,
    default: false,
  },
  manufacturing_management: {
    type: Boolean,
    default: false,
  },
  supply_chain_management: {
    type: Boolean,
    default: false,
  },
  marketing_management: {
    type: Boolean,
    default: false,
  },
  invoicing: {
    type: Boolean,
    default: false,
  },
  payment_link_creation: {
    type: Boolean,
    default: false,
  },
  sales_management: {
    type: Boolean,
    default: false,
  },
  crm: {
    type: Boolean,
    default: false,
  },
  team_target: {
    type: Boolean,
    default: false,
  },
  products_target: {
    type: Boolean,
    default: false,
  },
  business_owner_price: {
    type: Number,
  },
  team_member_price: {
    type: Number,
  },
  admin_price: {
    type: Number,
  },
});

module.exports = Pricing = mongoose.model("pricing", PricingSchema);
