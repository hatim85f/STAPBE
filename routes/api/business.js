const express = require("express");
const Business = require("../../models/Business");
const BusinessUsers = require("../../models/BusinessUsers");
const { mongoose } = require("mongoose");
const auth = require("../../middleware/auth");
const MemberShip = require("../../models/MemberShip");
const Package = require("../../models/Package");
const Eligibility = require("../../models/Eligibility");
const router = express.Router();

// getting all businesses for the user
// collection: businessUsers has userId and businessId
// if he is the owner of the business
// get the business currency from collect BusinessCurrency with businessId

router.get("/:userId", auth, async (req, res) => {
  const userId = req.params.userId;

  try {
    let userObjId = new mongoose.Types.ObjectId(userId);
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
        $lookup: {
          from: "businessusers",
          localField: "businessId",
          pipeline: [
            {
              $match: {
                isBusinessOwner: false,
              },
            },
          ],
          foreignField: "businessId",
          as: "team",
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "team.userId",
          foreignField: "_id",
          as: "teamMembers",
        },
      },
      {
        $addFields: {
          "teamMembers.businessName": "$business.businessName",
          "teamMembers.businessLogo": "$business.businessLogo",
          "teamMembers.businessId": "$business._id",
        },
      },
      {
        $project: {
          business: 1,
          teamMembers: 1,
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

router.get("/employee/:userId", auth, async (req, res) => {
  const { userId } = req.params; // destructuring
  try {
    const userBusiness = await BusinessUsers.findOne({
      userId,
      isBusinessOwner: false,
    });
    return res.status(200).json({ userBusiness });
  } catch (error) {
    return res
      .status(500)
      .json({
        error: "Error",
        message: "Something Went wrong, please try again later",
      });
  }
});

// posting new business to create
router.post("/create", auth, async (req, res) => {
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
    currencyCode,
    currencyName,
    currencySymbol,
  } = req.body; // destructuring

  try {
    // check if the user has an active membership allows him to create a business

    const userMembership = await MemberShip.findOne({
      user: userId,
      isActive: true,
    });

    if (!userMembership) {
      return res.status(500).json({
        error: "Something Went Wrong",
        message:
          "You don't have an active membership, please got to packges, and select your package",
      });
    }

    // if user has a membership check if he can create a business
    const userEligibilty = await Eligibility.findOne({ userId });
    const businessesEligibilty = userEligibilty.businesses;

    if (businessesEligibilty === 0) {
      return res.status(500).json({
        error: "Sorry",
        message:
          "You don't have any businesses left, you can upgrade your plan from Pacakges page",
      });
    }

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
      currencyCode,
      currencyName,
      currencySymbol,
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

    await Eligibility.updateMany({ userId }, { $inc: { businesses: -1 } });

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
    currencyCode,
    currencyName,
    currencySymbol,
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
          currencyCode,
          currencyName,
          currencySymbol,
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

    const businessOwner = await BusinessUsers.findOne({
      businessId,
      isBusinessOwner: true,
    });
    const businessOwnerId = businessOwner.userId;
    const userEligibilty = await Eligibility.findOne({
      userId: businessOwnerId,
    });

    await Eligibility.updateOne(
      { userId: businessOwnerId },
      { $inc: { businesses: 1 } }
    );

    await Business.deleteOne({ _id: businessId });

    return res.status(200).json({ message: "Business deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

//exporting router
module.exports = router;
