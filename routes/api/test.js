const express = require("express");
const auth = require("../../middleware/auth");
const UserSales = require("../../models/UserSales");
const BusinessUsers = require("../../models/BusinessUsers");
const UserTarget = require("../../models/UserTarget");
const router = express.Router();
const moment = require("moment");
const { getUSerAchievement } = require("../../components/getUserAchievement");

router.get("/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  try {
    const userAchievement = await getUSerAchievement(userId, month, year);

    return res.status(200).json({ userAchievement });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
