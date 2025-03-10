require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const cors = require('cors');

const PORT = process.env.PORT || 3014;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());

const client = new MongoClient(MONGO_URI);

async function connectToDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB successfully');
  } catch (e) {
    console.error('Error connecting to the database', e);
    process.exit(1);
  }
}
connectToDB();

const db = client.db('CatsDB');
const collection = db.collection('cats');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCoordinates(city, state) {
  await wait(1000); // rate limit the geocoding API

  try {
    const response = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: { q: `${city}, ${state}`, format: 'json', limit: 1 },
        headers: { 'User-Agent': 'CatCall' },
      }
    );

    if (response.data.length > 0) {
      const location = response.data[0];
      return {
        latitude: parseFloat(location.lat),
        longitude: parseFloat(location.lon),
      };
    } else {
      throw new Error('Location not found');
    }
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null; // Handle missing location gracefully
  }
}

// endpoints
app.post('/api/uploadCat', async (req, res) => {
  const { name, age, sex, breed, color, owner, city, state } = req.body.cat;

  if (!name || !age || !sex || !breed || !color || !owner || !city || !state) {
    return res.status(400).json({ error: 'Missing cat data' });
  }

  const coordinates = await getCoordinates(city, state);
  if (!coordinates) {
    return res.status(400).json({ error: 'Invalid location' });
  }

  const catData = {
    _id: uuidv4(),
    name,
    age,
    sex,
    breed,
    color,
    owner,
    city,
    state,
    location: {
      type: 'Point',
      coordinates: [coordinates.longitude, coordinates.latitude], // [lon, lat]
    },
  };

  try {
    const result = await collection.insertOne(catData);
    console.log(result);
    res.json({ message: 'Cat uploaded' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error uploading cat' });
  }
});

// GET /api/cats that supports query parameters
app.get('/api/cats', async (req, res) => {
  try {
    const query = {};
    if (req.query.owner) {
      query.owner = req.query.owner;
      const cats = await db.collection('cats').find(query).toArray();
      res.json(cats);
      return;
    }
    if (req.query.color) {
      query.color = req.query.color;
    }
    if (req.query.age) {
      query.age = parseInt(req.query.age);
    }
    if (req.query.sex) {
      query.sex = req.query.sex;
    }
    if (req.query.breed) {
      query.breed = req.query.breed;
    }
    if (req.query.lat && req.query.lon && req.query.radius) {
      const latitude = parseFloat(req.query.lat);
      const longitude = parseFloat(req.query.lon);
      const radiusInMeters = parseFloat(req.query.radius) * 1609.34;
      query.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: [longitude, latitude] },
          $maxDistance: radiusInMeters,
        },
      };
    }

    // TODO: add pagination

    const cats = await db.collection('cats').find(query).toArray();
    res.json(cats);
    console.log(cats);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error getting cat' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
