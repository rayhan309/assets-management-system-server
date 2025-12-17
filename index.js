const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");
const stripe = require("stripe")(
  "sk_test_51Sc6AY3DE7BIUMWP12sSAXkuwVokEbTW9YxtWm4qyExNSa4DmsEc8wgKsqLBiJxw5IX8jQN05KpTWo4saTh2ng0300aAoR9BkM"
);

const serviceAccount = require("./firebase-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middlewre
app.use(cors());
app.use(express.json());

// veryfy firebase token
const verifyFirebaseToken = async (req, res, next) => {
  // console.log(req.headers.authorization );
  const firebaseToken = req.headers.authorization;
  // console.log(firebaseToken);
  if (!firebaseToken) {
    return res.status(401).send({ message: "invalid accesss" });
  }

  try {
    const token = firebaseToken.split(" ")[1];
    const verify = await admin.auth().verifyIdToken(token);
    req.current_user = verify?.email;
    // console.log("verify token", verify);
  } catch {
    // console.log("mumma khaisu2!");
    return res.status(401).send({ message: "Unexpacted access" });
  }

  next();
};

// mogo DB
const uri = process.env.DB_uri;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const myCollections = client.db("corporate");
    const usersCollection = myCollections.collection("users");
    const assetsCollection = myCollections.collection("assets");
    const requestsCollection = myCollections.collection("requests");
    const priceingCollection = myCollections.collection("priceing");
    const approvedAssetsCollection = myCollections.collection("approvedAssets");
    const paymentCollection = myCollections.collection("payments");

    // priching apis
    app.post("/priceing", async (req, res) => {
      const query = req.body;
      const result = await priceingCollection.insertOne(query);
      res.send(result);
    });

    app.get("/priceing", async (req, res) => {
      const result = await priceingCollection.find().toArray();
      res.send(result);
    });

    // users apis
    app.post("/users", async (req, res) => {
      try {
        const newUser = req.body;

        const exUser = await usersCollection.findOne({ email: newUser.email });

        if (exUser) {
          return res.send({ message: "this user alrady created account" });
        }

        newUser.accountAt = new Date();
        // console.log(newUser);
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      } catch {
        res.status(500).send({ error: "Database insert failed" });
      }
    });

    app.get("/users", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email };

        const result = await usersCollection.findOne(query);
        res.send(result);
      } catch {
        res.status(500).send({ error: "Database insert failed" });
      }
    });

    app.patch("/users/:id", async (req, res) => {
      try {
        const { pakage } = req.body;
        const id = req.params.id;
        const query = { _id: id };
        const updateUser = {
          $set: {
            role: pakage,
          },
        };

        const result = await usersCollection.updateOne(query, updateUser);
        res.send(result);
      } catch {
        res.status(500).send({ error: "Database patch failed" });
      }
    });

    // assets apis
    app.post("/assets", async (req, res) => {
      try {
        const newAssets = req.body;
        newAssets.postAt = new Date();
        newAssets.requestCount = 0;
        const result = await assetsCollection.insertOne(newAssets);
        res.send(result);
      } catch {
        res.status(500).send({ error: "Database insert failed" });
      }
    });

    app.get("/assets", verifyFirebaseToken, async (req, res) => {
      // console.log(req.headers.authorization);
      try {
        const { email } = req.query;
        const query = {};

        if (email) {
          query.hrEmail = email;
        }
        const result = await assetsCollection
          .find(query)
          .sort({ postAt: -1 })
          .toArray();
        res.send(result);
      } catch {
        // console.log("mumma khaisu!");
        res.status(500).send({ error: "Database insert failed" });
      }
    });

    app.delete("/assets/:id", verifyFirebaseToken, async (req, res) => {
      // console.log(req.headers.authorization);
      try {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };

        const result = await assetsCollection.deleteOne(query);
        res.send(result);
      } catch {
        // console.log("mumma khaisu!");
        res.status(500).send({ error: "Database delete failed" });
      }
    });

    // assets requests apis
    app.post("/requests", async (req, res) => {
      try {
        const newRequest = req.body;
        const result = await requestsCollection.insertOne(newRequest);

        const { assetId } = req.body;
        const query = { _id: new ObjectId(assetId) };
        const updateDoc = {
          $inc: {
            requestCount: 1,
          },
        };

        const updateResult = await assetsCollection.updateOne(query, updateDoc);

        res.send({ result, updateResult });
      } catch {
        res.status(500).send({ error: "Database post failed" });
      }
    });

    app.get("/requests", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.requesterEmail = email;
      }

      const result = await requestsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/requests/role", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.hrEmail = email;
      }

      const result = await requestsCollection
        .find(query)
        .sort({ requestDate: -1 })
        .toArray();
      res.send(result);
    });

    app.patch("/requests/:id/reject", verifyFirebaseToken, async (req, res) => {
      try {
        const { status, hrEmail } = req.body;
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            requestStatus: status,
          },
        };
        // console.log({ status: status, hrEmail: hrEmail });

        const result = await requestsCollection.updateOne(query, updateDoc);

        // pakege back to hr
        // const queryEmail = { hrEmail };
        // const updatePakage = {
        //   $inc: {

        //   }
        // }
        // const updateHrPakage = await usersCollection.updateOne(query);

        res.send(result);
      } catch {
        res.status(500).send({ error: "Database employeis get failed" });
      }
    });

    app.patch(
      "/requests/:id/approve",
      verifyFirebaseToken,
      async (req, res) => {
        try {
          const {
            hrEmail,
            assetId,
            assetName,
            assetType,
            requesterEmail,
            employeImage,
            requesterName,
            companyName,
            assetImage = "kfskjdf",
          } = req.body;

          if (
            !hrEmail ||
            !assetId ||
            !requesterEmail ||
            !companyName ||
            !requesterName ||
            !assetName ||
            !assetType ||
            !assetImage
          ) {
            return res
              .status(400)
              .send({ error: "Missing required fields in request body" });
          }

          // reques update
          const id = req.params.id;
          const query = { _id: new ObjectId(id) };
          const updateDoc = {
            $set: {
              requestStatus: "approved",
              approvalDate: new Date(),
            },
          };
          const result = await requestsCollection.updateOne(query, updateDoc);

          // assets update
          const queryAssetId = { _id: new ObjectId(assetId) };
          const updateAssetDoc = {
            $inc: {
              availableQuantity: -1,
            },
          };
          const assetUpdate = await assetsCollection.updateOne(
            queryAssetId,
            updateAssetDoc
          );

          // hr employ limit minus
          const hrEmailQuery = { email: hrEmail };
          const updateHRDoc = {
            $inc: {
              currentEmployees: 1,
            },
          };
          const updateHrPakage = await usersCollection.updateOne(
            hrEmailQuery,
            updateHRDoc
          );

          // user company fild update
          const updateEmployeDoc = {
            $set: {
              message: "affiliated",
              companyStatus: "Companye Join",
            },
            $push: {
              newJoinCompaye: {
                companyName: companyName,
                joinedDate: new Date(),
              },
            },
          };

          const addEmloyeCompanyNAme = await usersCollection.updateOne(
            { email: requesterEmail },
            updateEmployeDoc
          );

          // console.log(updateEmployeDoc, requesterEmail);
          // add assigned assets collection
          const newAssignedAsset = {
            assetId,
            assetName,
            assetType,
            assetImage,
            employeeName: requesterName,
            employeeEmail: requesterEmail,
            employeImage: employeImage,
            hrEmail,
            companyName,
            assignmentDate: new Date(),
            returnDate: assetType,
            status: "assigned",
          };

          const newAssignedAssetInsert =
            await approvedAssetsCollection.insertOne(newAssignedAsset);

          // console.log(hrEmail);
          res.send({ status: "ok" });
        } catch {
          res.status(500).send({ error: "Database patch failed" });
        }
      }
    );

    app.get("/approvedAssets", verifyFirebaseToken, async (req, res) => {
      try {
        const hrEmail = req.query.email;
        const query = { hrEmail };
        const result = await approvedAssetsCollection
          .find(query)
          .project({
            employeeEmail: 1,
            _id: 1,
            employeeName: 1,
            employeImage: 1,
            assignmentDate: 1,
          })
          .toArray();
        // console.log("hahahhahahahahhaha");
        res.send(result);
      } catch {
        res.status(500).send({ error: "Database post failed" });
      }
    });

    app.get(
      "/approvedAssets/company",
      verifyFirebaseToken,
      async (req, res) => {
        try {
          const companyName = req.query.companyName;
          const query = { companyName };
          const result = await approvedAssetsCollection.find(query).toArray();
          res.send(result);
        } catch {
          res.status(500).send({ error: "Database find filed." });
        }
      }
    );

    app.delete("/approvedAssets/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await approvedAssetsCollection.deleteOne(query);
        res.send(result);
      } catch {
        res.status(500).send({ error: "Database delete filed." });
      }
    });

    // payment apis
    app.post("/create-checkout-session", async (req, res) => {
      const { price, customerEmail, name, _id, employeeLimit } = req.body;
      const amoutn = parseInt(price * 100);
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency: "usd",
              product_data: {
                name: name,
              },
              unit_amount: amoutn,
            },
            quantity: 1,
          },
        ],
        customer_email: customerEmail,
        metadata: {
          customerEmail,
          subscriptionsId: _id,
          subscriptionsName: name,
          employeeLimit: employeeLimit,
        },
        mode: "payment",
        success_url: `${process.env.SUCCESS_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SUCCESS_DOMAIN}/dashboard/payment-cancle`,
      });
      console.log(req.body);
      res.send({ url: session.url });
    });

    //         const session = await stripe.checkout.sessions.retrieve(session_id);
    app.patch("/payment-success", verifyFirebaseToken, async (req, res) => {
      try {
        const { session_id } = req.query;

        // retrieve stripe session_id
        const session = await stripe.checkout.sessions.retrieve(session_id);

        const {
          amount_subtotal: amount,
          customer_email,
          metadata,
          payment_intent,
          payment_status,
        } = session;

        if (payment_status === "paid") {
          // check to datbase payment alrady korse ki na
          const transactionIdQuery = { transactionId: payment_intent };
          const exPayment = await paymentCollection.findOne(transactionIdQuery);

          if (exPayment) {
            return res.send({
              message: "This payment alrady save to database.",
              transactionId: payment_intent,
              amount: amount,
            });
          }

          // user pakage update
          const queryEmail = { email: customer_email };
          const updatePakage = {
            $set: {
              subscription: metadata.subscriptionsName,
              subscriptionDate: new Date(),
            },
            $inc: {
              packageEmployees: Number(metadata.employeeLimit),
            },
          };
          const updateResult = await usersCollection.updateOne(
            queryEmail,
            updatePakage
          );

          // add payment histories
          const newPaynent = {
            paymentUserEmail: customer_email,
            transactionId: payment_intent,
            pricingId: metadata.subscriptionsId,
            pricingName: metadata.subscriptionsName,
            employeeLimit: metadata.employeeLimit,
          };

          const newPaynentAdd = await paymentCollection.insertOne(newPaynent);

          // console.log({ metadata });
          res.send({
            transactionId: payment_intent,
            amount: Number(amount) / 100,
          });
        }
      } catch {
        res.status(500).send({ error: "Database patch filed." });
      }
    });

    app.get("/payment", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.query.email;
        const query = { paymentUserEmail: email };
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
      } catch {
        res.status(500).send({ error: "Database payment get is filed." });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send({ status: "ok", message: "this server is runnign!" });
});

app.listen(port, () => {
  console.log(`This server listening on port ${port}`);
});
