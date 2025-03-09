require('dotenv').config();
const axios = require('axios');

const PORT = process.env.PORT || 3014;

const cats = [
  { name: 'Fluffy', age: 2, color: 'black', owner: 'example@test.com' },
  { name: 'Whiskers', age: 3, color: 'orange', owner: 'example@test.com' },
  { name: 'Mittens', age: 5, color: 'black', owner: 'example@test.com' },
];

async function uploadCat(cat) {
  try {
    const response = await axios.post(
      `http://localhost:${PORT}/api/uploadCat`,
      {
        cat: cat,
      }
    );

    console.log('Cat upload:', response.data.message);
  } catch (error) {
    console.error('Error during upload:', error.response.data.error);
  }
}

cats.forEach((cat) => uploadCat(cat));
