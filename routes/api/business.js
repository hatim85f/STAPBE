const express = require("express");
const Business = require("../../models/Business");
const BusinessUsers = require("../../models/BusinessUsers");
const { mongoose } = require("mongoose");
const auth = require("../../middleware/auth");
const router = express.Router();

// getting all businesses for the user
// collection: businessUsers has userId and businessId
// if he is the owner of the business

router.get("/all", auth, async (req, res) => {
  const { userId } = req.query; // destructuring

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
        $unwind: "$business",
      },
      {
        $project: {
          business: 1,
          _id: 0,
        },
      },
    ]);

    return res.status(200).send({ userBusiness });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

// getting business for user if he is not the owner
// collection: businessUsers has userId and businessId
// if he is not the owner of the business

router.get("/employee", auth, async (req, res) => {
  const { userId } = req.query; // destructuring
  try {
    const userBusinesses = await BusinessUsers.find({
      userId,
      isBusinessOwner: false,
    });
    return res.status(200).json({ userBusinesses });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

// posting new business to create
router.post("/create", async (req, res) => {
  const {
    businessLogo,
    businessName,
    businessType,
    businessDescription,
    officeLocation,
    contactPerson,
    contactPersonEmail,
    contactNumber,
    webSite,
    userId,
  } = req.body; // destructuring

  try {
    // check if all fields are filled
    if (
      !businessLogo ||
      !businessName ||
      !businessType ||
      !businessDescription ||
      !officeLocation ||
      !contactPerson ||
      !contactPersonEmail ||
      !contactNumber
    ) {
      return res.status(500).json({
        error: "Something Went Wron",
        message: "Please fill all fields",
      });
    }

    // check if business already exists
    const business = await Business.findOne({ businessName });

    if (business) {
      return res.status(500).json({ msg: "Business already exists" });
    }

    // create new business
    const newBusiness = new Business({
      businessLogo,
      businessName,
      businessType,
      businessDescription,
      officeLocation,
      contactPerson,
      contactPersonEmail,
      contactNumber,
      webSite,
    });

    // save new business
    await Business.insertMany(newBusiness);

    // adding user to business
    // get the newBusiness id to add to businessUsers

    const businessNeeded = await Business.findOne({
      businessName,
      businessType,
      businessDescription,
      officeLocation,
      contactPerson,
      contactPersonEmail,
      contactNumber,
      webSite,
    });

    const businessId = businessNeeded._id;
    const newBusinessUser = new BusinessUsers({
      userId: userId,
      businessId,
      isBusinessOwner: true,
    });

    // save new business user
    await BusinessUsers.insertMany(newBusinessUser);

    res.status(200).json({ message: "Your New Business created successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

//updating business details if he is the owner

router.put("/update", auth, async (req, res) => {
  const {
    businessLogo,
    businessName,
    businessType,
    businessDescription,
    officeLocation,
    contactPerson,
    contactPersonEmail,
    contactNumber,
    numberOfEmployees,
    webSite,
    businessId,
  } = req.body; // destructuring

  try {
    await Business.updateOne(
      { _id: businessId },
      {
        $set: {
          businessLogo,
          businessName,
          businessType,
          businessDescription,
          officeLocation,
          contactPerson,
          contactPersonEmail,
          contactNumber,
          numberOfEmployees,
          webSite,
        },
      }
    );

    res.status(200).json({ message: "Your Business updated successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

// deleting business if he is the owner

router.delete("/delete", auth, async (req, res) => {
  try {
    const { businessId } = req.body; // destructuring
    await Business.deleteOne({ _id: businessId });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

//exporting router
module.exports = router;
