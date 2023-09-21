const express = require("express");
const router = express.Router();
const sgMail = require("@sendgrid/mail");
const moment = require("moment");

const mailApi =
  process.env.NODE_ENV === "production"
    ? process.env.Mail_API_Key
    : config.get("Mail_API_Key");

// sedning email to user and stap team for requests

router.post("/send", async (req, res) => {
  const { email, name, message, phone, businessSize, businessType, country } =
    req.body;

  try {
    sgMail.setApiKey(mailApi);
    const msg = {
      to: "info@stap-crm.com",
      from: email,
      subject: "New Demo Request for STAP CRM",
      templateId: "d-637292d2e956458184205afe13dc362", // Your dynamic template ID
      dynamicTemplateData: {
        user_name: name,
        business_type: businessType,
        business_size: businessSize,
        user_email: email,
        user_number: phone,
        user_country: country,
        submission_date: moment().format("DD/MM/YYYY"),
        submission_time: moment().format("hh:mm a"),
        request_details: message,
      },
    };
    await sgMail.send(msg);

    const msg2 = {
      to: email,
      from: "info@stap-crm.com",
      subject: "STAP CRM Demo Request",
      templateId: "d-921ad27b05284f528b646bdcad0a14ef", // Your dynamic template ID
      dynamicTemplateData: {
        requestor_name: name,
        requestor_phone_number: phone,
        requestor_email: email,
      },
    };
    await sgMail.send(msg2);
    res.status(200).json({ message: "Password reset code sent successfully" });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

module.exports = router;
