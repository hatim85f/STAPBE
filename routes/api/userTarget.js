const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const UserTarget = require("../../models/UserTarget");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");

// @route   GET api/userTarget
// @desc    Get all userTargets
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    return res.status(200).send({ message: "Route is working" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   POST api/userTarget
// @desc    Add new userTarget
// @access  Private only admin or business owner
router.post("/", auth, isCompanyAdmin, async (req, res) => {
  const { userTargetData, year } = req.body;

  let message = [];
  let tailMessage;

  try {
    for (let data of userTargetData) {
      const isUserTarget = await UserTarget.findOne({ userId: data._id });

      if (isUserTarget) {
        const sameYearIndex = isUserTarget.productsTargets.findIndex(
          (target) => target.year === year
        );

        if (sameYearIndex !== -1) {
          const sameYearTarget =
            isUserTarget.productsTargets[sameYearIndex].target;

          const sameProductIndex = sameYearTarget.findIndex(
            (prod) => prod.productId.toString() === data.productId
          );

          if (sameProductIndex !== -1) {
            // Product exists for the specified year, update the target
            await UserTarget.updateOne(
              {
                userId: data._id,
                "productsTargets.year": year,
              },
              {
                $set: {
                  "productsTargets.$[yearFilter].target.$[productFilter].targetUnits":
                    data.targetUnits,
                  "productsTargets.$[yearFilter].target.$[productFilter].targetValue":
                    data.targetValue,
                },
              },
              {
                arrayFilters: [
                  { "yearFilter.year": year },
                  { "productFilter.productId": data.productId },
                ],
              }
            );
            message.push(`${data.userName}`);
            tailMessage = "updated Successfully";
          } else {
            await UserTarget.updateOne(
              { userId: data._id, "productsTargets.year": year },
              {
                $push: {
                  "productsTargets.$.target": {
                    productId: data.productId,
                    targetUnits: data.targetUnits,
                    targetValue: data.targetValue,
                  },
                },
              }
            );
            message.push(`${data.userName}`);
            tailMessage = "added Successfully";
          }
        } else {
          // Year doesn't exist, add a new object with the target
          await UserTarget.updateMany(
            {
              userId: data._id,
            },
            {
              $push: {
                productsTargets: {
                  year: year,
                  target: [
                    {
                      productId: data.productId,
                      targetUnits: data.targetUnits,
                      targetValue: data.targetValue,
                    },
                  ],
                },
              },
            }
          );
          message.push(`${data.userName}`);
          tailMessage = `for ${year} added sucessfully`;
        }
      } else {
        // User doesn't have any targets, create a new document
        const newUserTarget = new UserTarget({
          userId: data._id,
          productsTargets: [
            {
              year: year,
              target: [
                {
                  productId: data.productId,
                  targetUnits: data.targetUnits,
                  targetValue: data.targetValue,
                },
              ],
            },
          ],
        });

        await UserTarget.insertMany(newUserTarget);

        message.push(`${data.userName}`);
        tailMessage = `for ${year} has been created successfully`;
      }
    }

    return res.status(200).send({
      message: `Target for ${message.join(", ")} ${tailMessage}`,
    });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

module.exports = router;
