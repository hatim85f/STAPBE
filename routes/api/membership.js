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
const Eligibility = require("../../models/Eligibility");
const { default: mongoose } = require("mongoose");
const SupportCase = require("../../models/SupportCase");

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

    // check if the customer has any subscription in stripe return if yes
    if (subscriptions.data.length > 0) {
      return res.status(200).send({
        message: `You already have a subscription for the selected package, which will end on ${new Date(
          subscriptions.data[0].current_period_end * 1000
        ).toDateString()}, You need to upgrade or cancel before you can subscribe to a new package`,
      });
    }

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

    const newEligibility = new Eligibility({
      userId: userId,
      packageId: packageId,
      businesses: package.limits.businesses,
      teamMembers: package.limits.teamMembers,
      admins: package.limits.admins,
      products: package.limits.products,
      clients: package.limits.clients,
    });

    await Eligibility.insertMany(newEligibility);

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

    const newEligibility = new Eligibility({
      userId: userId,
      packageId: packageId,
      businesses: package.limits.businesses,
      teamMembers: package.limits.teamMembers,
      admins: package.limits.admins,
      products: package.limits.products,
      clients: package.limits.clients,
    });

    await Eligibility.insertMany(newEligibility);

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

// perfrom a cancel stripe subscription route
// cancel the subscription in stripe and update the subscription in database
// @route   POST api/membership/cancel-subscription
// @desc    cancel subscription
// @access  Private

router.post("/cancel-subscription", auth, async (req, res) => {
  const { userId, stripeSubscriptionId, packageId, userEmail, cencelDetails } =
    req.body;

  try {
    const cencelled = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_immediately: true,
      cancellation_details: cancelDetails,
    });

    await MemberShip.updateMany(
      {
        user: userId,
        package: packageId,
      },
      {
        $set: {
          cancelledAttheEndOfBillingCycle: true,
        },
      }
    );

    await Subscription.updateMany(
      {
        customer: userId,
        package: packageId,
        isActive: true,
      },
      {
        $set: {
          isCancelled: true,
        },
      }
    );
    return res.status(200).send({
      message: "Subscription Canceled Successfully, and will not be renewed",
    });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// perfrom upgrade subscription route
// upgrade the subscription in stripe and update the subscription in database
// @route   POST api/membership/upgrade-subscription
// @desc    upgrade subscription
// @access  Private

router.post("/create-upgrade-intent", auth, async (req, res) => {
  const {
    userId,
    stripeSubscriptionId,
    packageId,
    userEmail,
    oldPackageId,
    type,
  } = req.body;

  try {
    const user = await User.findOne({ _id: userId }).select("-password");
    const stripeCustomer = await stripe.customers.list({ email: user.email });
    const stripeCustomerId = stripeCustomer.data[0].id;

    const oldPackage = await Package.findOne({ _id: oldPackageId });

    const package = await Package.findOne({ _id: packageId });

    const previousDetails = await Payment.aggregate([
      {
        $match: {
          package: new mongoose.Types.ObjectId(oldPackageId),
          user: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "subscription",
          // pipeline: [{ $match: { customer: userId } }],
          foreignField: "_id",
          as: "subscription",
        },
      },
      {
        $project: {
          _id: 1,
          amount: 1,
          paymentDate: 1,
          paymentMethod: 1,
          nextBillingDate: {
            $arrayElemAt: ["$subscription.nextBillingDate", 0],
          },
          membership: 1,
          user: 1,
          billingPeriod: { $arrayElemAt: ["$subscription.billingPeriod", 0] },
        },
      },
    ]);

    // calculate number of days consumed from the old package
    const startDate = new Date(previousDetails[0].paymentDate);
    const today = new Date();

    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const daysConsumed = Math.floor((today - startDate) / millisecondsPerDay);

    const numberOfDays =
      previousDetails[0].billingPeriod === "Monthly" ? 30 : 365;
    const costPerDay = previousDetails[0].amount / numberOfDays;
    const costForDaysConsumed = costPerDay * daysConsumed;
    const totalRefund = previousDetails[0].amount - costForDaysConsumed;

    const newPaymentPrice =
      type === "Monthly" ? package.totalMonthlyPrice : package.totalYearlyPrice;
    const newRequestedPayment = newPaymentPrice - totalRefund;

    // create ephemeral key for the customer for app
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: stripeCustomer.data[0].id },
      { apiVersion: "2020-08-27" }
    );

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomer.data[0].id,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: parseInt(newRequestedPayment).toFixed(0) * 100,
      currency: "usd",
      payment_method_types: ["card"],
      setup_future_usage: "off_session",
      customer: stripeCustomerId,
    });

    return res.status(200).send({
      clientSecret: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: stripeCustomer.data[0].id,
      paymentIntentId: paymentIntent.id,
      totalRefund: totalRefund,
      setupIntent: setupIntent.client_secret,
    });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

