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

router.put("/", async (req, res) => {
  try {
    const memberships = await Membership.find().exec();

    return res.status(200).send({ memberships: memberships });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

router.delete("/", async (req, res) => {
  const { userId, subscriptionId } = req.body;

  try {
    // return res.status(200).send({ subscriptionId });
    // cancel stripe subscription
    // await stripe.subscriptions.del(subscriptionId);

    await Subscription.deleteOne({ customer: userId });
    await MemberShip.deleteOne({ user: userId });
    await Payment.deleteOne({ user: userId });

    return res.status(200).send({ message: "Subscription cancelled" });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

router.put("/clients/:personInHandleId", async (req, res) => {
  const { personInHandleId } = req.params;

  try {
    const user = await User.findOne({ _id: personInHandleId }).exec();
    const clients = await Client.updateMany(
      {
        personInHandle: personInHandleId,
      },
      {
        $set: {
          personInHandle: user.userName,
          personInHandleId: user._id,
        },
      }
    );

    return res.status(200).send({ clients: clients });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// packageId,
// type,
// payment,
// autoRenew,
// "4242",
// savePayment,
// paymentId,
// endDate

module.exports = router;
