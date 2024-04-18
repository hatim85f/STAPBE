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
  "/personal/:userId/:startMonth/:endMonth/:year",
  auth,
  async (req, res) => {
    const { userId, startMonth, endMonth, year } = req.params;

    try {
      return res.status(200).send({ userId, startMonth, endMonth, year });
    } catch (error) {
      return res.status(500).json({ message: "Server Error" });
    }
  }
);

module.exports = router;
