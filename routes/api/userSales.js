const express = require("express");
const router = express.Router();
const UserSales = require("../../models/UserSales");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const SupportCase = require("../../models/SupportCase");
const auth = require("../../middleware/auth");
const Sales = require("../../models/Sales");

router.get("/", auth, async (req, res) => {
  return res.status(200).json({ msg: "User Sales Route" });
});

router.post("/", auth, async (req, res) => {
  const { userId, startDate, endDate, salesData, addingUser } = req.body;

  const business = await BusinessUsers.find({ userId: addingUser });
  const businessIds = business.map((business) => business.businessId);

  const userAdding = await User.findOne({ _id: addingUser });
  try {
    const newSales = new UserSales({
      user: userId,
      salesData: salesData,
      startDate: startDate,
      endDate: endDate,
      addedIn: Date.now(),
      updatedIn: Date.now(),
      isFinal: false,
    });

    await UserSales.insertMany(newSales);

    return res.status(200).send({ message: "Users Sales Added Successfully" });
  } catch (error) {
    const newSupportCase = new SupportCase({
      userId: addingUser,
      businessId: businessIds,
      userName: userAdding.userName,
      email: userAdding.email,
      phone: userAdding.phone,
      subject: "Error Adding User Sales",
      message: error.message,
    });

    await SupportCase.insertMany(newSupportCase);
    return res
      .status(500)
      .send({ error: "Error", message: "Error Adding Users Sales" });
  }
});

module.exports = router;
