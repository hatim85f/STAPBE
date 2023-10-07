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

router.post("/", auth, async (req, res) => {
  const {
    userId,
    packageId,
    type,
    payment,
    autoRenew,
    lastFourDigits,
    savePaymentMethod,
    token, // Token from Stripe Elementsear,
    nextBillingDate,
  } = req.body;

  try {
    // Find the package based on packageId
    const package = await Package.findOne({ _id: packageId });

    // Find the user based on email
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(400).json({
        error: "User not found, please create an account first to subscribe",
      });
    }

    // Find the customer in Stripe
    const oldCustomer = await stripe.customers.list({ email: user.email });

    let customer;

    // If there is no existing customer, create a new one
    if (oldCustomer.data.length === 0) {
      customer = await stripe.customers.create({
        email: user.email,
        name: user.userName,
      });
      await stripe.paymentMethods.attach(token, { customer: customer.id });

      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: token,
        },
      });
    } else {
      // If there is an existing customer, attach the new payment method

      await stripe.paymentMethods.attach(token, {
        customer: oldCustomer.data[0].id,
      });
      await stripe.customers.update(oldCustomer.data[0].id, {
        invoice_settings: {
          default_payment_method: token,
        },
      });

      customer = oldCustomer.data[0];
    }

    const existingSubscription = await Subscription.findOne({
      customer: userId,
      package: packageId,
      isActive: true,
    });

    if (existingSubscription) {
      return res.status(400).json({
        error: "Error",
        message: "You already have an active subscription",
      });
    }

    // Check if a payment for the same package has already been made
    const existingPayment = await Payment.findOne({
      user: userId,
      package: packageId,
    });

    if (existingPayment) {
      return res.status(400).json({
        error: "Error",
        message: "You have already made a payment for this package",
      });
    }

    // Create a subscriction in Stripe
    let subscriptionId;
    if (autoRenew) {
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price:
              type === "Monthly"
                ? package.stripeMonthlyPriceId
                : package.stripeYearlyPriceId,
          },
        ],
      });

      subscriptionId = subscription.id;

      // Create a new subscription in the database
      const newSubscription = new Subscription({
        customer: user._id,
        package: package._id,
        subscriptionId: subscriptionId,
        billingPeriod: type,
        price: payment,
        nextBillingDate: nextBillingDate,
        paymentMethod: "card",
        isActive: true,
      });

      await Subscription.insertMany(newSubscription);
    }
    // Create new membership
    const newMembership = new MemberShip({
      user: user._id,
      package: package._id,
      subscriptionId: subscriptionId,
      startDate: new Date(),
      endDate:
        type === "Monthly"
          ? new Date(new Date().setMonth(new Date().getMonth() + 1))
          : new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      autoRenew: autoRenew,
      isActive: true,
      payments: [
        { amount: payment, paymentDate: new Date(), paymentMethod: "card" },
      ],
      savePaymentMethod: savePaymentMethod,
      lastFourDigits: lastFourDigits,
    });

    await MemberShip.insertMany(newMembership);

    const newPayment = new Payment({
      user: user._id,
      package: package._id,
      amount: payment,
      paymentDate: new Date(),
      paymentMethod: "card",
    });

    await Payment.insertMany(newPayment);

    res.status(200).json({
      message: "Membership created successfully",
      membership: newMembership,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      error: "Error",
      message: error.message,
    });
  }
});

// Create a POST endpoint to handle incoming Stripe webhook events
router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const payload = req.body;
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    } catch (error) {
      console.log(error.message);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    console.log("event", event);
    console.log("event.type", event.type);
    console.log("event.data", event.data.object);
    consolelog("event.data.object.id", event.data.object.id);
  }
);

router.post("/pm", async (req, res) => {
  try {
    const paymentMethod = await stripe.paymentMethods.attach(
      "pm_1NyffWFVXCexVcTOl4sowfvL",
      { customer: "cus_OlsGTqNH4Hmk8f" }
    );

    return res.status(200).send({ paymentMethod: paymentMethod });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
