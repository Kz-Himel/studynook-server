const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("StudyNook");
    const roomsCollection = db.collection("rooms");
    const bookingsCollection = db.collection("my-bookings");

    // GET: For getting or create api and show data
    app.get("/rooms", async (req, res) => {
      const result = await roomsCollection.find().toArray();
      res.json(result);
    });

    // POST: For add room
    app.post("/rooms", async (req, res) => {
      const roomData = req.body;
      // console.log("Received Room:", roomData);
      const result = await roomsCollection.insertOne(roomData);
      // console.log("Mongo Result:", result);

      res.json(result);
    });

    // GET: Single room details
    app.get("/rooms/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await roomsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).json({ message: "Room not found" });
        }

        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
      }
    });

    // PUT: Update api forr update room data
    app.put("/rooms/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body;

        // safety: remove _id if sent from frontend
        delete updatedData._id;

        const result = await roomsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: updatedData,
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Room not found" });
        }

        res.json({
          message: "Room updated successfully",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
      }
    });

    // DELETE: for delete room
    app.delete("/rooms/:id", async (req, res) => {
      const { id } = req.params;
      const result = await roomsCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    // BOOKING COLLECTION START HERE

    // POST: Booking room by post method
    app.post("/my-bookings", async (req, res) => {
  const booking = req.body;

  const newBooking = {
    ...booking,
    roomId: new ObjectId(booking.roomId),
    userId: new ObjectId(booking.userId),
    createdAt: new Date(),
  };

  // 🔥 conflict check FIRST
  const exists = await bookingsCollection.findOne({
    roomId: newBooking.roomId,
    date: newBooking.date,
    status: "confirmed",
    startTime: { $lt: newBooking.endTime },
    endTime: { $gt: newBooking.startTime },
  });

  if (exists) {
    return res.status(400).send({
      message: "This time slot is already booked",
    });
  }

  // 🔥 insert ONLY ONCE
  const result = await bookingsCollection.insertOne(newBooking);

  res.send({
    success: true,
    insertedId: result.insertedId,
  });
});

    // GET: fetch my-bookings data
    app.get("/my-bookings/:userId", async (req, res) => {
  const userId = new ObjectId(req.params.userId);

  const result = await bookingsCollection.aggregate([
    {
      $match: { userId }
    },
    {
      $lookup: {
        from: "rooms",
        localField: "roomId",
        foreignField: "_id",
        as: "room"
      }
    },
    {
      $unwind: {
        path: "$room",
        preserveNullAndEmptyArrays: true
      }
    }
  ]).toArray();

  res.send(result);
});
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Data is Running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
