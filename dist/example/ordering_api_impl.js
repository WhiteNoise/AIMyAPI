"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderingAPI = void 0;
const utils_1 = require("../lib/utils");
const ordering_api_1 = require("./ordering_api");
// TODO: make functions to print out an item, and print out the current order with the price totals.
class OrderingAPI {
    constructor() {
        this._order = [];
        this._lastOrderIdNumber = 0;
        this._isCompleted = false;
        this._history = [];
    }
    // Mock implementation, doesn't actually send an email
    sendEmail(to, subject, body) {
        console.log(`Sending email to "${to}" with subject "${subject}" and body\n"${body}"`);
        return (0, utils_1.delay)(1000);
    }
    respondToUser(text) {
        console.log(text);
        this._history.push({
            role: "assistant",
            content: "Response output: " + text,
        });
    }
    delay(milliseconds) {
        return (0, utils_1.delay)(milliseconds);
    }
    getCurrentOrder() {
        return this._order;
    }
    // addItemToOrder(item: MenuItemBase) {
    //     item.orderId = "" + (this._lastOrderIdNumber++);
    //     this._order.push(item);
    // }
    getCustomizationByName(itemName, name) {
        const item = ordering_api_1.Menu.find((item) => item.name === itemName);
        if (!item) {
            return undefined;
        }
        return item.allowedCustomizations.find((customization) => customization.name === name);
    }
    addItemToOrder(itemName, customizationNames, toppings) {
        const item = ordering_api_1.Menu.find((item) => item.name === itemName);
        if (!item) {
            throw new Error(`Item with name "${itemName}" not found`);
        }
        const customizations = customizationNames
            .map((customizationName) => {
            return this.getCustomizationByName(itemName, customizationName);
        })
            .filter((customization) => customization !== undefined);
        const newItem = {
            ...item,
            customizations,
            toppings: toppings,
            orderId: "" + this._lastOrderIdNumber++,
        };
        this._order.push(newItem);
        this.respondToUser(`Added ${itemName} with id ${newItem.orderId}`);
        this.displayItem(newItem);
    }
    getItemInOrder(itemOrderId) {
        const item = this._order.find((item) => item.orderId === itemOrderId);
        if (!item) {
            return undefined;
        }
        return item;
    }
    removeItemFromOrder(itemOrderId) {
        this._order = this._order.filter((item) => item.orderId !== itemOrderId);
        this.respondToUser(`Removed item ${itemOrderId}`);
    }
    modifyItemInOrder(itemOrderId, customizationNames, toppings) {
        const existingIndex = this._order.findIndex((item) => item.orderId === itemOrderId);
        if (existingIndex !== -1) {
            const customizations = customizationNames
                .map((customizationName) => {
                return this.getCustomizationByName(this._order[existingIndex].name, customizationName);
            })
                .filter((customization) => customization !== undefined);
            this._order[existingIndex].customizations = customizations;
            this._order[existingIndex].toppings = toppings;
        }
        else {
            throw new Error(`Item with id #"${itemOrderId}" not found in order`);
        }
        this.respondToUser(`Modified item ${itemOrderId}`);
    }
    getOrderTotal() {
        const total = this._order.reduce((total, item) => {
            const customizationTotal = item.customizations.reduce((total, customization) => {
                return total + customization?.priceAdjustment || 0;
            }, 0);
            return total + item.price + customizationTotal;
        }, 0);
        return total;
    }
    completeOrder() {
        this.displayOrder();
        this.respondToUser("Order completed!");
        this._lastOrderIdNumber = 0;
        // clear history
        this._history = [];
        this._isCompleted = true;
    }
    displayItem(item) {
        this.respondToUser(`\t#${item.orderId || ""} ${item.name}...\t\t$${item.price.toFixed(2)}`);
        item.toppings.forEach((topping) => {
            this.respondToUser(`\t\t${topping}`);
        });
        item.customizations.forEach((customization) => {
            this.respondToUser(`\t\t${customization.name}...\t$${customization.priceAdjustment.toFixed(2)}`);
        });
    }
    displayOrder() {
        this.respondToUser("----\n\nDisplaying order:\n\n");
        this._order.forEach((item) => this.displayItem(item));
        this.respondToUser(`--\tTotal:\t\t$${this.getOrderTotal()}`);
    }
    _addMessageToHistory(message) {
        this._history.push(message);
    }
    _getHistory() {
        return this._history;
    }
}
exports.OrderingAPI = OrderingAPI;
