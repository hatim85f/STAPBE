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

router.get("/publishable-key", async (req, res) => {
  res.status(200).send({ publishKey: stripePublishableKey });
});

// change this code to match nodejs
// private static class CreatePaymentIntentRequest {
//   @SerialzedName("currency")
//   String paymentMethodType;

//   public String getCurrency() {
//     return paymentMethodType;
//   }
// }

// create a payment intent
router.post("/create-payment-intent", async (req, res) => {
  const { amount, currency, paymentMethodType } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: currency,
      payment_method_types: [paymentMethodType],
      // automatic_payment_methods: { enabled: true },
      setup_future_usage: "on_session",
    });

    return res.status(200).send(paymentIntent);
    return res.status(200).send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

router.post("/date", async (req, res) => {
  try {
    const { date } = req.body;
    const dateInLocalTimezone = moment(date, "DD/MM/YYYY");

    // Convert the local date to a Unix timestamp
    const unixTimestamp = dateInLocalTimezone.unix();

    return res.status(200).send({ unixTimestamp });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
