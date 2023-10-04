const crypto = require("crypto");
const config = require("config");

const endpointSecret =
  process.env.NODE_ENV === "production"
    ? process.env.WEBHOOK_SECRET
    : config.get("DEVELOPMENT_WEBHOOK_SECRET");

const createStripeSignatureHeader = (payload) => {
  const signature = crypto
    .createHmac("sha256", endpointSecret)
    .update(payload)
    .digest("hex");

  return signature;
};

module.exports = createStripeSignatureHeader;
