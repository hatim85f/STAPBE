const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const SupportCase = require("../../models/SupportCase");
const VariableExpenses = require("../../models/VariableExpenses");
const { default: mongoose } = require("mongoose");

router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const businesses = await BusinessUsers.find({ userId: userId });

    const variableExpenses = await VariableExpenses.aggregate([
      {
        $match: {
          businessId: { $in: businesses.map((a) => a.businessId) },
        },
      },
      {
        $lookup: {
          from: "businesses",
          localField: "businessId",
          foreignField: "_id",
          as: "business",
        },
      },
      {
        $project: {
          _id: 1,
          currency: 1,
          amount: 1,
          category: 1,
          categoryOtherText: 1,
          description: 1,
          expenseDate: 1,
          isReceiptAvailable: 1,
          receiptImage: 1,
          receiptAmount: 1,
          receiptDate: 1,
          receiptCurrency: 1,
          businessName: { $arrayElemAt: ["$business.businessName", 0] },
          businessLogo: { $arrayElemAt: ["$business.businessLogo", 0] },
          businessId: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          variableExpenses: { $push: "$$ROOT" },
        },
      },
    ]);

    return res.status(200).json({ variableExpenses });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: "Something Went wrong, please try again later ",
    });
  }
});

router.post("/add", auth, async (req, res) => {
  const {
    userId,
    businessId,
    title,
    currency,
    amount,
    category,
    categoryOtherText,
    description,
    expenseDate,
    isReceiptAvailable,
    receiptImage,
    receiptAmount,
    receiptDate,
    receiptCurrency,
    source,
  } = req.body;

  const user = await User.findOne({ _id: userId });
  const business = await BusinessUsers.find({ userId: userId });
  const businessIds = business.map((a) => a.businessId);

  try {
    if (category === "Other" && !categoryOtherText) {
      return res
        .status(400)
        .json({ errors: [{ message: "Category Other Text is required" }] });
    }

    if (isReceiptAvailable && !receiptImage) {
      return res
        .status(400)
        .json({ errors: [{ message: "Receipt Image is required" }] });
    }

    if (title === "") {
      return res
        .status(400)
        .json({ errors: [{ message: "Title is required" }] });
    }

    if (amount === 0) {
      return res
        .status(400)
        .json({ errors: [{ message: "Amount is required" }] });
    }

    if (date === "") {
      return res
        .status(400)
        .json({ errors: [{ message: "Date is required" }] });
    }

    if (description === "") {
      return res
        .status(400)
        .json({ errors: [{ message: "Description is required" }] });
    }

    const newVariableExpenses = new VariableExpenses({
      currency,
      businessId,
      title,
      amount,
      category,
      categoryOtherText,
      userId,
      description,
      expenseDate,
      isReceiptAvailable,
      receiptImage,
      receiptAmount,
      receiptDate,
      receiptCurrency,
      source,
    });

    await VariableExpenses.insertMany(newVariableExpenses);

    return res.status(200).send({ message: "Variable Expenses Added" });
  } catch (error) {
    const newSupport = new SupportCase({
      userId,
      businessIds,
      userName: user.userName,
      email: user.email,
      phone: user.phone,
      subject: "Variable Expenses Error",
      message: error.message,
    });

    await SupportCase.insertMany(newSupport);

    return res.status(500).json({ error: "Error", message: error.message });
  }
});

router.put("/update/:id", auth, async (req, res) => {
  const { id } = req.params;
  const {
    currency,
    amount,
    category,
    categoryOtherText,
    description,
    expenseDate,
    isReceiptAvailable,
    receiptImage,
    receiptAmount,
    receiptDate,
  } = req.body;

  try {
    const variableExpenses = await VariableExpenses.findOne({ _id: id });

    if (variableExpenses) {
      variableExpenses.currency = currency;
      variableExpenses.amount = amount;
      variableExpenses.category = category;
      variableExpenses.categoryOtherText = categoryOtherText;
      variableExpenses.description = description;
      variableExpenses.expenseDate = expenseDate;
      variableExpenses.isReceiptAvailable = isReceiptAvailable;
      variableExpenses.receiptImage = receiptImage;
      variableExpenses.receiptAmount = receiptAmount;
      variableExpenses.receiptDate = receiptDate;
      variableExpenses.updatedAt = Date.now();

      await variableExpenses.save();
      return res.status(200).send({ message: "Variable Expenses Updated" });
    }
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

router.delete("/delete/:id", auth, async (req, res) => {
  const { id } = req.params;

  try {
    await VariableExpenses.deleteOne({ _id: id });
    return res.status(200).send({ message: "Variable Expenses Deleted" });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

module.exports = router;
