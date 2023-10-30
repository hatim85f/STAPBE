const express = require("express");
const router = express.Router();
const Phasing = require("../../models/Phasing");
const auth = require("../../middleware/auth");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");

router.get("/", auth, async (req, res) => {
  return res.status(200).json({ msg: "Phasing route works" });
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
