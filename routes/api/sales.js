const express = require("express");
const router = express.Router();

const Sales = require("../../models/Sales");
const User = require("../../models/User");
const SupportCase = require("../../models/SupportCase");
const OrderProducts = require("../../models/OrderProduct");
const Orders = require("../../models/Orders");

const auth = require("../../middleware/auth");
const Client = require("../../models/Client");
const moment = require("moment");

// @route   GET api/sales
// @desc    Get all sales
// @access  Private
router.get("/", auth, async (req, res) => {
  return res.status(200).send({ message: "Router is Getting and Working" });
});

router.post("/", auth, async (req, res) => {
  const { salesData, userId, version } = req.body;

  const user = await User.findOne({ _id: userId });
  const { businessId, sales } = salesData;
  try {
    const trimmedVersion = version.trim();

    const previousVersion = await Sales.findOne({
      businessId,
      version: new RegExp(`^${trimmedVersion}$`, "i"),
    });

    if (previousVersion) {
      return res.status(400).send({
        message: `Version ${version} Already Exists, Please change version name and try again`,
      });
    }

    const newSalesData = sales.map((item) => {
      const totalQuantity =
        item.bonusType === "Percentage"
          ? item.quantity + (item.quantity * item.bonus) / 100
          : item.quantity;
      return {
        ...item,
        discount: item.bonus,
        discountType: item.bonusType,
        itemValue: item.quantity * item.productPrice,
        totalQuantity,
      };
    });
    const salesValue = newSalesData.reduce(
      (acc, item) => acc + item.itemValue,
      0
    );

    const newSales = new Sales({
      businessId,
      version: version
        ? version
        : `${moment(new Date()).format("DD/MM/YYYY HH:mm:ss")}`,
      salesData: newSalesData,
      addedBy: userId,
      totalValue: salesValue,
      openedWith: userId,
    });

    await Sales.insertMany(newSales);

    return res.status(200).send({ message: "Sales Data Added" });
  } catch (error) {
    const newSupportCase = new SupportCase({
      userId,
      businessId,
      userName: user.userName,
      email: user.email,
      phone: user.phone,
      subject: "Error Uploading Excel Sales Data",
      message: error.message,
    });
    // await SupportCase.insertMany(newSupportCase);
    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

module.exports = router;
