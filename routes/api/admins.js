const express = require("express");
const router = express.Router();
const Admins = require("../../models/Admins");
const auth = require("../../middleware/auth");
const bcrypt = require("bcryptjs");
const config = require("config");
const { check, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");

const setcretToken =
  process.env.NODE_ENV === "production"
    ? process.env.jwtSecret
    : config.get("jwtSecret");

// @route   GET api/admins
// @desc    Get all admins
// @access  Private only Stap Admin
router.get("/", auth, async (req, res) => {
  try {
    const admins = await Admins.find();

    return res.status(200).json({ admins });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// @route   GET api/admins/:id
// @desc    Get admin by id
// @access  Private only Stap Admin
router.get("/:id", auth, async (req, res) => {
  const { id } = req.params;

  try {
    const admin = await Admins.findOne({ _id: id });

    if (!admin) {
      return res.status(500).send({
        error: "Error",
        message: "Admin your are looking for is not available",
      });
    }
    return res.status(200).json({ admin });
  } catch (error) {
    return res.status(500).json({
      error: "Error",
      message:
        "Error while getting admin, Please try again later, or Contact Us on www.stap-crm.com",
    });
  }
});

// @route   POST api/admins
// @desc    Create new admin
// @access  Private only Stap Admin
router.post("/", auth, async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const newAdmin = new Admins({
      name,
      email,
      password,
      role,
    });

    // encrypting password
    const salt = await bcrypt.genSalt(10);
    newAdmin.password = await bcrypt.hash(password, salt);

    await Admins.insertMany(newAdmin);

    return res.status(200).json({ newAdmin });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// @route   POST api/admins/login
// @desc    Login admin
// @access  Public
router.post(
  "/login",
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

    try {
      const admin = await Admins.findOne({ email });

      if (!admin) {
        return res
          .status(400)
          .json({ message: "Invalid Username or password" });
      }

      // match user
      const isMatch = await bcrypt.compare(password, admin.password);

      if (!isMatch) {
        return res
          .status(400)
          .json({ message: "Invalid Username or Password" });
      }

      // return token

      const payload = {
        admin: {
          id: admin._id,
        },
      };

      jwt.sign(payload, setcretToken, (error, token) => {
        if (error) throw error;
        res.json({ token, admin });
      });
    } catch (error) {
      return res.status(500).send({ error: "Error", message: error.message });
    }
  }
);

// @route   PUT api/admins/:id
// @desc    Update admin by id
// @access  Private only Stap Admin
router.put("/:id", auth, async (req, res) => {
  const { id, name, email, role } = req.params;

  try {
    const admin = await Admins.updateMany(
      { _id: id },
      {
        $set: {
          name,
          email,
          role,
        },
      }
    );

    return res
      .status(200)
      .send({ message: `Admin ${admin.name} updated Successfully` });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// @route   DELETE api/admins/:id
// @desc    Delete admin by id
// @access  Private only Stap Admin

router.delete("/:id", auth, async (req, res) => {
  const { id } = req.params;

  try {
    const admin = await Admins.findOne({ _id: id });

    if (!admin) {
      return res.status(500).send({
        error: "Error",
        message: "Admin your are looking for is not available",
      });
    }

    await Admins.deleteOne({ _id: id });

    return res
      .status(200)
      .send({ message: `Admin ${admin.name} deleted Successfully` });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// @route   POST api/admins/change-password
// @desc    Change admin password
// @access  Private only Stap Admin
router.post("/change-password", auth, async (req, res) => {
  const { id, password } = req.body;

  try {
    const admin = await Admins.findOne({ _id: id });

    if (!admin) {
      return res.status(500).send({
        error: "Error",
        message: "Admin your are looking for is not available",
      });
    }

    // encrypting password
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(password, salt);

    await Admins.updateMany(
      { _id: id },
      { $set: { password: admin.password } }
    );

    return res
      .status(200)
      .send({ message: `Admin ${admin.name} password changed Successfully` });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
