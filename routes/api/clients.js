const express = require("express");
const router = express.Router();
const Client = require("../../models/Client");
const User = require("../../models/User");
const auth = require("../../middleware/auth");
const Business = require("../../models/Business");
const BusinessUsers = require("../../models/BusinessUsers");
const Eligibility = require("../../models/Eligibility");
const isAdmin = require("../../middleware/isAdmin");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");
const { default: mongoose } = require("mongoose");

// @route GET api/clients/test
// @description tests clients route
// @access Private
router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findOne({ _id: userId });

    const userType = user.userType;

    if (userType === "Business Owner") {
      const business = await BusinessUsers.find({ userId });

      // loop through business and get the businessIds
      const businessIds = business.map((business) => business.businessId);

      // loop through businessIds and get the clients
      const clients = await Client.aggregate([
        {
          $match: {
            businessId: { $in: businessIds },
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
          $unwind: "$business",
        },
        {
          $project: {
            _id: 1,
            clientName: 1,
            businessId: 1,
            clientType: 1,
            address: 1,
            contactPerson: 1,
            logoURL: 1,
            personInHandleId: 1,
            personInHandle: 1,
            businessName: "$business.businessName",
            businessLogo: "$business.businessLogo",
          },
        },
      ]);

      if (!clients)
        return res.status(404).json({ message: "No clients found" });
      return res.status(200).json({ clients });
    } else {
      const clients = await Client.aggregate([
        {
          $match: {
            personInHandleId: new mongoose.Types.ObjectId(userId),
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
          $unwind: "$business",
        },
        {
          $project: {
            _id: 1,
            clientName: 1,
            businessId: 1,
            clientType: 1,
            address: 1,
            contactPerson: 1,
            logoURL: 1,
            personInHandleId: 1,
            personInHandle: 1,
            businessName: "$business.businessName",
            businessLogo: "$business.businessLogo",
          },
        },
      ]);

      if (!clients)
        return res.status(404).json({ message: "No clients found" });
      return res.status(200).json({ clients });
    }
  } catch (error) {
    return res.status(200).send({ error: "Error", message: error.message });
  }
});

// @route GET api/clients
// get specific client
// @access Private
router.get("/:clientId", auth, async (req, res) => {
  const { clientId } = req.params;

  try {
    const clinet = await Client.findOne({ _id: clientId });

    if (!clinet) return res.status(500).json({ message: "No client found" });

    return res.status(200).json({ clinet });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: "Something went wrong",
    });
  }
});

// @route POST api/clients
// add/save client
// @access Private
router.post("/", auth, async (req, res) => {
  const {
    clientName,
    businessId,
    clientType,
    address,
    contactPersonName,
    contactPersonEmail,
    contactPersonPhone,
    logoURL,
    personInHandleId,
  } = req.body;

  try {
    const cleint = await Client.findOne({ clientName, businessId });

    if (cleint)
      return res.status(500).json({
        message:
          "Client already exists, it might be assigned to someone else in your team. Contact your admin to add him to your list",
      });

    const personInHandle = await User.findOne({ _id: personInHandleId });

    const newClient = new Client({
      clientName,
      businessId,
      clientType,
      address,
      contactPerson: {
        name: contactPersonName,
        email: contactPersonEmail,
        phone: contactPersonPhone,
      },
      logoURL,
      personInHandleId,
      personInHandle: personInHandle.userName,
    });

    await Client.insertMany(newClient);

    const businessOwner = await BusinessUsers.findOne({
      businessId,
      isBusinessOwner: true,
    });

    await Eligibility.updateMany(
      { userId: businessOwner.userId },
      { $inc: { clients: -1 } }
    );

    return res
      .status(200)
      .send({ message: `Customer ${clientName} added successfully` });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// @route PUT api/clients
// update client
// @access Private
router.put("/:clientId", auth, isCompanyAdmin, async (req, res) => {
  const { clientId } = req.params;
  const {
    clientName,
    businessId,
    clientType,
    address,
    contactPersonName,
    contactPersonEmail,
    contactPersonPhone,
    logoURL,
    personInHandleId,
    personInHandle,
  } = req.body;

  try {
    const client = await Client.findOne({ _id: clientId });

    if (!client) return res.status(500).json({ message: "No client found" });

    await Client.updateMany(
      { _id: clientId },
      {
        $set: {
          clientName,
          businessId,
          clientType,
          address,
          contactPerson: {
            name: contactPersonName,
            email: contactPersonEmail,
            phone: contactPersonPhone,
          },
          logoURL,
          personInHandleId,
          personInHandle,
        },
      }
    );

    return res
      .status(200)
      .send({ message: `Customer ${clientName} updated successfully` });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: "Something went wrong",
    });
  }
});

// @route DELETE api/clients
// delete client
// @access Private
router.delete("/:clientId", auth, isCompanyAdmin, async (req, res) => {
  const { clientId } = req.params;
  const userId = req.header("user-id");

  try {
    const client = await Client.findOne({ _id: clientId });

    if (!client) return res.status(500).json({ message: "No client found" });

    // update eligibility of the user

    await Eligibility.updateMany({ userId: userId }, { $inc: { clients: 1 } });

    return res
      .status(200)
      .send({ message: `Customer ${client.clientName} deleted successfully` });
  } catch (error) {
    return res
      .status(500)
      .send({ error: "Error", message: "Something Went Wrong" });
  }
});

module.exports = router;
