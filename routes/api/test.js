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

router.get(
  "/:businessId/:startMonth/:endMonth/:year",
  auth,
  async (req, res) => {
    const { businessId, startMonth, endMonth, year } = req.params;

    const start = new Date(year, startMonth - 1, 1);
    const end = new Date(year, endMonth, 1);

    try {
      const fixedExpenses = await FixedExpenses.find({
        businessId,
        dueIn: { $gte: start, $lt: end },
      });
      const totalFixedAmounts = fixedExpenses.map((a) => a.amount);
      const totalFixed = totalFixedAmounts.reduce((a, b) => a + b, 0);

      const variableExpenses = await VariableExpenses.find({
        businessId,
        expenseDate: { $gte: start, $lt: end },
      });
      const totalVariableAmounts = variableExpenses.map((a) => a.amount);
      const totalVariable = totalVariableAmounts.reduce((a, b) => a + b, 0);

      const marketingExpenses = await MarketingExpenses.find({
        businessId,
        dueIn: { $gte: start, $lt: end },
      });
      const totalMarketingAmounts = marketingExpenses.map((a) => a.amount);
      const totalMarketing = totalMarketingAmounts.reduce((a, b) => a + b, 0);

      return res.status(200).json({
        fixedExpenses: totalFixed,
        variableExpenses: totalVariable,
        marketingExpenses: totalMarketing,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

router.put("/", async (req, res) => {
  try {
    const admins = await BusinessUsers.find({ isBusinessAdmin: true });

    for (let key in admins) {
      const admin = admins[key];
      const { businessId, userId } = admin;

      await Eligibility.updateMany(
        {
          businessId: businessId,
        },
        {
          $set: {
            adminId: userId,
          },
        }
      );
    }

    return res.status(200).json({ admins });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
