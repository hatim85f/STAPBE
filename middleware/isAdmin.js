const Admins = require("../models/Admins");

// Create a middleware function to check if a user is authorized (SuperAdmin or Organizer)
module.exports = async (req, res, next) => {
  const adminId = req.header("adminId");

  const admin = await Admins.findOne({ _id: adminId });
  if (!admin) {
    return res.status(403).json({
      error: "Unauthorized",
      message: "You are not authorized to perform this action.",
    });
  }

  // Check if the user has the required roles (SuperAdmin or Organizer)
  if (admin.role === "SuperAdmin" || admin.role === "Organizer") {
    // If the user is authorized, continue to the next middleware/route handler
    next();
  } else {
    return res.status(403).json({
      error: "Unauthorized",
      message: "You are not authorized to perform this action.",
    });
  }
};
