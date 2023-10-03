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

const stripPublishableKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_PUBLISHABLE_KEY
    : config.get("STRIPE_PUBLISHABLE_KEY");

const stripe = require("stripe")(stripeSecretKey);
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
    token, // Token from Stripe Elements
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

    return res.status(200).json({ user, package, email });
    // Validate card information using Stripe
    const cardValidation = await stripe.paymentMethods.create({
      type: "card",
      card: {
        number: cardNumber,
        exp_month: expiryMonth,
        exp_year: expiryYear,
        cvc: cvc,
      },
    });

    // create token for payment
    const token = await stripe.paymentMethods.create({
      type: "card",
      card: {
        number: cardNumber,
        exp_month: expiryMonth,
        exp_year: expiryYear,
        cvc: cvc,
      },
    });

    if (!cardValidation || cardValidation.error) {
      return res.status(400).json({
        error: "Card validation failed. Please check your card details.",
      });
    }

    // Create a customer in Stripe (you can use an existing customer if you have one)
    const customer = await stripe.customers.create({
      email: email,
      name: user.userName,
      source: token, // Attach the token from Stripe Elements
    });

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
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
    console.error(error);
    return res.status(500).json({
      error: "Error",
      message: "Something went wrong, please try again",
    });
  }
});

module.exports = router;
