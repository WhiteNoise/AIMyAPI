"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Menu = exports.API_VERSION = void 0;
exports.API_VERSION = "1.0.1";
exports.Menu = [
    {
        "name": "Pizza",
        "price": 10.99,
        "description": "A classic pizza with your choice of toppings.",
        "category": "Pizza",
        "tags": [
            "cheese",
            "pizza"
        ],
        "customizations": [],
        "allowedCustomizations": [
            {
                "name": "Extra Cheese",
                "priceAdjustment": 1.99
            },
            {
                "name": "Extra Sauce",
                "priceAdjustment": 0.99
            },
            {
                "name": "Gluten Free Crust",
                "priceAdjustment": 2.99
            },
            {
                "name": "Large",
                "priceAdjustment": 3.99
            }
        ],
        "toppings": [],
        "allowedToppings": [
            "pepperoni",
            "sausage",
            "mushrooms",
            "onions",
            "green peppers",
            "black olives",
            "green olives",
            "anchovies",
            "pineapple",
            "ham",
            "bacon",
            "chicken",
        ]
    },
    {
        "name": "Hamburger",
        "price": 8.99,
        "description": "A classic american hamburger with your choice of toppings. Cheese, lettuce, tomato, and onion are included by default. Other toppings available on request.",
        "category": "Burgers",
        "tags": [
            "hamburger",
            "burger"
        ],
        "customizations": [],
        "allowedCustomizations": [
            {
                "name": "Special sauce",
                "priceAdjustment": 1.99
            }
        ],
        "toppings": [],
        "allowedToppings": [
            "cheese",
            "lettuce",
            "tomato",
            "onion",
            "pickles",
            "bacon",
            "mushrooms",
            "avocado",
            "jalapenos",
        ],
    },
    {
        "name": "Fries",
        "price": 2.99,
        "description": "A classic side of fries.",
        "category": "Sides",
        "tags": [
            "fries",
            "french fries"
        ],
        "customizations": [],
        "allowedCustomizations": [
            {
                "name": "Large",
                "priceAdjustment": 1.99
            },
        ],
        "toppings": [],
        "allowedToppings": [
            "old bay",
        ]
    },
    {
        "name": "Fountain Drink",
        "price": 1.99,
        "description": "A classic fountain drink. Choose from Cola, Diet Cola, Dr. Dazzle, or Mountain Rush.",
        "category": "Drinks",
        "tags": [
            "drink",
            "soda",
            "fountain drink"
        ],
        "customizations": [],
        "allowedCustomizations": [
            {
                "name": "Large",
                "priceAdjustment": 0.99
            },
            {
                "name": "Extra Ice",
                "priceAdjustment": 0.99
            },
        ],
        "toppings": [],
        "allowedToppings": []
    }
];
;
