const express = require("express");
const router = express.Router();
const Partner = require("../../models/Partner");
const Business = require("../../models/Business");
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");
const BusinessUsers = require("../../models/BusinessUsers");

// @route   GET api/partner
// @desc    Get all partners
// @access  Private
router.get("/:userId", auth, isCompanyAdmin, async (req, res) => {
  const { userId } = req.params;

  try {
    const businesses = await BusinessUsers.find({ userId: userId });

    const businessesIds = businesses.map((business) => business.businessId);

    const partners = await Partner.find({ business: { $in: businessesIds } });

    return res.status(200).json(partners);
  } catch (error) {
    return res
      .status(500)
      .json({
        message: "We are facing a server issue, please try again later",
      });
  }
});

// @route   POST api/partner
// @desc    Create a new partner
// @access  Private
router.post("/", auth, isCompanyAdmin, async (req, res) => {
  const {
    business,
    name,
    email,
    phone,
    profileImage,
    address,
    idType,
    idImage,
    idNumber,
    idExpire,
    bankName,
    bankIBAN,
    percentage,
    dateOfStart,
    responsibilities,
    investementAmount,
    DOB,
    password,
  } = req.body;

  try {
    // hasing the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // // create a normal user with a role of partner
    const newUser = User({
      userName: name,
      email,
      phone,
      profilePicture: profileImage,
      DOB,
      joiningDate: dateOfStart,
      userType: "Partner",
      firstName: name.split(" ")[0],
      lastName: name.split(" ")[1],
      password: hashedPassword,
      biometricEnabled: false,
      designation: "Partner",
      emailVerified: false,
      phoneVerified: false,
      isAuthorized: false,
      authority: ["Partner"],
      isActivated: true,
      investementAmount,
    });

    await newUser.save();

    // // change idExpire string to date
    const day = idExpire.split("/")[0];
    const month = idExpire.split("/")[1];
    const year = idExpire.split("/")[2];

    const idExpireDate = new Date(year, month - 1, day);

    const newPartner = new Partner({
      business,
      name,
      email,
      phone,
      profileImage,
      address,
      idDetails: [
        {
          idType,
          idImage,
          idNumber,
          idExpire: idExpireDate,
        },
      ],
      bankDetails: [
        {
          bankName,
          bankIBAN,
        },
      ],
      percentage,
      investementAmount,
      dateOfStart,
      responsibilities,
      DOB,
    });

    await Partner.insertMany(newPartner);

    const newBusinessUser = new BusinessUsers({
      userId: newUser._id,
      businessId: business,
      isBusinessOwner: false,
    });

    await BusinessUsers.insertMany(newBusinessUser);

    return res.status(200).json({
      message: `Partner ${name} created successfully, and a user account is created successfully`,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error, Please try again later" });
  }
});

router.put("/:id", auth, async (req, res) => {
  const { id } = req.params;
  const {
    name,
    email,
    phone,
    profileImage,
    address,
    idType,
    idImage,
    idNumber,
    idExpire,
    bankName,
    bankIBAN,
    percentage,
    dateOfStart,
    responsiblitites,
    investementAmount,
    DOB,
  } = req.body;

  try {
    const partner = await Partner.findOne({ _id: id });

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    //change idExpire string to date if the type is string
    if (typeof idExpire === "string") {
      const day = idExpire.split("/")[0];
      const month = idExpire.split("/")[1];
      const year = idExpire.split("/")[2];

      idExpire = new Date(year, month - 1, day);
    }

    await Partner.updateMany(
      {
        _id: id,
      },
      {
        $set: {
          name,
          email,
          phone,
          profileImage,
          address,
          idDetails: [
            {
              idType,
              idImage,
              idNumber,
              idExpire,
            },
          ],
          bankDetails: [
            {
              bankName,
              bankIBAN,
            },
          ],
          percentage,
          dateOfStart,
          investementAmount,
          responsiblitites,
          DOB,
        },
      }
    );

    return res.status(200).json({ message: "Partner updated successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error, Please try again later" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  const { id } = req.params;

  try {
    const partner = await Partner.findOne({ _id: id });

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    await Partner.deleteOne({ _id: id });

    return res.status(200).json({ message: "Partner deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error, Please try again later" });
  }
});

module.exports = router;
