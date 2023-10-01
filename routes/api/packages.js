const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const Package = require("../../models/Package"); // Assuming the Package model is in the correct path
const auth = require("../../middleware/auth"); // Import your authentication middleware if needed
const isAdmin = require("../../middleware/isAdmin"); // Import your isAdmin middleware if needed

// @route   GET api/packages
// @desc    Get all packages
// @access  Public
router.get("/", async (req, res) => {
  try {
    const packages = await Package.find();
    return res.status(200).json({ packages });
  } catch (error) {
    return res.status(500).json({
      error: "Error",
      message:
        "Error while getting packages, Please try again later, or Contact Us on www.stap-crm.com",
    });
  }
});

// @route   GET api/packages/:id
// @desc    Get package by id
// @access  Public
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const package = await Package.findOne({ _id: id });

    if (!package || !package.isAvailable) {
      return res.status(404).json({
        error: "Error",
        message: "Package you are looking for is not available",
      });
    }

    return res.status(200).json({ package });
  } catch (error) {
    return res.status(500).json({
      error: "Error",
      message:
        "Error while getting package, Please try again later, or Contact Us on www.stap-crm.com",
    });
  }
});

// @route   POST api/packages
// @desc    Create new package
// @access  Private only Stap Admin
router.post("/", [auth, isAdmin], async (req, res) => {
  const {
    name,
    subTitle,
    backgroundColor,
    price,
    limits,
    features,
    prices,
    isAvailable,
  } = req.body;

  try {
    // Check if package already exists
    const existingPackage = await Package.findOne({ name });
    if (existingPackage) {
      return res.status(400).json({
        error: "Error",
        message: "Package already exists",
      });
    }

    const { businesses, teamMembers, admins } = limits;

    const adminNumber = admins > 100 ? 5 : admins;
    const businessNumber = businesses > 100 ? 5 : businesses;
    const teamNumber = teamMembers > 100 ? 14 : teamMembers;

    const businessCost = businessNumber * limits.valuePerBusiness;
    const teamCost = teamNumber * prices.teamMember;
    const adminCost = adminNumber * prices.admin;
    const businessOwnerCost = prices.businessOwner;
    const totalMonthlyCost =
      businessCost + teamCost + adminCost + businessOwnerCost;
    const totalYearlyCost = totalMonthlyCost * 12;

    const newPackage = new Package({
      name,
      subTitle,
      backgroundColor,
      price,
      limits,
      features,
      prices,
      totalMonthlyPrice: totalMonthlyCost + price.monthly,
      totalYearlyPrice: totalYearlyCost + price.yearly,
      isAvailable,
    });

    await Package.insertMany(newPackage);

    return res.status(200).json({ newPackage });
  } catch (error) {
    return res.status(500).json({
      error: "Error",
      message: error.message,
    });
  }
});

// @route   PUT api/packages/:id
// @desc    Update package by id
// @access  Private only Stap Admin
router.put("/:id", [auth, isAdmin], async (req, res) => {
  const { id } = req.params;
  const updatedPackage = req.body;

  try {
    const package = await Package.findByIdAndUpdate(id, updatedPackage, {
      new: true,
    });

    if (!package) {
      return res.status(404).json({
        error: "Error",
        message: "Package not found",
      });
    }

    return res.status(200).json({
      message: `Package ${package.name} updated successfully`,
      package,
    });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

router.put("/:id", [auth, isAdmin], async (req, res) => {
  const { id } = req.params;

  try {
    await Package.updateMany(
      { _id: id },
      {
        $set: {
          stripeProductId: req.body.stripeProductId,
          stripeMonthlyPriceId: req.body.stripeMonthlyPriceId,
          stripeYearlyPriceId: req.body.stripeYearlyPriceId,
        },
      }
    );

    return res.status(200).json({
      message: `Package updated successfully`,
    });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

// @route   DELETE api/packages/:id
// @desc    Delete package by id
// @access  Private only Stap Admin
router.delete("/:id", [auth, isAdmin], async (req, res) => {
  const { id } = req.params;

  try {
    const deletedPackage = await Package.findByIdAndRemove(id);

    if (!deletedPackage) {
      return res.status(404).json({
        error: "Error",
        message: "Package not found",
      });
    }

    return res.status(200).json({
      message: `Package ${deletedPackage.name} deleted successfully`,
    });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

module.exports = router;
