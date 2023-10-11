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

router.post("/create-payment-intent", async (req, res) => {
  const { amount, currency, paymentMethodType, userId, packageId } = req.body;

  try {
    // Find the user based on userId and exclude the password field
    const user = await User.findOne({ _id: userId }).select("-password");

    // Retrieve the customer's Stripe information using their email
    const stripeCustomer = await stripe.customers.list({ email: user.email });

    // if stripeCustomer get the payment method id and attach to customer
    if (stripeCustomer.data.length > 0) {
      const paymentMethod = await stripe.paymentMethods.list({
        customer: stripeCustomer.data[0].id,
        type: "card",
      });

      if (paymentMethod.data.length > 0) {
        await stripe.paymentMethods.attach(paymentMethod.data[0].id, {
          customer: stripeCustomer.data[0].id,
        });

        await stripe.customers.update(stripeCustomer.data[0].id, {
          invoice_settings: {
            default_payment_method: paymentMethod.data[0].id,
          },
        });
      }
    }

    // check if current customer, if not create new customer
    if (stripeCustomer.data.length === 0) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.userName,
      });
      stripeCustomer.data.push(customer);
    }

    // Check if the customer has any subscriptions
    if (stripeCustomer.data.length === 0) {
      return res.status(200).send({ packagesSubscribed: [] });
    }

    // Retrieve the customer's subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomer.data[0].id,
    });

    // Check if there is a subscription for the specified packageId
    for (const subscription of subscriptions.data) {
      const package = await Package.findOne({
        stripeProductId: subscription.items.data[0].price.product,
      });
      if (package && package._id.toString() === packageId) {
        // Subscription for the same package found
        const endDate = subscription.current_period_end;
        return res.status(200).send({
          message: `You already have a subscription for the selected package, which will end on ${new Date(
            endDate * 1000
          ).toDateString()}`,
        });
      }
    }

    // create ephemeral key for the customer for app
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: stripeCustomer.data[0].id },
      { apiVersion: "2020-08-27" }
    );

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomer.data[0].id,
    });

    // If no subscription for the specified packageId is found, create the paymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: currency,
      payment_method_types: ["card"],
      setup_future_usage: "off_session",
      customer: stripeCustomer.data[0].id,
    });

    return res.status(200).send({
      clientSecret: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: stripeCustomer.data[0].id,
      paymentIntentId: paymentIntent.id,
      setupIntent: setupIntent.client_secret,
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
