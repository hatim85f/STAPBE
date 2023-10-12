const express = require("express");
const auth = require("../../middleware/auth");
const MemberShip = require("../../models/MemberShip");
const config = require("config");
const User = require("../../models/User");
const Package = require("../../models/Package");
const Subscription = require("../../models/Subscription");
const Payment = require("../../models/Payment");
const router = express.Router();
const sgMail = require("@sendgrid/mail");
const moment = require("moment");

const stripeSecretKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY
    : config.get("STRIPE_SECRET_KEY");

const mailApi =
  process.env.NODE_ENV === "production"
    ? process.env.Mail_API_Key
    : config.get("Mail_API_Key");

const stripe = require("stripe")(stripeSecretKey);

// create a payment intent and getting client secret
router.post("/create-payment-intent", async (req, res) => {
  const { amount, currency, paymentMethodType, userId, packageId } = req.body;

  try {
    // Find the user based on userId and exclude the password field
    const user = await User.findOne({ _id: userId }).select("-password");

    // Retrieve the customer's Stripe information using their email
    const stripeCustomer = await stripe.customers.list({ email: user.email });

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
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

//create payment intent for subscription mobile only
// as per paymentsheet we are creating payment intent here and then we will confirm payment intent
router.post("/create-mobile-payment-intent", async (req, res) => {
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

    // Create a subscriction in Stripe
    let ourSubscriptionId = null;
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
        default_payment_method: setupIntent.payment_method,
        collection_method: "send_invoice",
        days_until_due: type === "Monthly" ? 30 : 365,
      });

      subscriptionId = subscription.id;

      // Create a new subscription in the database
      const newSubscription = new Subscription({
        customer: user._id,
        package: package._id,
        subscriptionId: subscriptionId, // stripe subscription id
        billingPeriod: type,
        price: payment,
        nextBillingDate: nextBillingDate,
        paymentMethod: "card",
        isActive: true,
      });

      await Subscription.insertMany(newSubscription);

      const newSubscriptionId = await Subscription.findOne({
        customer: user._id,
        package: package._id,
        subscriptionId: subscription.id,
      });

      ourSubscriptionId = newSubscriptionId._id;
    }
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
      isSubscription: autoRenew,
      subscriptionId: ourSubscriptionId, // our subscription id from database
    });

    await MemberShip.insertMany(newMembership);

    const newPayment = new Payment({
      user: user._id,
      subscription: ourSubscriptionId,
      membership: newMembership._id,
      package: package._id,
      amount: payment,
      paymentDate: new Date(),
      paymentMethod: "card",
    });

    await Payment.insertMany(newPayment);

    sgMail.setApiKey(mailApi);

    // Send the email with SendGrid
    const msg = {
      to: user.email,
      from: "info@stap-crm.com",
      templateId: "d-1c4b351bf0c34c66910d2bae9e3b5db1", // Your dynamic template ID
      dynamicTemplateData: {
        userName: user.userName,
        package_name: package.name,
        businesses_number: package.limits.businesses,
        payment: payment,
        type: type,
        start_date: moment(new Date()).format("DD/MM/YYYY"),
        end_date: nextBillingDate,
        next_billing_date: nextBillingDate,
      },
    };

    await sgMail.send(msg);

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

// create subscription and add details to database mobile only
// as per paymentsheet we did create payment intent previously and now we are confirming subscription in case of autroRenew === true
// the function is taking stripe customer last4 digits and add to database
// adding the subscription details to database and stripe

router.post("/create-subscription", auth, async (req, res) => {
  const {
    userId,
    packageId,
    type,
    payment,
    autoRenew,
    savePaymentMethod,
    nextBillingDate,
  } = req.body;

  try {
    const user = await User.findOne({ _id: userId }).select("-password");

    const stripeCustomer = await stripe.customers.list({ email: user.email });

    const package = await Package.findOne({ _id: packageId });

    const paymentMethod = await stripe.paymentMethods.list({
      customer: stripeCustomer.data[0].id,
      type: "card",
    });

    let ourSubscriptionId = null;
    let subscriptionId;
    if (autoRenew) {
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomer.data[0].id,
        items: [
          {
            price:
              type === "Monthly"
                ? package.stripeMonthlyPriceId
                : package.stripeYearlyPriceId,
          },
        ],
        default_payment_method: paymentMethod.data[0].id,
        collection_method: "send_invoice",
        days_until_due: type === "Monthly" ? 30 : 365,
      });

      subscriptionId = subscription.id;

      const newSubscription = new Subscription({
        customer: user._id,
        package: package._id,
        subscriptionId: subscription.id, // stripe subscription id
        billingPeriod: type,
        price: payment,
        nextBillingDate: nextBillingDate,
        paymentMethod: "card",
        isActive: true,
      });

      await Subscription.insertMany(newSubscription);

      // get the new created subscription ID

      const newSubscriptionId = await Subscription.findOne({
        customer: user._id,
        package: package._id,
        subscriptionId: subscription.id,
      });

      ourSubscriptionId = newSubscriptionId._id;
    }

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
      lastFourDigits: paymentMethod.data[0].card.last4,
      isSubscription: autoRenew,
      subscriptionId: ourSubscriptionId, // our subscription id from database
    });

    await MemberShip.insertMany(newMembership);

    const newPayment = new Payment({
      user: user._id,
      subscription: ourSubscriptionId, // our subscription id from database
      membership: newMembership._id,
      package: package._id,
      amount: payment,
      paymentDate: new Date(),
      paymentMethod: "card",
    });

    await Payment.insertMany(newPayment);

    sgMail.setApiKey(mailApi);

    // Send the email with SendGrid
    const msg = {
      to: user.email,
      from: "info@stap-crm.com",
      templateId: "d-1c4b351bf0c34c66910d2bae9e3b5db1", // Your dynamic template ID
      dynamicTemplateData: {
        userName: user.userName,
        package_name: package.name,
        businesses_number: package.limits.businesses,
        payment: payment,
        type: type,
        start_date: moment(new Date()).format("DD/MM/YYYY"),
        end_date: nextBillingDate,
        next_billing_date: nextBillingDate,
      },
    };

    await sgMail.send(msg);

    return res.status(200).send({ message: "Membership Created Successfully" });
  } catch (error) {
    return res.status().send({ error: "error", message: error.message });
  }
});

// user node-scheduler to check if subscription is active or not
// grap all the subscriptions for all users from stripe and check if subscription is active or not
// get the subscriptions from database as well and comapare them to check if they are active or not
// then update the backend if there is any chages

module.exports = router;
