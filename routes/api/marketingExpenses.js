const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const SupportCase = require("../../models/SupportCase");
const MarketingExpenses = require("../../models/MarketingExpenses");
const { default: mongoose } = require("mongoose");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");
const moment = require("moment");
const { sendPushNotification } = require("../../components/sendNotifications");
const Products = require("../../models/Products");

// manager get all the expenses of his/her team,

// the plan is get the data usually full data, and filter them at the end.
// filter by product, approved, rejected, pending, claimed, not claimed, date, amount, currency, businessId, userId, etc.
router.get("/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  const business = await BusinessUsers.find({ userId: userId });
  const businessIds = business.map((business) => business.businessId);

  const currentMonthStart = moment(`${month} ${year}`, "MMMM YYYY")
    .startOf("month")
    .toDate();
  const currentMonthEnd = moment(`${month} ${year}`, "MMMM YYYY")
    .endOf("month")
    .toDate();

  // Calculate start and end dates for the previous month
  const previousMonthStart = moment(currentMonthStart)
    .subtract(1, "months")
    .startOf("month")
    .toDate();
  const previousMonthEnd = moment(currentMonthEnd)
    .subtract(1, "months")
    .endOf("month")
    .toDate();
  const user = await User.findOne({ _id: userId });

  const matchCondition =
    user.userType === "Business Owner"
      ? {
          businessId: { $in: businessIds },
          dueIn: { $gte: currentMonthStart, $lte: currentMonthEnd },
        }
      : {
          requestedBy: new mongoose.Types.ObjectId(userId),
          dueIn: { $gte: currentMonthStart, $lte: currentMonthEnd },
        };

  try {
    const expenses = await MarketingExpenses.aggregate([
      {
        $match: matchCondition,
      },
      {
        $lookup: {
          from: "products",
          localField: "requestAgainst",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "requestedBy",
          foreignField: "_id",
          as: "requestedBy_details",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "revisedBy",
          foreignField: "_id",
          as: "revisedBy_details",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "statusChangedBy",
          foreignField: "_id",
          as: "statusChangedBy_details",
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
          localField: "revisionReturnTo",
          foreignField: "_id",
          as: "returnTo_details",
        },
      },
      {
        $project: {
          _id: 1,
          businessName: { $arrayElemAt: ["$business.businessName", 0] },
          businessLogo: { $arrayElemAt: ["$business.businessLogo", 0] },
          requestedBy: { $arrayElemAt: ["$requestedBy_details.userName", 0] },
          requestedById: "$requestedBy",
          productName: { $arrayElemAt: ["$product.productNickName", 0] },
          productImage: { $arrayElemAt: ["$product.imageURL", 0] },
          productId: "$requestAgainst",
          requestedFor: 1,
          rationale: 1,
          amount: 1,
          currency: 1,
          isReceiptAvailable: 1,
          dueIn: 1,
          status: 1,
          isRevised: 1,
          isReceiptSubmitted: 1,
          closed: 1,
          isClaimed: 1,
          createdAt: 1,
          updatedAt: 1,
          isRevisionPassed: 1,
          revisedAt: 1,
          revisedByName: 1,
          revisedBy: 1,
          revisionComment: 1,
          revisionReturnTo: 1,
          revisionReturnToName: {
            $arrayElemAt: ["$returnTo_details.userName", 0],
          },
          receiptAmount: 1,
          receiptCurrency: 1,
          receiptImage: 1,
          receiptSubmittedAt: 1,
          claimedBy: 1,
          claimedAt: 1,
          statusChangedAt: 1,
          statusChangeComment: 1,
          statusChangedBy: 1,
          statusChangedByName: {
            $arrayElemAt: ["$statusChangedBy_details.userName", 0],
          },
          kindOfExpense: 1,
        },
      },
    ]);

    const previousMatch =
      user.userType === "Business Owner"
        ? {
            businessId: { $in: businessIds },
            dueIn: { $gte: previousMonthStart, $lte: previousMonthEnd },
          }
        : {
            requestedBy: new mongoose.Types.ObjectId(userId),
            dueIn: { $gte: previousMonthStart, $lte: previousMonthEnd },
          };

    const previousMonthExpenses = await MarketingExpenses.aggregate([
      {
        $match: previousMatch,
      },
      {
        $project: {
          amount: 1,
          isClaimed: 1,
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          numberOfPreviousMonthExpenses: { $sum: 1 },
          numberOfClaimedExpenses: {
            $sum: { $cond: [{ $eq: ["$isClaimed", true] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalAmount: 1,
          numberOfPreviousMonthExpenses: 1,
          numberOfClaimedExpenses: 1,
        },
      },
    ]);

    const total = expenses.map((a) => a.amount);
    const totalValue = total.reduce((a, b) => a + b, 0);

    return res
      .status(200)
      .json({ previousMonthExpenses, totalValue, expenses });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: "Something went wrong, please try again later",
    });
  }
});

// submitting expenses for approval
// minimal details just for creation of the case
router.post("/", auth, async (req, res) => {
  const {
    businessId,
    requestedBy,
    requestAgainst,
    requestedFor,
    rationale,
    amount,
    currency,
    dueIn,
    kindOfExpense,
  } = req.body;

  const user = await User.findOne({ _id: requestedBy });

  try {
    const [day, month, year] = dueIn.split("/");
    const dateObj = moment(`${year}-${month}-${day}`, "YYYY-MM-DD");
    const isoDate = dateObj.toISOString();

    const newMarketingExpenses = new MarketingExpenses({
      businessId,
      requestedBy,
      requestAgainst,
      requestedFor,
      rationale,
      amount,
      currency,
      dueIn: isoDate,
      kindOfExpense,
    });

    await MarketingExpenses.insertMany(newMarketingExpenses);

    // getting adding user
    const user = await User.findOne({ _id: requestedBy });
    const product = await Products.findOne({ _id: requestAgainst });

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
        `New Marketing Expense of ${currency} ${amount} has been added by ${user.userName} for ${product.productNickName}`
      );
    }

    const newNotification = new Notification({
      to: managerId,
      title: `Marketing Expense by ${user.userName}`,
      message: `New Marketing Expense of ${currency} ${amount} has been added by ${user.userName}`,
      route: "expenses",
      webRoute: "/expenses/manage-expenses",
      from: requestedBy,
    });

    await Notification.insertMany(newNotification);

    return res.status(200).send({
      message: "Expenses submitted successfully",
      marketingExpense: newMarketingExpenses,
    });
  } catch (error) {
    const newCase = new SupportCase({
      userId: requestedBy,
      businessId: [businessId],
      userName: user.userName,
      email: user.email,
      phone: user.phone,
      subject: "Marketing Expenses Submission Error",
      message: error.message,
    });

    await SupportCase.insertMany(newCase);

    return res.status(500).send({
      message:
        "Something went wrong submitting your expenses, we received your case and someone from our support team will contact you soon.",
      data: error.message,
    });
  }
});

