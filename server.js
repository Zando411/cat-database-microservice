require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
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

// endpoints
app.post('/api/uploadCat', async (req, res) => {
  const { name, age, color, owner } = req.body.cat;

  if (!name || !age || !color || !owner) {
    return res.status(400).json({ error: 'Missing cat data' });
  }

  const catData = {
    _id: uuidv4(),
    name,
    age,
    color,
    owner,
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
