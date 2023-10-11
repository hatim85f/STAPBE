const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const auth = require("../../middleware/auth");
const jwt = require("jsonwebtoken");
const config = require("config");
const { check, validationResult } = require("express-validator");
const User = require("../../models/User");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");
const ResetPassword = require("../../models/ResetPassword");
const moment = require("moment/moment");
const Biometrics = require("../../models/Biometrics");

const mailApi =
  process.env.NODE_ENV === "production"
    ? process.env.Mail_API_Key
    : config.get("Mail_API_Key");
const setcretToken =
  process.env.NODE_ENV === "production"
    ? process.env.jwtSecret
    : config.get("jwtSecret");

// getting user profile
// access   Private needs login token
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email }).select(
      "-password"
    );
    res.status(201).json({ user });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

//@route    POST api/auth
//@des      Authenticate users and get the token
//@access   Public
router.post(
  "/",
  [
    check("email", "Please include a valid Email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Please include a valid Email and Password" });
    }

    const { email, password } = req.body;

    // checking if user exists
    try {
      let user = await User.findOne({ email });

      if (!user) {
        return res
          .status(400)
          .json({ message: "Invalid Username or password" });
      }

      // match user
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res
          .status(400)
          .json({ message: "Invalid Username or Password" });
      }

      // return token

      const payload = {
        user: {
          id: user._id,
        },
      };

      jwt.sign(payload, setcretToken, (error, token) => {
        if (error) throw error;
        res.json({ token, user });
      });
    } catch (error) {
      res.status(500).send({ message: error.message });
    }
  }
);

// creating new user
router.post("/register", async (req, res) => {
  const {
    email,
    password,
    userName,
    firstName,
    lastName,
    phone,
    designation,
    userType,
    profilePicture,
    DOB,
    joiningDate,
  } = req.body;

  try {
    // check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(500).send({
        error: "Error",
        message:
          "User already exists, if you forgotten your credentials please click forgot password",
      });
    }

    const newUser = new User({
      userName,
      email,
      userType,
      firstName,
      lastName,
      phone,
      password,
      designation,
      joiningDate,
      DOB,
      profilePicture,
      isActivated: true,
    });

    const payload = {
      user: {
        id: newUser._id,
      },
    };

    const salt = await bcrypt.genSalt(10);

    newUser.password = await bcrypt.hash(password, salt);

    await newUser.save();

    jwt.sign(payload, setcretToken, (error, token) => {
      if (error) throw error;
      res.json({ token, user: newUser });
    });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// sending reset password email
router.post("/reset", async (req, res) => {
  const { userEmail } = req.body;

  try {
    const isUser = await User.findOne({ email: userEmail });

    if (!isUser) {
      return res.status(500).send({
        error: "Error",
        message: "Provided Email is not valid, Please check the right email",
      });
    }
    const resetCode = Math.floor(1000 + Math.random() * 9000).toString();

    await User.updateOne(
      { email: userEmail },
      {
        $set: {
          resetCode,
          resetCodeExpiration: new Date(Date.now() + 3 * 60 * 1000),
        },
      }
    );

    // Store the reset code in your ResetPassword collection
    const resetPasswordEntry = new ResetPassword({
      resetCode,
      resetCodeExpiration: new Date(Date.now() + 3 * 60 * 1000), // 3 minutes from now
    });
    await resetPasswordEntry.save();

    sgMail.setApiKey(mailApi);

    // Send the email with SendGrid
    const msg = {
      to: userEmail,
      from: "info@codexpandit.com",
      templateId: "d-30d5f20f453044508ebc61fab39c6c77", // Your dynamic template ID
      dynamicTemplateData: {
        user_name: isUser.firstName + " " + isUser.lastName, // Replace with your user's name field
        reset_code: resetCode,
        user_id: isUser._id,
        code_requested: moment(new Date()).format("DD/MM/YYYY hh:mm a"),
      },
    };

    await sgMail.send(msg);

    res.status(200).json({ message: "Password reset code sent successfully" });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// enable biometric login
router.post("/biometric", auth, async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await User.findOne({ _id: userId });

    if (!user) {
      return res.status(404).send({
        error: "User not found",
        message: "The specified user does not exist.",
      });
    }

    if (user.biometricEnabled) {
      await User.updateMany(
        { _id: userId },
        {
          $set: {
            biometricEnabled: false,
          },
        }
      );

      await Biometrics.deleteOne({ userId });

      return res
        .status(200)
        .send({ message: "Biometric Login Disabled Successfully" });
    }

    // Generate a unique identifier for biometric reference
    const uniqueIdentifier = `${user._id}-${Date.now()}-${Math.random()}`;

    // Hash the unique identifier using bcrypt
    const biometricReference = await bcrypt.hash(uniqueIdentifier, 10);

    // Update the user's "biometricEnabled" field to true
    user.biometricEnabled = true;

    // Save the updated user document
    await user.save();

    // Create a new Biometric record with the user's ID and biometric reference
    const biometricData = new Biometrics({
      userId: user._id,
      biometricReference,
    });

    // Save the biometric data record
    await Biometrics.insertMany(biometricData);

    return res.status(200).send({
      message: "Biometric login enabled successfully.",
    });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

router.post("/login_biometric", async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await User.findOne({ _id: userId });

    if (!user.biometricEnabled) {
      return res.status(500).send({
        error: "Error",
        message: "Please enable biometrics login from settings first",
      });
    }

    if (!user) {
      return res.status(500).send({
        error: "Invalid User",
        message: "Inavalid user details, please create account first",
      });
    }

    const payload = {
      user: {
        id: user._id,
      },
    };

    jwt.sign(payload, setcretToken, (error, token) => {
      if (error) throw error;
      res.json({ token, user });
    });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message:
        "Something Went Wrong, please try again later, make sure you enabled biometric login in app settings",
    });
  }
});

// verify user code to reset password.
router.post("/code", async (req, res) => {
  const { userEmail, resetCode } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the reset code in the ResetPassword collection
    const resetPasswordEntry = await ResetPassword.findOne({
      resetCode,
      resetCodeExpiration: { $gt: new Date() }, // Check if reset code is not expired
    });

    if (!resetPasswordEntry) {
      return res.status(400).json({ message: "Invalid reset code" });
    }

    // Check if the current time is within the valid range of reset code's expiration time
    const currentTime = new Date();
    if (currentTime > resetPasswordEntry.resetCodeExpiration) {
      return res.status(400).json({ message: "Reset code has expired" });
    }

    await ResetPassword.deleteMany({ resetCode });

    // Code is valid
    res.status(200).json({ message: "Reset code is valid" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// change user password
router.put("/newPassword", async (req, res) => {
  const { newPassword } = req.body;
  const salt = await bcrypt.genSalt(10);

  const updatedPassword = await bcrypt.hash(newPassword, salt);

  try {
    const user = await User.updateOne(
      { _id: req.body.userId },
      {
        $set: {
          password: updatedPassword,
        },
      }
    );
    return res.status(200).send({ message: "Password Changed Successfully" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

module.exports = router;
