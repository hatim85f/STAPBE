const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const Business = require("../../models/Business");
const { default: mongoose } = require("mongoose");

router.get("/", auth, async (req, res) => {
  res.status(200).send("API Running");
});

router.get("/business", auth, async (req, res) => {
  try {
    let userObjId = new mongoose.Types.ObjectId(req.query.userId);

    console.log(userObjId);
    const userBusiness = await BusinessUsers.aggregate([
      {
        $match: {
          userId: userObjId,
          isBusinessOwner: true,
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
          business: 1,
        },
      },
    ]);

    return res.status(200).send({ userBusiness });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

router.put("/", async (req, res) => {
  const users = await User.updateMany({}, { $set: { isActivated: true } });

  return res.status(200).send({ users });
});

module.exports = router;
