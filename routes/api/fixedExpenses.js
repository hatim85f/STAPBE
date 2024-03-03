const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const SupportCase = require("../../models/SupportCase");
const FixedExpenses = require("../../models/FixedExpenses");
const { default: mongoose } = require("mongoose");
const moment = require("moment");

router.get("/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  const startOfMonth = moment(`${month} ${year}`, "MMMM YYYY")
    .startOf("month")
    .toDate();
  const endOfMonth = moment(`${month} ${year}`, "MMMM YYYY")
    .endOf("month")
    .toDate();

  try {
    const businessExpenses = await FixedExpenses.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          dueIn: {
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
        $project: {
          _id: 1,
          currency: 1,
          amount: 1,
          title: 1,
          category: 1,
          categoryOtherText: 1,
          description: 1,
          recurringDay: 1,
          recurringType: 1,
          dueIn: 1,
          source: 1,
          businessName: { $arrayElemAt: ["$business.businessName", 0] },
          businessLogo: { $arrayElemAt: ["$business.businessLogo", 0] },
          businessId: 1,
          createdAt: 1,
        },
      },
      {
        $group: {
          _id: 0, // Grouping to get total across all documents
          totalFixedExpenses: { $sum: "$amount" },
          fixedExpenses: {
            $push: {
              currency: "$currency",
              amount: "$amount",
              title: "$title",
              category: "$category",
              categoryOtherText: "$categoryOtherText",
              description: "$description",
              recurringDay: "$recurringDay",
              recurringType: "$recurringType",
              dueIn: "$dueIn",
              source: "$source",
              businessName: "$businessName",
              businessLogo: "$businessLogo",
              businessId: "$businessId",
              createdAt: "$createdAt",
              expenseId: "$_id",
            },
          },
        },
      },
    ]);

    return res.status(200).json({ businessExpenses });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: "Something went wrong, please try again later.",
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
    recurringDay,
    dueIn,
    recurringType,
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

    if (dueIn === "") {
      return res
        .status(400)
        .json({ errors: [{ message: "Date is required" }] });
    }

    if (description === "") {
      return res
        .status(400)
        .json({ errors: [{ message: "Description is required" }] });
    }

    const dueDate = dueIn.split("/");
    const dueDateFormatted = new Date(
      `${dueDate[2]}-${dueDate[1]}-${dueDate[0]}`
    );

    const newFixedExpenses = new FixedExpenses({
      userId,
      businessId,
      title,
      currency,
      amount,
      category,
      categoryOtherText,
      dueIn: dueDateFormatted,
      description,
      recurringDay,
      recurringType,
      source,
    });

    await FixedExpenses.insertMany(newFixedExpenses);

    return res.status(200).send({
      message: "Fixed Expenses Added",
      fixedExpense: newFixedExpenses,
    });
  } catch (error) {
    const newSupport = new SupportCase({
      userId,
      businessIds,
      userName: user.userName,
      email: user.email,
      phone: user.phone,
      subject: "Fixed Expenses Error",
      message: error.message,
    });

    await SupportCase.insertMany(newSupport);

    return res.status(500).json({ error: "Error", message: error.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  const { id } = req.params;
  const {
    currency,
    amount,
    category,
    categoryOtherText,
    description,
    recurringDay,
    dueIn,
  } = req.body;

  try {
    await FixedExpenses.updateOne(
      { _id: id },
      {
        currency,
        amount,
        category,
        categoryOtherText,
        description,
        recurringDay,
        dueIn,
      }
    );

    return res.status(200).send({ message: "Fixed Expenses Updated" });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  const { id } = req.params;

  try {
    await FixedExpenses.deleteOne({ _id: id });

    return res.status(200).send({ message: "Fixed Expenses Deleted" });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

module.exports = router;