router.post("/upgrade-subscription", auth, async (req, res) => {
  const {
    userId,
    packageId,
    type,
    payment,
    autoRenew,
    savePaymentMethod,
    nextBillingDate,
  } = req.body;

  const user = await User.findOne({ _id: userId }).select("-password");

  try {
    const newPlan = await Package.findOne({ _id: packageId });

    const previousSubscription = await Subscription.findOne({
      customer: userId,
      isActive: true,
    });
    const stripeCustomer = await stripe.customers.list({ email: user.email });
    const paymentMethod = await stripe.paymentMethods.list({
      customer: stripeCustomer.data[0].id,
      type: "card",
    });

    const currentSubscriptionDetails = await stripe.subscriptions.retrieve(
      previousSubscription.subscriptionId
    );

    // update eligibility details
    const oldPackage = await Package.findOne({
      _id: previousSubscription.package,
    });
    const oldEligibility = await Eligibility.findOne({
      userId: userId,
      packageId: oldPackage._id,
    });

    const differences = {
      businesses: oldPackage.limits.businesses - oldEligibility.businesses,
      teamMembers: oldPackage.limits.teamMembers - oldEligibility.teamMembers,
      admins: oldPackage.limits.admins - oldEligibility.admins,
      products: oldPackage.limits.products - oldEligibility.products,
      clients: oldPackage.limits.clients - oldEligibility.clients,
    };

    const newEligibility = {
      businesses: newPlan.limits.businesses - differences.businesses,
      teamMembers: newPlan.limits.teamMembers - differences.teamMembers,
      admins: newPlan.limits.admins - differences.admins,
      products: newPlan.limits.products - differences.products,
      clients: newPlan.limits.clients - differences.clients,
    };

    await Eligibility.updateMany(
      { userId: userId, packageId: oldPackage._id }, // Assuming you're updating from the old package
      {
        $set: {
          businesses: newEligibility.businesses,
          teamMembers: newEligibility.teamMembers,
          admins: newEligibility.admins,
          products: newEligibility.products,
          clients: newEligibility.clients,
          packageId: packageId,
        },
      }
    );

    const previouslyPaid = previousSubscription.price;
    const previousPlanType = previousSubscription.billingPeriod;

    // calculate number of days consumed from the old package
    const startDate = moment(currentSubscriptionDetails.created * 1000);
    const today = moment();

    const daysConsumed = today.diff(startDate, "days");

    const numberOfDays = previousPlanType === "Monthly" ? 30 : 365;
    const costPerDay = previouslyPaid / numberOfDays;
    const costForDaysConsumed = costPerDay * daysConsumed;

    const totalRefund = previouslyPaid - costForDaysConsumed;

    let stripeSubscriptionId;

    if (autoRenew) {
      const stripeSubscription = await stripe.subscriptions.update(
        previousSubscription.subscriptionId,
        {
          cancel_at_period_end: false,
          items: [
            {
              price:
                type === "Monthly"
                  ? newPlan.stripeMonthlyPriceId
                  : newPlan.stripeYearlyPriceId,
            },
          ],
          default_payment_method: paymentMethod.data[0].id,
          collection_method: "send_invoice",
          days_until_due: type === "Monthly" ? 30 : 365,
        }
      );
      stripeSubscriptionId = stripeSubscription.id;
    }

    // update membership details
    await MemberShip.updateMany(
      {
        user: userId,
      },
      {
        $set: {
          package: packageId,
          startDate: new Date(),
          endDate:
            type === "Monthly"
              ? new Date(new Date().setMonth(new Date().getMonth() + 1))
              : new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          autoRenew: autoRenew,
          isActive: true,
          // push the payment to payments array

          savePaymentMethod: savePaymentMethod,
          lastFourDigits: paymentMethod.data[0].card.last4,
          isSubscription: autoRenew,
        },
        $push: {
          payments: {
            amount: payment,
            paymentDate: new Date(),
            paymentMethod: "card",
          },
        },
      }
    );

    // update subscription details
    await Subscription.updateMany(
      {
        customer: userId,
      },
      {
        $set: {
          package: packageId,
          subscriptionId: stripeSubscriptionId,
          billingPeriod: type,
          price:
            type === "Monthly"
              ? newPlan.totalMonthlyPrice
              : newPlan.totalYearlyPrice,
          nextBillingDate: nextBillingDate,
          paymentMethod: "card",
          isActive: true,
        },
      }
    );

    // update Payment details
    await Payment.updateMany(
      {
        user: userId,
      },
      {
        $set: {
          package: packageId,
          amount: payment,
          paymentDate: new Date(),
          paymentMethod: "card",
        },
      }
    );

    return res.status(200).send({
      message: `You just upgraded your subscription to ${newPlan.name}`,
    });
  } catch (error) {
    const newSupportCase = new SupportCase({
      userId: userId,
      userName: user.userName,
      phone: user.phone,
      email: user.email,
      subject: "Error in upgrade subscription",
      message: error.message,
      status: "Open",
    });

    const caseId = newSupportCase._id;

    await SupportCase.insertMany(newSupportCase);

    return res.status(500).send({
      error: "Error !",
      message: `Something Went wrong with your payment, please contact our support team at info@stap-crm.com and mention this case id ${caseId}`,
    });
  }
});

module.exports = router;
