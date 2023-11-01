const express = require("express");
const router = express.Router();
const Phasing = require("../../models/Phasing");
const auth = require("../../middleware/auth");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");
const BusinessUsers = require("../../models/BusinessUsers");

router.get("/:userId", auth, async (req, res) => {
  const userId = req.params.userId;

  try {
    const business = await BusinessUsers.find({ userId });

    const businessIds = business.map((business) => business.businessId);

    const phasing = await Phasing.find({ businessId: { $in: businessIds } });

    if (!phasing) {
      return res
        .status(400)
        .json({ error: "Error", message: "No phasing data found" });
    }

    return res.status(200).json({ phasing });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: "Server error" });
  }
});

router.post("/", auth, isCompanyAdmin, async (req, res) => {
  const { businessId, phasingData, year } = req.body;

  try {
    if (!phasingData) {
      return res
        .status(400)
        .json({ error: "Error", message: "Missing Phasing Details" });
    }

    const newPhasing = new Phasing({
      businessId,
      phasingPercentage: phasingData,
    });

    await Phasing.insertMany(newPhasing);

    return res.status(200).json({ message: "Phasing data added successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: "Server error" });
  }
});

module.exports = router;
