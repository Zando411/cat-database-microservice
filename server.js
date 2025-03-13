require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const cors = require('cors');

const PORT = process.env.PORT || 3014;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// set up local storage for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const owner = req.body.owner;
    if (!owner) {
      return cb(new Error('Owner ID is required'));
    }

    const uploadPath = path.join(__dirname, 'uploads', owner);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    req.catUUID = uuidv4();
    cb(null, req.catUUID + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// connect to MongoDB
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

// helper function to rate limit geocoding API
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// helper function to get coordinates from city and state
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
app.post(
  '/api/uploadCat',
  upload.fields([{ name: 'image', maxCount: 1 }]),
  async (req, res) => {
    const { name, age, sex, breed, color, owner, city, state } = req.body;
    console.log('Cat storage request: ', req.body);

    if (
      !name ||
      !age ||
      !sex ||
      !breed ||
      !color ||
      !owner ||
      !city ||
      !state
    ) {
      return res.status(400).json({ error: 'Missing cat data' });
    }

    if (!req.files.image) {
      console.log(req.files.image);
      return res.status(400).json({ error: 'Image is required' });
    }

    const coordinates = await getCoordinates(city, state);
    if (!coordinates) {
      return res.status(400).json({ error: 'Invalid location' });
    }

    const catUUID = req.catUUID;
    const imagePath = path.join(
      __dirname,
      'uploads',
      owner,
      catUUID + path.extname(req.files.image[0].originalname)
    );

    const catData = {
      _id: catUUID,
      name,
      age,
      sex,
      breed,
      color,
      owner,
      city,
      state,
      imagePath,
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
  }
);

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
    if (req.query.minAge || req.query.maxAge) {
      query.age = {};
      if (req.query.minAge) {
        query.age.$gte = parseInt(req.query.minAge);
      }
      if (req.query.maxAge) {
        query.age.$lte = parseInt(req.query.maxAge);
      }
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const cats = await collection.find(query).skip(skip).limit(limit).toArray();
    res.json({ cats, page, limit });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error getting cat' });
  }
});

// GET /api/cats/:id to retrieve a single cat by ID
app.get('/api/cats/:id', async (req, res) => {
  try {
    const query = { _id: req.params.id };

    const cat = await db.collection('cats').findOne(query);

    if (!cat) {
      return res.status(404).json({ error: 'Cat not found' });
    }

    res.json(cat);
    console.log(cat);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: `Error getting cat` });
  }
});

app.get('/api/catImage/:owner/:catID', async (req, res) => {
  const { owner, catID } = req.params;
  const imagePath = path.join(__dirname, 'uploads', owner, catID);

  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
});

// Update an existing cat profile
app.put('/api/cats/:id', async (req, res) => {
  try {
    const updatedCat = await db
      .collection('cats')
      .findOneAndUpdate(
        { _id: req.params.id },
        { $set: req.body },
        { returnDocument: 'after' }
      );
    if (!updatedCat) {
      return res.status(404).json({ error: 'Cat not found' });
    }
    res.json({ message: 'Cat updated', updatedCat: updatedCat });
  } catch (error) {
    res.status(500).json({ error: 'Error updating cat' });
  }
});

// Delete a cat profile
app.delete('/api/cats/:id', async (req, res) => {
  try {
    const deletedCat = await db
      .collection('cats')
      .findOneAndDelete({ _id: req.params.id });
    if (!deletedCat) {
      return res.status(404).json({ error: 'Cat not found' });
    }
    res.json({ message: 'Cat deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting cat' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
