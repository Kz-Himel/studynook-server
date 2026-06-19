const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Mongo Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ================= FIXED JWKS =================
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

// ================= JWT VERIFY MIDDLEWARE =================
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload; // 👈 important
    next();
  } catch (err) {
    console.log("JWT ERROR:", err);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// ================= MAIN =================
async function run() {
  try {
    await client.connect();

    const db = client.db("StudyNook");
    const roomsCollection = db.collection("rooms");
    const bookingsCollection = db.collection("my-bookings");

    // ================= ROOMS =================

    app.get("/rooms", async (req, res) => {
      const result = await roomsCollection.find().toArray();
      res.json(result);
    });

    app.post("/rooms", async (req, res) => {
      const result = await roomsCollection.insertOne(req.body);
      res.json(result);
    });

    app.get("/rooms/:id", async (req, res) => {
      try {
        const result = await roomsCollection.findOne({
          _id: new ObjectId(req.params.id),
        });

        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.put("/rooms/:id", async (req, res) => {
      try {
        const updatedData = req.body;
        delete updatedData._id;

        const result = await roomsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updatedData },
        );

        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.delete("/rooms/:id", async (req, res) => {
      try {
        const result = await roomsCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ================= BOOKINGS =================

    // GET MY BOOKINGS (Secured)
    app.get("/my-bookings", verifyToken, async (req, res) => {
      console.log("JWT USER:", req.user);

      const result = await bookingsCollection
        .aggregate([
          {
            $match: {
              userId: req.user.sub,
            },
          },
          {
            $lookup: {
              from: "rooms",
              localField: "roomId",
              foreignField: "_id",
              as: "room",
            },
          },
          {
            $unwind: {
              path: "$room",
              preserveNullAndEmptyArrays: true,
            },
          },
        ])
        .toArray();

      console.log("FOUND:", result);

      res.json(result);
    });

    // CREATE BOOKING
    app.post("/my-bookings", verifyToken, async (req, res) => {
      try {
        const booking = req.body;

        const newBooking = {
          ...booking,
          roomId: new ObjectId(String(booking.roomId)), // ✅ FIXED SAFE
          userId: req.user.sub,
          createdAt: new Date(),
          status: "confirmed",
        };

        const result = await bookingsCollection.insertOne(newBooking);

        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // DELETE BOOKING (SECURED)
    app.delete("/my-bookings/:id", verifyToken, async (req, res) => {
      try {
        const bookingId = req.params.id;
        const userId = req.user.sub;

        const result = await bookingsCollection.deleteOne({
          _id: new ObjectId(bookingId),
          userId: userId,
        });

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .json({ message: "Booking not found or unauthorized" });
        }

        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // DONT TOUCH===
    await client.db("admin").command({ ping: 1 });

    console.log("MongoDB connected successfully");
  } finally {
    // keep alive
  }
}

run().catch(console.dir);

// ROOT
app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
