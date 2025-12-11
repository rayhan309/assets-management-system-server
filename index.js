const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

// middlewre
app.use(cors());
app.use(express.json());

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

    // users apis
    app.post("/users", async (req, res) => {
      try {
        const newUser = req.body;
        
        const exUser = await usersCollection.findOne({email: newUser.email});
        if(exUser) {
            return res.send({message: 'this user alrady create account'});
        }
        
        // console.log(newUser);
        newUser.accountAt = new Date();
        const result = await usersCollection.insertOne(newUser);
        res.send(result);

      } catch {
        res.status(500).send({ error: "Database insert failed" });
      }
    });

    app.post('/assets', async(req, res) => {
      try{
      const newAssets = req.body;
      newAssets.postAt = new Date();
      newAssets.requestCount = 0;
      const result = await assetsCollection.insertOne(newAssets);
      res.send(result);
      }catch {
        res.status(500).send({ error: "Database insert failed" });
      }
    });

    app.get('/assets', async (req, res) => {
      try{
        const {email} = req.query;
        const query = {};

        if(email) {
          query.senderEmail = email;
        }
        const result = await assetsCollection.find(query).toArray();
        res.send(result);
      }catch{
        res.status(500).send({ error: "Database insert failed" });
      }
    })

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
