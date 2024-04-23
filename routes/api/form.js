const express = require("express");
const router = express.Router();
const Form = require("../../models/Form");
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const sgMail = require("@sendgrid/mail");
const config = require("config");

const mailApi =
  process.env.NODE_ENV === "production"
    ? process.env.Mail_API_Key
    : config.get("Mail_API_Key");
const setcretToken =
  process.env.NODE_ENV === "production"
    ? process.env.jwtSecret
    : config.get("jwtSecret");

// @route   POST api/form
// @desc    Create a form
// @access  Private
router.post("/", auth, async (req, res) => {
  const { title, description, userId } = req.body;

  try {
    const newForm = new Form({
      title,
      description,
      createdBy: userId,
    });

    const user = await User.findOne({ _id: userId });

    sgMail.setApiKey(mailApi);

    // Send the email with SendGrid
    const msg = {
      to: user.email,
      from: "info@stap-crm.com",
      templateId: "d-ecc704d897ba4409b747f3422c9483c0", // Your dynamic template ID
      dynamicTemplateData: {
        user_name: user.userName, // Replace with your user's name field
        title: title,
        description: description,
      },
    };

    await sgMail.send(msg);

    const supportMail = {
      to: "info@codexpandit.com",
      from: "info@stap-crm.com",
      subject: "New Form Submission", // Add a subject for the email
      text: `New form submission details:\n\nUser: ${user.userName}\nTitle: ${title}\nDescription: ${description}\nUser ID: ${userId}`, // Plain text version of the email
      html: `<p>New form submission details:</p><ul><li>User: ${user.userName}</li><li>Title: ${title}</li><li>Description: ${description}</li><li>User ID: ${userId}</li></ul>`, // HTML version of the email (optional)
    };
    await sgMail.send(supportMail);

    await Form.insertMany(newForm);

    return res.status(200).json({
      message:
        "We have received your query and one of our team will contact you shoertly",
    });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .send({ message: "Something went wrong, please try again later" });
  }
});

module.exports = router;
