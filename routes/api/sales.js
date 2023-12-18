const express = require("express");
const router = express.Router();

const Sales = require("../../models/Sales");
const User = require("../../models/User");
const SupportCase = require("../../models/SupportCase");
const OrderProducts = require("../../models/OrderProduct");
const Orders = require("../../models/Orders");
const BusinessUsers = require("../../models/BusinessUsers");

const auth = require("../../middleware/auth");
const Client = require("../../models/Client");
const moment = require("moment");

// @route   GET api/sales
// @desc    Get all sales
// @access  Private
router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;
  const { startPeriod, endPeriod } = req.query;

  const user = await User.findOne({ _id: userId });
  const business = await BusinessUsers.find({ userId: userId });
  const businessIds = business.map((a) => a.businessId);
  try {
    // Convert string dates to JavaScript Date objects
    const startDate = new Date(startPeriod);
    const endDate = new Date(endPeriod);

    // Ensure that the dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      // Handle invalid dates
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    const salesData = await Sales.aggregate([
      {
        $match: {
          businessId: { $in: businessIds },
          startPeriod: { $gte: startDate, $lte: endDate },
          endPeriod: { $gte: startDate, $lte: endDate },
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
          _id: 1,
          version: 1,
          businessName: { $arrayElemAt: ["$business.businessName", 0] },
          businessLogo: { $arrayElemAt: ["$business.businessLogo", 0] },
          businessId: { $arrayElemAt: ["$business._id", 0] },
          currencyCode: { $arrayElemAt: ["$business.currencyCode", 0] },
          currencyName: { $arrayElemAt: ["$business.currencyName", 0] },
          currencySymbol: { $arrayElemAt: ["$business.currencySymbol", 0] },
          salesData: 1,
          addedBy: 1,
          totalValue: 1,
          openedWith: 1,
          addedIn: 1,
          updatedIn: 1,
          lastOpened: 1,
          isFinal: 1,
          startPeriod: 1,
          endPeriod: 1,
        },
      },
    ]);

    if (salesData.length === 0) {
      return res
        .status(200)
        .send({ message: "No Sales Data Found for the specified dates" });
    }

    return res.status(200).send(salesData);
  } catch (error) {
    const newSupportCase = new SupportCase({
      userId,
      businessId: businessIds,
      userName: user.userName,
      email: user.email,
      phone: user.phone,
      subject: "Error Getting Sales Data",
      message: error.message,
    });
    await SupportCase.insertMany(newSupportCase);
    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

router.post("/", auth, async (req, res) => {
  const { salesData, userId, version, startPeriod, endPeriod } = req.body;

  const user = await User.findOne({ _id: userId });
  const { businessId, sales, salesValue } = salesData;
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
        date: new Date(item.date),
      };
    });

    const newSales = new Sales({
      startPeriod: new Date(startPeriod),
      endPeriod: new Date(endPeriod),
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
    await SupportCase.insertMany(newSupportCase);
    return res.status(500).send({
      error: "Error",
      message: "Something went wrong, please try again later",
    });
  }
});

router.put("/opened/:salesId", auth, async (req, res) => {
  const { salesId } = req.params;
  const { userId } = req.body;

  try {
    const salesData = await Sales.findOne({ _id: salesId });

    const addedIn = salesData.addedIn;
    const updatedIn = salesData.updatedIn;

    await Sales.updateMany(
      { _id: salesId },
      {
        openedWith: userId,
        addedIn: addedIn,
        updatedIn: updatedIn,
        lastOpened: Date.now(),
      }
    );

    return res.status(200).send({ message: "Sales Data Opened" });
  } catch (error) {
    return res.status(500).send({
      error: error.message,
      message: "Something went wrong, please try again later",
    });
  }
});

module.exports = router;