router.put("/revision/:expenseId", auth, isCompanyAdmin, async (req, res) => {
  const { expenseId } = req.params;
  const { revisedBy, revisionComment } = req.body;

  try {
    const user = await User.findOne({ _id: revisedBy });

    const revisedAt = new Date();

    const isRevisionPassed = revisionComment.length ? false : true;

    const expense = await MarketingExpenses.findOne({ _id: expenseId });

    await MarketingExpenses.updateMany(
      { _id: expenseId },
      {
        $set: {
          isRevised: true,
          revisedBy,
          revisedAt,
          revisionComment,
          revisedByName: user.userName,
          status: "Revised",
          isRevisionPassed,
          isRevisionReturned: !isRevisionPassed,
          revisionReturnTo: expense.requestedBy,
        },
      }
    );

    return res.status(200).send({
      message: isRevisionPassed
        ? "Expense revised successfully"
        : "Expense revision rejected and the comment sent to the user",
    });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// approve the expenses or reject it with a comment if the user is isCompanyAdmin
router.put("/approval/:expenseId", auth, isCompanyAdmin, async (req, res) => {
  const { expenseId } = req.params;

  const { newStatus, statusChangedBy, statusComment } = req.body;

  try {
    const manager = await User.findOne({ _id: statusChangedBy });
    const statusChangedAt = new Date();

    const expense = await MarketingExpenses.findOne({ _id: expenseId });

    let returnTo;

    if (newStatus !== "Approved") {
      if (expense.revisedBy === statusChangedBy) {
        returnTo = expense.requestedBy;
      } else {
        returnTo = expense.revisedBy;
      }
    }

    const returnedUser = await User.findOne({ _id: returnTo });

    const resquestedUser = await User.findOne({ _id: expense.requestedBy });

    await MarketingExpenses.updateMany(
      { _id: expenseId },
      {
        $set: {
          status: newStatus,
          statusChangedBy,
          statusChangedByName: manager.userName,
          statusChangedAt,
          statusChangeComment: statusComment,
          isStatusReturn: newStatus !== "Approved" ? true : false,
          statusReturnTo: returnTo,
        },
      }
    );

    const message =
      newStatus === "Approved"
        ? `Your Marketing Expense with value ${expense.amount} ${expense.currency} has been approved`
        : `Your Marketing Expense with value ${expense.amount} ${expense.currency} has been rejected, please revise and resubmit`;

    const title =
      newStatus === "Approved" ? "Expense Approved" : "Expense Rejected";

    const newNotification = new Notification({
      to: returnTo,
      title: title,
      message: message,
      route: "expenses",
      webRoute: "/expenses/manage-expenses",
      from: statusChangedBy,
    });

    if (returnTo) {
      await Notification.insertMany(newNotification);

      const userTokens = await PushToken.findOne({ user: returnTo });
      const tokens = userTokens.token;

      for (let token of tokens) {
        sendPushNotification(token, "expenses", message);
      }
    }

    const returnMessage = returnTo
      ? ` and the comment sent to ${returnedUser.userName}`
      : "and the comment has been saved for the user to see when they check the expense";

    return res.status(200).send({
      message:
        newStatus === "Approved"
          ? `Expense approved successfully ${returnMessage}`
          : `Expense rejected ${returnMessage}`,
    });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: "Something went wrong, please try again later",
    });
  }
});

router.put("/submit-receipt/:expenseId", auth, async (req, res) => {
  const { expenseId } = req.params;
  const { receiptImage, receiptAmount, receiptCurrency } = req.body;

  const receiptSubmittedAt = new Date();

  try {
    await MarketingExpenses.updateMany(
      { _id: expenseId },
      {
        $set: {
          isReceiptSubmitted: true,
          isReceiptAvailable: true,
          receiptImage,
          receiptAmount,
          receiptCurrency,
          receiptSubmittedAt,
        },
      }
    );

    return res.status(200).send({
      message: "Receipt submitted successfully",
    });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: "Something went wrong, please try again later",
    });
  }
});

router.put("/claimed/:expenseId", isCompanyAdmin, auth, async (req, res) => {
  const { expenseId } = req.params;

  const claimedAt = new Date();

  const expense = await MarketingExpenses.findOne({ _id: expenseId });

  try {
    await MarketingExpenses.updateMany(
      { _id: expenseId },
      {
        $set: {
          isClaimed: true,
          claimedBy: expense.requestedBy,
          claimedAt,
          closed: true,
        },
      }
    );

    return res
      .status(200)
      .send({ message: "Expense claimed successfully and the case is closed" });
  } catch (error) {
    return res
      .status(500)
      .send({ message: "Something went wrong, please try again later" });
  }
});

module.exports = router;
