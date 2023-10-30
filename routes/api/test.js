const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const Business = require("../../models/Business");
const { default: mongoose } = require("mongoose");
const Products = require("../../models/Products");
const config = require("config");
const createStripeSignatureHeader = require("../../modules/createStripeSignatureHeader");
const bodyParser = require("body-parser");
const Package = require("../../models/Package");
const moment = require("moment");
const Subscription = require("../../models/Subscription");
const MemberShip = require("../../models/MemberShip");
const Payment = require("../../models/Payment");
const Client = require("../../models/Client");

const stripeSecretKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY
    : config.get("STRIPE_SECRET_KEY");

const endpointSecret =
  process.env.NODE_ENV === "production"
    ? process.env.WEBHOOK_SECRET
    : config.get("DEVELOPMENT_WEBHOOK_SECRET");

const stripePublishableKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_PUBLISHABLE_KEY
    : config.get("STRIPE_PUBLISHABLE_KEY");

const stripe = require("stripe")(stripeSecretKey);

router.get("/", auth, async (req, res) => {
  res.status(200).send("API Running");
});

router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const neededBusiness = await BusinessUsers.findOne({ userId: userId });
    const businessId = neededBusiness.businessId;

    const products = await Products.find({ businessId: businessId });

    return res.status(200).send({ products, businessId });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
