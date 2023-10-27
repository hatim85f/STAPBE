const BusinessUsers = require("../models/BusinessUsers");
const User = require("../models/User");

// Create a middleware function to check if a user is authorized (SuperAdmin or Organizer)
module.exports = async (req, res, next) => {
  const userId = req.header("user-id");

  const user = await User.findOne({ _id: userId });
  const userType = user.userType;

  if (userType === "Business Owner" || userType === "Business Admin") {
    // If the user is authorized, continue to the next middleware/route handler
    next();
  } else {
    return res.status(403).json({
      error: "Unauthorized",
      message:
        "You are not authorized to perform this action. please contact your admin.",
    });
  }
};
