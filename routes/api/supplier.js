const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");

const Supplier = require("../../models/Suppliers");
const BusinessUsers = require("../../models/BusinessUsers");

// @route   GET api/supplier
// @desc    Get all suppliers
// @access  Private

router.get("/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const businessUser = await BusinessUsers.find({ userId: userId });

    if (!businessUser) {
      return res.status(400).json({ message: "Business not found" });
    }

    const businessIds = businessUser.map((business) => business.businessId);

    const suppliers = await Supplier.find({
      businessIds: { $in: businessIds },
    });
    res.json({ suppliers });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// @route   POST api/supplier
// @desc    Create a new supplier
// @access  Private
router.post("/", auth, async (req, res) => {
  const {
    supplierName,
    supplierEmail,
    supplierPhone,
    supplierAddress,
    supplierCity,
    contactPerson,
    contactPersonPhone,
    contactPersonEmail,
    paymentPeriod,
    currency,
    userId,
  } = req.body;

  try {
    const businessUser = await BusinessUsers.find({ userId: userId });
    const businessIds = businessUser.map((business) => business.businessId);

    if (!businessUser) {
      return res.status(400).json({ message: "Business not found" });
    }

    const supplierNameRegex = new RegExp(
      supplierName.trim().replace(/\s+/g, "\\s*"),
      "i"
    ); // 'i' for case-insensitive matching

    const businessSuppliers = await Supplier.find({
      businessIds: { $in: businessIds },
      supplierName: { $regex: supplierNameRegex },
    });

    if (businessSuppliers.length > 0) {
      return res.status(400).json({
        message: `Supplier ${supplierName} already exists`,
      });
    }

    const newSupplier = new Supplier({
      supplierName,
      supplierEmail,
      supplierPhone,
      supplierAddress,
      supplierCity,
      contactPerson,
      contactPersonPhone,
      contactPersonEmail,
      paymentPeriod,
      currency,
      businessIds,
    });

    await Supplier.insertMany(newSupplier);
    res.json({ message: `Supplier ${supplierName} created successfully` });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// @route   PUT api/supplier/:id
// @desc    Update a supplier
// @access  Private

router.put("/:id", auth, async (req, res) => {
  const { id } = req.params;

  try {
    const supplier = await Supplier.find({ _id: id });

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    const {
      supplierName,
      supplierEmail,
      supplierPhone,
      supplierAddress,
      supplierCity,
      contactPerson,
      contactPersonPhone,
      contactPersonEmail,
      paymentPeriod,
      currency,
      userId,
    } = req.body;

    const businessUser = await BusinessUsers.find({ userId: userId });
    const businessIds = businessUser.map((business) => business.businessId);

    await Supplier.updateMany(
      { _id: id },
      {
        supplierName,
        supplierEmail,
        supplierPhone,
        supplierAddress,
        supplierCity,
        contactPerson,
        contactPersonPhone,
        contactPersonEmail,
        paymentPeriod,
        currency,
        businessIds,
      }
    );

    res.json({ message: `Supplier ${supplierName} updated successfully` });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// @route   DELETE api/supplier/:id
// @desc    Delete a supplier
// @access  Private

router.delete("/:id", auth, async (req, res) => {
  const { id } = req.params;

  try {
    const supplier = await Supplier.find({ _id: id });

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    await Supplier.deleteOne({ _id: id });
    res.json({
      message: `Supplier ${supplier.supplierName} deleted successfully`,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});
module.exports = router;
