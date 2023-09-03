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

// @route    GET api/team/:userId
// @desc     Get team member by userId
// @access   Private needs login token
router.get("/:userId", auth, async (req, res) => {
  const userId = req.params.userId;

  // aggregate the businessUsers collection to get the businessUsers while isBusinessOwner is true
  // then lookup the businessUsers collection to get the isBusinessOwner false
  // then lookup the users collection to get the user details
  // should return [{businessId: businessId, team: [userDetails]}]

  try {
    const team = await BusinessUsers.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isBusinessOwner: true,
        },
      },
      {
        $lookup: {
          from: "businessusers",
          localField: "businessId",
          pipeline: [
            {
              $match: {
                isBusinessOwner: false,
              },
            },
          ],
          foreignField: "businessId",
          as: "team",
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "team.userId",
          foreignField: "_id",
          as: "team",
        },
      },

      {
        $project: {
          businessId: 1,
          team: 1,
        },
      },
    ]);

    return res.status(200).json(team);
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// getting team for selected business
// @route    GET api/team/business/:businessId
// @desc     Get team member by businessId
// @access   Private needs login token
router.get("/business/:businessId", auth, async (req, res) => {
  const businessId = req.params.businessId;

  // aggregate the businessUsers collection to get the businessUsers while isBusinessOwner is false
  // then lookup the users collection to get the user details

  try {
    const businessTeam = await BusinessUsers.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          isBusinessOwner: false,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "team",
        },
      },

      {
        $project: {
          businessId: 1,
          team: 1,
        },
      },
    ]);

    return res.status(200).json(businessTeam);
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

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
      return res.status(400).json({
        error: "Error",
        message: "User with the same email already exists",
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
