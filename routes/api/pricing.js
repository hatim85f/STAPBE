const express = require("express");
const router = express.Router();

const Pricing = require("../../models/Pricing");

// @route   GET api/pricing
// @desc    Get all pricing
// @access  Public
router.get("/", async (req, res) => {
  try {
    const pricing = await Pricing.find();
    res.json(pricing);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET api/pricing/:id
// @desc    Get pricing by ID
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const pricing = await Pricing.find({ _id: req.params.id });

    if (!pricing) {
      return res.status(404).json({ msg: "Pricing not found" });
    }

    res.json(pricing);
  } catch (err) {
    console.error(err.message);

    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Pricing not found" });
    }

    res.status(500).send("Server Error");
  }
});

// @route   POST api/pricing
// @desc    Create or update pricing
// @access  Public
router.post("/", async (req, res) => {
  const {
    name,
    businesses,
    team_members,
    admins,
    clients,
    visualized_report,
    inventory,
    manufacturing_management,
    supply_chain_management,
    marketing_management,
    invoicing,
    payment_link_creation,
    sales_management,
  } = req.body;

  // Build pricing object
  const pricingFields = {};
  if (name) pricingFields.name = name;
  if (businesses) pricingFields.businesses = businesses;
  if (team_members) pricingFields.team_members = team_members;
  if (admins) pricingFields.admins = admins;
  if (clients) pricingFields.clients = clients;
  if (visualized_report) pricingFields.visualized_report = visualized_report;
  if (inventory) pricingFields.inventory = inventory;
  if (manufacturing_management)
    pricingFields.manufacturing_management = manufacturing_management;
  if (supply_chain_management)
    pricingFields.supply_chain_management = supply_chain_management;
  if (marketing_management)
    pricingFields.marketing_management = marketing_management;
  if (invoicing) pricingFields.invoicing = invoicing;
  if (payment_link_creation)
    pricingFields.payment_link_creation = payment_link_creation;
  if (sales_management) pricingFields.sales_management = sales_management;

  try {
    let pricing = await Pricing.findOne({ name });

    if (pricing) {
      // Update
      pricing = await Pricing.findOneAndUpdate(
        { name },
        { $set: pricingFields },
        { new: true }
      );

      return res.json(pricing);
    }

    // Create
    pricing = new Pricing(pricingFields);

    await Pricing.insertMany(pricing);
    res.json(pricing);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   PUT api/pricing/:id
// @desc    Update pricing
// @access  Public
router.put("/:id", async (req, res) => {
  const {
    name,
    businesses,
    team_members,
    admins,
    clients,
    visualized_report,
    inventory,
    manufacturing_management,
    supply_chain_management,
    marketing_management,
    invoicing,
    payment_link_creation,
    sales_management,
  } = req.body;

  // Build pricing object
  const pricingFields = {};
  if (name) pricingFields.name = name;
  if (businesses) pricingFields.businesses = businesses;
  if (team_members) pricingFields.team_members = team_members;
  if (admins) pricingFields.admins = admins;
  if (clients) pricingFields.clients = clients;
  if (visualized_report) pricingFields.visualized_report = visualized_report;
  if (inventory) pricingFields.inventory = inventory;
  if (manufacturing_management)
    pricingFields.manufacturing_management = manufacturing_management;
  if (supply_chain_management)
    pricingFields.supply_chain_management = supply_chain_management;
  if (marketing_management)
    pricingFields.marketing_management = marketing_management;
  if (invoicing) pricingFields.invoicing = invoicing;
  if (payment_link_creation)
    pricingFields.payment_link_creation = payment_link_creation;
  if (sales_management) pricingFields.sales_management = sales_management;

  try {
    let pricing = await Pricing.updateMany(
      { _id: req.params.id },
      {
        $set: pricingFields,
      }
    );

    if (!pricing) {
      return res.status(404).json({ msg: "Pricing not found" });
    }

    res.json(pricing);
  } catch (err) {
    console.error(err.message);

    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Pricing not found" });
    }

    res.status(500).send("Server Error");
  }
});

// @route   DELETE api/pricing/:id
// @desc    Delete pricing
// @access  Public
router.delete("/:id", async (req, res) => {
  try {
    const pricing = await Pricing.find({ _id: req.params.id });

    if (!pricing) {
      return res.status(404).json({ msg: "Pricing not found" });
    }

    await pricing.remove();

    res.json({ msg: "Pricing removed" });
  } catch (err) {
    console.error(err.message);

    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Pricing not found" });
    }

    res.status(500).send("Server Error");
  }
});

module.exports = router;
