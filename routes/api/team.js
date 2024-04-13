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
const { default: mongoose } = require("mongoose");
const Eligibility = require("../../models/Eligibility");

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
    userId,
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
    // check if the user eligible to add new team member

    const userEligibilty = await Eligibility.findOne({ userId });
    const teamMembers = userEligibilty.teamMembers;

    if (teamMembers === 0) {
      return res.status(400).json({
        error: "Error",
        message:
          "You are not eligible to add new team member, Kindly check your package details. You can upgrade your package from the packages page",
      });
    }

    const user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({
        error: "Error",
        message: "User already exists",
      });
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

    // after adding new user should add increase numberOfEmployees in the business collection +1

    await Business.updateOne(
      { _id: businessId },
      { $inc: { numberOfEmployees: 1 } }
    );

    const business = await Business.findOne({ _id: businessId });

    const businessName = business.businessName;

    await Eligibility.updateOne({ userId }, { $inc: { teamMembers: -1 } });

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
      isBusinessAdmin: userType === "Admin" ? true : false,
      isBusinessPartner: false,
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

// edit team member based on his id
// access   Private needs login token
router.put("/:id", auth, async (req, res) => {
  const { designation, userType, isAuthorized, authority } = req.body;

  // if is Authorized is true then we will check authority array and add the new authority to it
  // authority coming from the front end is an array of strings
  // if isAuthorized is false then we will check authority array and remove the authority from it
  // authority coming from the front end is an array of strings
  // finally if isAuthorized we will return unique values in the authority array

  try {
    const user = await User.findOne({ _id: req.params.id });

    if (isAuthorized) {
      const newAuthority = [...user.authority, ...authority];
      const uniqueAuthority = [...new Set(newAuthority)];
      await User.updateOne(
        { _id: req.params.id },
        {
          $set: {
            designation,
            userType,
            isAuthorized,
            authority: uniqueAuthority,
          },
        }
      );
    } else {
      const newAuthority = user.authority.filter(
        (auth) => !authority.includes(auth)
      );
      await User.updateOne(
        { _id: req.params.id },
        {
          $set: {
            designation,
            userType,
            isAuthorized,
            authority: newAuthority,
          },
        }
      );
    }

    res
      .status(200)
      .json({ message: `User ${user.userName} updated Successfully` });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

// delete team member based on his id
// access   Private needs login token
router.delete("/:id", auth, async (req, res) => {
  try {
    await User.deleteOne({ _id: req.params.id });

    // after deleting user should decrease numberOfEmployees in the business collection -1

    const userBusiness = await BusinessUsers.findOne({ userId: req.params.id });

    await Business.updateOne(
      { _id: userBusiness.businessId },
      { $inc: { numberOfEmployees: -1 } }
    );

    await BusinessUsers.deleteOne({ userId: req.params.id });

    res.status(200).json({ message: "User deleted Successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

module.exports = router;
