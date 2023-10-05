const express = require("express");
const auth = require("../../middleware/auth");
const MemberShip = require("../../models/MemberShip");
const config = require("config");
const User = require("../../models/User");
const Package = require("../../models/Package");
const Subscription = require("../../models/Subscription");
const Payment = require("../../models/Payment");
const router = express.Router();

const stripeSecretKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY
    : config.get("STRIPE_SECRET_KEY");

// const stripPublishableKey =
//   process.env.NODE_ENV === "production"
//     ? process.env.STRIPE_PUBLISHABLE_KEY
//     : config.get("STRIPE_PUBLISHABLE_KEY");

const stripe = require("stripe")(stripeSecretKey);

// create a payment intent and getting client secret
router.post("/create-payment-intent", async (req, res) => {
  const { amount, currency, paymentMethodType } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: currency,
      payment_method_types: [paymentMethodType],
    });
    return res.status(200).send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// ... (Other code remains the same)

// @route   POST api/membership
// @desc    Create new membership
// @access  Private
// Handle payment first using Stripe Elements and then create membership
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

    // Create a customer in Stripe (you can use an existing customer if you have one)
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.userName,
      source: token, // Attach the token from Stripe Elements
    });

    const existingSubscription = await Subscription.findOne({
      customer: userId,
      package: packageId,
      isActive: true,
    });

    if (existingSubscription) {
      return res.status(400).json({
        error: "User already has an active subscription for this package",
      });
    }

    // Check if a payment for the same package has already been made
    const existingPayment = await Payment.findOne({
      user: userId,
      package: packageId,
    });

    if (existingPayment) {
      return res.status(400).json({
        error: "Payment for this package has already been processed",
      });
    }

    // Create a payment intent
    await stripe.paymentIntents.create({
      amount: Math.round(payment * 100), // Convert to cents
      currency: "usd", // Change to your desired currency code
      customer: customer.id,
      description: `Payment for package ${package.name}`,
    });

    const priceId =
      type === "Monthly"
        ? package.stripeMonthlyPriceId
        : package.stripeYearlyPriceId;

    // return res.status(200).json({
    //   clientSecret: paymentIntent.client_secret,
    //   priceId: priceId,
    //   paymentIntentId: paymentIntent.id,
    // });

    if (autoRenew) {
      // Create a subscriction in Stripe
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price: priceId,
          },
        ],
      });

      // Save the subscription ID to your database so you can retrieve it later
      const subscriptionId = subscription.id;

      // Create a new subscription in your database (e.g., in MongoDB)
      const newSubscription = new Subscription({
        customer: user._id,
        package: package._id,
        subscriptionId: subscriptionId,
        billingPeriod: type,
        price: payment,
        nextBillingDate: new Date(),
        paymentMethod: "card",
        isActive: true,
      });

      await Subscription.insertMany(newSubscription);
    }

    // Create a new payment in database (e.g., in MongoDB)
    const newPayment = new Payment({
      user: user._id,
      subscription: null,
      amount: payment,
      paymentMethod: "card",
    });

    // Save the payment to database
    await Payment.insertMany(newPayment);

    // Create new membership
    const newMembership = new MemberShip({
      user: user._id,
      package: package._id,
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

    res.status(200).json({
      message: "Membership created successfully",
      membership: newMembership,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      error: "Error",
      message: "Something went wrong, please try again",
    });
  }
});

module.exports = router;
