const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

const { MongoClient, ServerApiVersion } = require('mongodb');
dotenv.config();
const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("StudyNook");
    const roomsCollection = db.collection("rooms");

    // GET: For getting or create api and show data
    app.get('/rooms', async (req, res) => {
      const result = await roomsCollection.find().toArray();
      res.json(result);
    })

    // POST: For add room
    app.post("/rooms", async (req, res) => {
      const roomData = req.body
      // console.log("Received Room:", roomData);
      const result = await roomsCollection.insertOne(roomData);
      // console.log("Mongo Result:", result);

      res.json(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Data is Running");
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})