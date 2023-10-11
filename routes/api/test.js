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

// @ getting customer details from stripe
// create subscription
// create setupIntent for future payments
router.post("/", auth, async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await User.findOne({ _id: userId }).select("-password");

    const stripeCustomer = await stripe.customers.list({ email: user.email });

    return res.status(200).send({ stripeCustomer: stripeCustomer });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
