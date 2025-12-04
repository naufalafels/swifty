// src/data/carsData.js
import HC1 from "/../assets/HC1.png";
import HC2 from "/../assets/HC2.png";
import HC3 from "/../assets/HC3.png";
import HC4 from "/../assets/HC4.png";

const carsData = [
  {
    id: 1,
    name: "Toyota Yaris",
    type: "Compact Auto",
    price: 90,
    image: HC1,
    description: "Reliable, fuel-efficient commuter.",
    seats: 5,
    fuel: "Gasoline",
    transmission: "Automatic"
  },
  {
    id: 2,
    name: "Toyota Camry",
    type: "Eco-Friendly Sedan",
    price: 200,
    image: HC2,
    description: "Hybrid with modern tech.",
    seats: 5,
    fuel: "Gasoline",
    transmission: "Automatic"
  },
  {
    id: 3,
    name: "Toyota Kluger",
    type: "Intermediate SUV",
    price: 250,
    image: HC3,
    description: "Practical 7-Seater SUV with punchy engine.",
    seats: 7,
    fuel: "Gasoline",
    transmission: "Automatic"
  },
  {
    id: 4,
    name: "Van",
    type: "Cargo Van",
    price: 150,
    image: HC4,
    description: "Van for UTEs",
    seats: 2,
    fuel: "Diesel",
    transmission: "Automatic"
  },
];

export default carsData;