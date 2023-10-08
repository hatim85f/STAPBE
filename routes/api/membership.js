const express = require("express");
const auth = require("../../middleware/auth");
const MemberShip = require("../../models/MemberShip");
const config = require("config");
const User = require("../../models/User");
const Package = require("../../models/Package");
const Subscription = require("../../models/Subscription");
const Payment = require("../../models/Payment");
const router = express.Router();
const moment = require("moment");

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
      setup_future_usage: "off_session",
      // automatic_payment_methods: { enabled: true },
      // setup_future_usage: "on_session",
    });

    return res.status(200).send({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
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

      const defaultPaymentMethod =
        oldCustomer.data[0].invoice_settings.default_payment_method;

      if (!defaultPaymentMethod) {
        await stripe.paymentMethods.attach(token, {
          customer: oldCustomer.data[0].id,
        });
        await stripe.customers.update(oldCustomer.data[0].id, {
          invoice_settings: {
            default_payment_method: token,
          },
        });
      } else if (defaultPaymentMethod !== token) {
        await stripe.paymentMethods.detach(defaultPaymentMethod);
        await stripe.paymentMethods.attach(token, {
          customer: oldCustomer.data[0].id,
        });
        await stripe.customers.update(oldCustomer.data[0].id, {
          invoice_settings: {
            default_payment_method: token,
          },
        });
      }

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

    const dateInLocalTimezone = moment(nextBillingDate, "DD/MM/YYYY");

    // Convert the local date to a Unix timestamp
    const unixTimestamp = dateInLocalTimezone.unix();

    // Create a subscriction in Stripe
    let subscriptionId;
    if (autoRenew) {
      const setupIntent = await stripe.setupIntents.create({
        customer: customer.id, // Use the Stripe customer ID if available
        payment_method: token,
      });
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
        billing_cycle_anchor: unixTimestamp,
        payment_behavior: "default_incomplete",
        default_payment_method: setupIntent.payment_method,
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

module.exports = router;
