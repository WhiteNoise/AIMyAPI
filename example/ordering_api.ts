export const API_VERSION="1.0.1";

export interface Customization {
    name: string;
    priceAdjustment: number;
}

export interface MenuItemBase {
    orderId?: string;
    name: string;
    price: number;
    description: string;
    category: string;
    tags: string[];
    customizations: Customization[];
    readonly allowedCustomizations: Customization[];
    toppings: string[];
    readonly allowedToppings: string[];
}

export const Menu: MenuItemBase[] = [
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
                "name": "Extra Large",
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



export interface OrderingAPIInterface {

    sendEmail(to: string, subject: string, body: string): Promise<void>;

    getOrder(): MenuItemBase[];

    addItemToOrder(itemName, customizations:Customization[], toppings: string[]): void;
    // Adds the specified item to the order.
    // when adding an item, you should always create a new object that matches the existing menu item structure. Only include the toppings that the user has specified unless they come by default with the item.

    removeItemFromOrder(itemOrderId: string): void;
    // Removes the item with the specified id from the order.

    modifyItemInOrder(itemOrderId: string, customizations:Customization[], toppings: string[]): void;
    // Replace the item in the order with the specified item.

    getOrderTotal(): number;
    // Gets the total price for the current order

    completeOrder(): void;
    // Completes the order and sends it to the kitchen.

    respondToUser(text: string): void;
    // Sends a message to the user.

    delay(milliseconds: number): Promise<void>;
    // waits for the specified number of milliseconds before resolving the promise.

    displayItem(item: MenuItemBase): void;
    // Displays the specified item to the user.

    displayOrder(): void;
    // Displays the current order to the user.
    

};

// Global object you will use for accessing the APIInterface
declare global {
    var orderingApi: OrderingAPIInterface;
}
