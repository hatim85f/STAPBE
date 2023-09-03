const express = require("express");
const router = express.Router();
const config = require("config");
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");
const Business = require("../../models/Business");

const mailApi =
  process.env.NODE_ENV === "production"
    ? process.env.Mail_API_Key
    : config.get("Mail_API_Key");

const setcretToken =
  process.env.NODE_ENV === "production"
    ? process.env.jwtSecret
    : config.get("jwtSecret");

// the router will be handling just collecting team data
// creating new team member
// updating team member
// deleting team member
// getting team member
// getting all team members

// creating new team member
// access   Private needs login token
router.post("/", auth, async (req, res) => {
  const {
    email,
    password,
    userName,
    firstName,
    lastName,
    phone,
    designation,
    userType,
    businessId,
    invitor,
    invitorDesignation,
    url,
  } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user) {
      return res
        .status(400)
        .json({ error: "Error", message: "User already exists" });
    }

    const newUser = new User({
      email,
      password,
      userName,
      firstName,
      lastName,
      phone,
      designation,
      userType,
    });

    const payload = {
      user: {
        id: newUser.id,
      },
    };

    const salt = await bcrypt.genSalt(10);

    newUser.password = await bcrypt.hash(password, salt);

    await User.insertMany(newUser);

    const business = await Business.findOne({ _id: businessId });

    const businessName = business.businessName;

    sgMail.setApiKey(mailApi);

    // Send the email with SendGrid
    const msg = {
      to: email,
      from: "info@stap-crm.com",
      templateId: "d-34b19fe8848e45c3ad08d9fabcaaf9f1", // Your dynamic template ID
      dynamicTemplateData: {
        user_name: firstName + " " + lastName, // Replace with your user's name field
        user_email: email,
        password: password,
        url: url,
        invitor: invitor,
        invitor_designation: invitorDesignation,
        business_name: businessName,
      },
    };

    await sgMail.send(msg);

    // update userBusinesses collection

    const newUserBusiness = new BusinessUsers({
      businessId,
      userId: newUser._id,
      isBusinessOwner: false,
    });

    await BusinessUsers.insertMany(newUserBusiness);

    jwt.sign(payload, setcretToken, (error, token) => {
      if (error) throw error;
      res.json({
        message: `User ${userName} created Successfully and we sent an email to ${email} with temporary password`,
      });
    });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
