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

router.get("/:userId/:startMonth/:endMonth/:year", auth, async (req, res) => {
  const { userId, startMonth, endMonth, year } = req.params;

  try {
    const teamAchievement = await getTeamYTDAch(
      userId,
      startMonth,
      endMonth,
      year
    );

    const monthlyData = await getMonthlyValues(
      startMonth,
      endMonth,
      year,
      userId
    );

    const monthlySales = await getMonthlySalesValues(
      startMonth,
      endMonth,
      year,
      userId
    );

    const salesDetails = teamAchievement.map((a) => a.products).flat(1);

    const salesData = salesDetails.map((a) => a.productSalesValue);

    return res.status(200).json({
      salesData,
    });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
