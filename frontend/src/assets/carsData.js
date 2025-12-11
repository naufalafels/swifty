// src/data/carsData.js
import HC1 from "../assets/HC1.png";
import HC2 from "../assets/HC2.png";
import HC3 from "../assets/HC3.png";
import HC4 from "../assets/HC4.png";

const carsData = [
  {
    id: 5,
    name: "Toyota Yaris",
    type: "Compact Auto",
    price: 30,
    image: HC1,
    description: "Reliable, fuel-efficient commuter.",
    seats: 5,
    fuel: "Gasoline",
    transmission: "Automatic",
    year: "2007 >"
  },
  {
    id: 6,
    name: "Toyota Camry",
    type: "Eco-Friendly Sedan",
    price: 50,
    image: HC2,
    description: "Hybrid with modern tech.",
    seats: 5,
    fuel: "Gasoline",
    transmission: "Automatic",
    year: "2024 >"
  },
  {
    id: 7,
    name: "Toyota Kluger",
    type: "Intermediate SUV",
    price: 75,
    image: HC3,
    description: "Practical 7-Seater SUV with punchy engine.",
    seats: 7,
    fuel: "Gasoline",
    transmission: "Automatic",
    year: "2022 >"
  },
  {
    id: 8,
    name: "Van",
    type: "Cargo Van",
    price: 70,
    image: HC4,
    description: "Van for UTEs",
    seats: 2,
    fuel: "Diesel",
    transmission: "Automatic",
    year: "2021 >"
  },
];

export default carsData;