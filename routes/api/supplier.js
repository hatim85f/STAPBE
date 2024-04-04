const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");

const Supplier = require("../../models/Suppliers");
const BusinessUsers = require("../../models/BusinessUsers");

// @route   GET api/supplier
// @desc    Get all suppliers
// @access  Private

router.get("/", auth, async (req, res) => {
  try {
    const suppliers = await Supplier.find();
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
    const supplier = await Supplier.fi({ _id: id });

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    const businessUser = await BusinessUsers.find({ userId: userId });
    const businessIds = businessUser.map((business) => business.businessId);

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
