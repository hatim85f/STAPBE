const express = require("express");
const router = express.Router();
const Client = require("../../models/Client");
const Orders = require("../../models/Orders");
const OrderProducts = require("../../models/OrderProduct");
const auth = require("../../middleware/auth");
const BusinessUsers = require("../../models/BusinessUsers");
const { default: mongoose } = require("mongoose");
const SupportCase = require("../../models/SupportCase");
const User = require("../../models/User");

// @route GET api/clients/test
// @description tests clients route
// @access Private
router.get("/", auth, async (req, res) => {
  return res.status(200).send({ message: "Client route works" });
});

router.post("/:userId", auth, async (req, res) => {
  const { userId } = req.params;
  const { clientId } = req.body;

  try {
    const userBusiness = await BusinessUsers.findOne({ userId });

    const newOrder = new Orders({
      _id: new mongoose.Types.ObjectId(),
      businessId: userBusiness.businessId,
      userId,
      clientId,
      totalValue: 0,
      details: [],
    });

    await Orders.insertMany(newOrder);

    return res.status(200).send({ orderId: newOrder._id });
  } catch (error) {
    return res.status(500).send({ error: "Error !", message: error.message });
  }
});

router.post("/add_order/:orderId", auth, async (req, res) => {
  const { orderId } = req.params;
  const {
    productId,
    quantity,
    discount,
    discountType,
    bonusUnits,
    productPrice,
    totalValue,
    userId,
    businessId,
  } = req.body;

  try {
    const newOrderProduct = new OrderProducts({
      _id: new mongoose.Types.ObjectId(),
      orderId,
      productId,
      quantity,
      discount,
      discountType,
      bonusUnits,
      productPrice,
      totalValue,
    });

    await OrderProducts.insertMany(newOrderProduct);

    await Orders.updateMany(
      { _id: orderId },
      {
        $inc: { totalValue: totalValue },
        $push: { details: newOrderProduct._id },
        $set: { timeStamp: Date.now() },
      }
    );

    return res.status(200).send({ message: `Order added sucessfully` });
  } catch (error) {
    const user = await User.findOne({ _id: userId });
    const newSupportCase = new SupportCase({
      userId,
      userName: user.userName,
      email: user.email,
      phone: user.phone,
      businessId,
      subject: "Error in placing order",
      message: error.message,
    });

    await SupportCase.insertMany(newSupportCase);

    return res.status(500).send({ error: "Error !", message: error.message });
  }
});

module.exports = router;
