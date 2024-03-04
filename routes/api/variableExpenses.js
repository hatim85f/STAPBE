const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const SupportCase = require("../../models/SupportCase");
const VariableExpenses = require("../../models/VariableExpenses");
const { default: mongoose } = require("mongoose");
const { Expo } = require("expo-server-sdk");
const { sendPushNotification } = require("../../components/sendNotifications");
const Notification = require("../../models/Notification");
const moment = require("moment");

router.get("/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  try {
    const startOfMonth = moment(`${month} ${year}`, "MMMM YYYY")
      .startOf("month")
      .toDate();
    const endOfMonth = moment(`${month} ${year}`, "MMMM YYYY")
      .endOf("month")
      .toDate();

    const businesses = await BusinessUsers.find({ userId: userId });

    const variableExpenses = await VariableExpenses.aggregate([
      {
        $match: {
          businessId: { $in: businesses.map((a) => a.businessId) },
          receiptDate: {
            $gte: startOfMonth,
            $lte: endOfMonth,
          },
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
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "created_by",
        },
      },
      {
        $project: {
          expenseId: "$_id",
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
          createdBy: { $arrayElemAt: ["$created_by.userName", 0] },
          createdById: "$userId",
          createdByImage: { $arrayElemAt: ["$created_by.profileImage", 0] },
        },
      },
      {
        $group: {
          _id: 0,
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

    if (receiptDate === "") {
      return res
        .status(400)
        .json({ errors: [{ message: "Date is required" }] });
    }

    if (description === "") {
      return res
        .status(400)
        .json({ errors: [{ message: "Description is required" }] });
    }

    const receiptDateParts = receiptDate.split("/");
    const day = parseInt(receiptDateParts[0], 10);
    const month = parseInt(receiptDateParts[1] - 1, 10); // Months are 0-indexed in JavaScript Dates
    const year = parseInt(receiptDateParts[2], 10);

    const dateOfReceipt = new Date(year, month, day);

    const expenseDateParts = expenseDate.split("/");
    const dayExpense = parseInt(expenseDateParts[0], 10);
    const monthExpense = parseInt(expenseDateParts[1] - 1, 10); // Months are 0-indexed in JavaScript Dates
    const yearExpense = parseInt(expenseDateParts[2], 10);

    const dateOfExpense = new Date(yearExpense, monthExpense, dayExpense);

    const newVariableExpenses = new VariableExpenses({
      currency,
      businessId,
      title,
      amount,
      category,
      categoryOtherText,
      userId,
      description,
      expenseDate: dateOfExpense,
      isReceiptAvailable,
      receiptImage,
      receiptAmount,
      receiptDate: dateOfReceipt,
      receiptCurrency,
      source,
    });

    // getting adding user
    const user = await User.findOne({ _id: userId });

    // sending notification for the manager

    const managerTokens = await BusinessUsers.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          isBusinessOwner: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "managerData",
        },
      },
      {
        $lookup: {
          from: "pushtokens",
          localField: "user",
          foreignField: "userId",
          as: "pushToken",
        },
      },
      {
        $unwind: "$pushToken", // Unwind the pushToken array
      },
      {
        $project: {
          pushTokens: "$pushToken.token", // Reshape the output to use pushTokens as the key
          _id: 0, // Exclude the _id field
          managerId: { $arrayElemAt: ["$managerData._id", 0] },
        },
      },
    ]);

    const neededTokens = managerTokens[0].pushTokens;
    const managerId = managerTokens[0].managerId;

    for (let token of neededTokens) {
      sendPushNotification(
        token,
        "expenses", // Updated routeValue
        `New Variable Expense of ${currency} ${amount} has been added by ${user.userName}`
      );
    }

    const newNotification = new Notification({
      to: managerId,
      title: `Variable Expense by ${user.userName}`,
      message: `New Variable Expense of ${currency} ${amount} has been added by ${user.userName}`,
      route: "expenses",
      webRoute: "/expeeses/manage-expenses",
      from: userId,
    });

    await Notification.insertMany(newNotification);

    await VariableExpenses.insertMany(newVariableExpenses);

    return res.status(200).send({
      message: "Variable Expenses Added",
      variableExpense: newVariableExpenses,
    });
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
