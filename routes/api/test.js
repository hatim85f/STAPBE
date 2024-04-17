const express = require("express");
const auth = require("../../middleware/auth");
const UserSales = require("../../models/UserSales");
const BusinessUsers = require("../../models/BusinessUsers");
const UserTarget = require("../../models/UserTarget");
const router = express.Router();
const moment = require("moment");
const User = require("../../models/User");
const { getUSerAchievement } = require("../../components/getUserAchievement");
const { default: mongoose } = require("mongoose");
const { getTeamYTDAch } = require("../../components/getTeamYTDAch");
const { getMonthlyValues } = require("../../components/getMonthlyValue");
const {
  getMonthlySalesValues,
} = require("../../components/getMonthlySalesValues");
const ProductTarget = require("../../models/ProductTarget");
const FixedExpenses = require("../../models/FixedExpenses");
const VariableExpenses = require("../../models/VariableExpenses");
const MarketingExpenses = require("../../models/MarketingExpenses");
const Eligibility = require("../../models/Eligibility");

router.get("/userAch/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // const userAch = await UserSales.aggregate([
    //   {
    //     $match: {
    //       user: new mongoose.Types.ObjectId(userId),
    //       isFinal: true,
    //     },
    //   },
    //   {
    //     $unwind: "$salesData",
    //   },

    //   {
    //     $project: {
    //       productId: "$salesData.product",
    //       salesValue: {
    //         $multiply: ["$salesData.quantity", "$salesData.price"],
    //       },
    //       user: 1,
    //       versionName: 1,
    //     },
    //   },
    // ]);

    const userAch = await UserSales.find({ user: userId });

    const salesArray = userAch
      .map((item) => {
        return item.salesData;
      })
      .flat();

    const salesValues = salesArray.map((item) => {
      return item.quantity * item.price;
    });
    const toalValues = salesValues.reduce((a, b) => a + b, 0);

    const target = await UserTarget.findOne({ userId });

    return res.status(200).send({ toalValues, salesValues, target });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

module.exports = router;
