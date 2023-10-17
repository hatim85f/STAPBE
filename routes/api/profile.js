const express = require("express");
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const { default: mongoose } = require("mongoose");
const router = express.Router();
const moment = require("moment");
const sgMail = require("@sendgrid/mail");
const VerifyEmail = require("../../models/VerifyEmail");
const config = require("config");
const Subscription = require("../../models/Subscription");

const mailApi =
  process.env.NODE_ENV === "production"
    ? process.env.Mail_API_Key
    : config.get("Mail_API_Key");

const stripeSecretKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY
    : config.get("STRIPE_SECRET_KEY");

const stripe = require("stripe")(stripeSecretKey);

// @route   GET api/profile
// @desc    Test route
// @access  Public

// get user profile
// userName, phone, email, designation, phoneVerified, mailVerified, from users collection
// number of businesses, and details of businesses from businesses collection
// number of team members, from businessUsers collection
router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const userProfile = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "businessusers",
          localField: "_id",
          foreignField: "userId",
          as: "user_business",
        },
      },
      {
        $lookup: {
          from: "businesses",
          localField: "user_business.businessId",
          foreignField: "_id",
          as: "business",
        },
      },
      {
        $lookup: {
          from: "memberships",
          localField: "_id",
          foreignField: "user",
          as: "membership",
        },
      },
      {
        $lookup: {
          from: "eligibilities",
          localField: "_id",
          foreignField: "userId",
          as: "eligibility",
        },
      },
      {
        $lookup: {
          from: "packages",
          localField: "membership.package",
          foreignField: "_id",
          as: "package",
        },
      },

      {
        $project: {
          _id: 1,
          userName: 1,
          isBusinessOwner: "user_business.isBusinessOwner",
          profilePicture: 1,
          phone: 1,
          email: 1,
          designation: 1,
          phoneVerified: 1,
          emailVerified: 1,
          business: 1,
          numberOfBusinesses: { $size: "$business" },
          isActivated: 1,
          biometricEnabled: 1,
          membershipStart: { $arrayElemAt: ["$membership.startDate", 0] },
          membershipEnd: { $arrayElemAt: ["$membership.endDate", 0] },
          membershipIsActive: { $arrayElemAt: ["$membership.isActive", 0] },
          eligibleBusinesses: { $arrayElemAt: ["$eligibility.businesses", 0] },
          eligibleEmployees: { $arrayElemAt: ["$eligibility.teamMembers", 0] },
          eligibleAdmins: { $arrayElemAt: ["$eligibility.admins", 0] },
          eligibleProducts: { $arrayElemAt: ["$eligibility.products", 0] },
          eligibleClients: { $arrayElemAt: ["$eligibility.clients", 0] },
          packageName: { $arrayElemAt: ["$package.name", 0] },
          backgroundColor: { $arrayElemAt: ["$package.backgroundColor", 0] },
        },
      },
    ]);

    // get user stripe subscription details using user.email

    const stripeUser = await stripe.customers.list({
      email: userProfile[0].email,
    });

    let stripeSubscription = null;

    if (stripeUser.data.length > 0) {
      stripeSubscription = await stripe.subscriptions.list({
        customer: stripeUser.data[0].id,
      });
    }

    let subscriptionIds = [];

    if (stripeSubscription) {
      subscriptionIds = stripeSubscription.data.map((sub) => sub.id);
    }

    return res.status(200).json({ userProfile, subscriptionIds });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// verifying user email
// will send him an email with a code to verify

// @route   POST api/profile/verifyEmail
// @desc    Test route
// @access  Private

router.post("/verifyEmail", auth, async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await User.findOne({ _id: userId });

    const userEmail = user.email;

    const verifyingCode = Math.floor(1000 + Math.random() * 9000).toString();

    // // send email to user
    sgMail.setApiKey(mailApi);

    // Send the email with SendGrid
    const msg = {
      to: userEmail,
      from: "info@stap-crm.com",
      templateId: "d-d2cf2a8fa1e04b76b50b4fa43e46ba9a", // Your dynamic template ID
      dynamicTemplateData: {
        user_name: user.userName, // Replace with your user's name field
        reset_code: verifyingCode,
        code_requested: moment(new Date()).format("DD/MM/YYYY hh:mm a"),
      },
    };

    await sgMail.send(msg);

    const verification = new VerifyEmail({
      userId: userId,
      verifyCode: verifyingCode,
      verifyCodeExpiration: moment(new Date())
        .add(1, "hours")
        .format("DD/MM/YYYY hh:mm a"),
    });

    await VerifyEmail.insertMany(verification);

    return res
      .status(200)
      .json({ message: `An Email sent to ${userEmail} with a code` });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// @route   POST api/profile/confirmeEmail
// @desc    Test route
// @access  Private
router.post("/confirmEmail", auth, async (req, res) => {
  const { code, userId } = req.body;

  try {
    // check if the code is valid and not expired
    const verification = await VerifyEmail.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      verifyCode: code,
      verifyCodeExpiration: {
        $gte: moment(new Date()).format("DD/MM/YYYY hh:mm a"),
      },
    });

    if (!verification) {
      return res.status(400).json({ message: "Invalid code" });
    }

    // update user emailVerified to true
    await User.updateMany({ _id: userId }, { $set: { emailVerified: true } });

    // delete the verification code
    await VerifyEmail.deleteMany({ userId: userId });

    return res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// creating a verification code for phone number
// @route   POST api/profile/verifyPhone
// @desc    Test route
// @access  Private
router.post("/verifyPhone", auth, async (req, res) => {
  const { userId } = req.body;

  try {
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// get if user email is verified

router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;
});

module.exports = router;
