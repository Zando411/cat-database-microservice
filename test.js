require('dotenv').config();
const axios = require('axios');

const PORT = process.env.PORT || 3014;

const cats = [
  {
    name: 'Fluffy',
    age: 5,
    sex: 'Female',
    breed: 'Shorthair',
    color: 'white',
    owner: 'example@test.com',
    city: 'Albany',
    state: 'Oregon',
  },
  {
    name: 'Chaos',
    age: 6,
    sex: 'Male',
    breed: 'Shorthair',
    color: 'black',
    owner: 'michael@test.com',
    city: 'Corvallis',
    state: 'Oregon',
  },
  {
    name: 'Jumbo',
    age: 7,
    sex: 'Male',
    breed: 'Maine Coon',
    color: 'brown',
    owner: 'user@catlover.com',
    city: 'New York',
    state: 'NY',
  },
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

async function getCats() {
  try {
    const response = await axios.get(
      `http://localhost:${PORT}/api/cats?color=black&age=6`
    );

    console.log('Cat retrieved:', response.data);
  } catch (error) {
    console.error('Error during get:', error.response.data.error);
  }
}

async function getCatsRadius(radius) {
  try {
    const response = await axios.get(
      `http://localhost:${PORT}/api/cats?radius=${radius}&lat=44.5645659&lon=-123.2620435`
    );

    console.log('Cat retrieved:', response.data);
  } catch (error) {
    console.error('Error during get:', error.response.data.error);
  }
}

// cats.forEach((cat) => uploadCat(cat));

// getCatsRadius(50);

// getCats();
