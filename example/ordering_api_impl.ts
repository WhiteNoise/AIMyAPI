import { delay } from "../lib/utils";
import { Customization, Menu, MenuItemBase, OrderingAPIInterface } from "./ordering_api";

// TODO: make functions to print out an item, and print out the current order with the price totals.

export class OrderingAPI implements OrderingAPIInterface {

    private _order: MenuItemBase[] = [];
    private _lastOrderIdNumber: number = 0;

    // Mock implementation, doesn't actually send an email
    sendEmail(to: string, subject: string, body: string): Promise<void> {
        console.log(`Sending email to "${to}" with subject "${subject}" and body\n"${body}"`);
        return delay(1000);
    }

    respondToUser(text: string): void {
        console.log(text);
    }

    delay(milliseconds: number): Promise<void> {
        return delay(milliseconds);
    }

    getOrder(): MenuItemBase[] {
        return this._order;
    }

    // addItemToOrder(item: MenuItemBase) {
    //     item.orderId = "" + (this._lastOrderIdNumber++);
    //     this._order.push(item);
    // }

    addItemToOrder(itemName, customizations:Customization[], toppings: string[]) {
        const item = Menu.find(item => item.name === itemName);
        if(!item) {
            throw new Error(`Item with name "${itemName}" not found`);
        }

        const newItem = {
            ...item,
            customizations: customizations,
            toppings: toppings,
            orderId: "" + (this._lastOrderIdNumber++)
        };

        this._order.push(newItem);
    }

    removeItemFromOrder(itemOrderId: string) {
        this._order = this._order.filter(item => item.orderId !== itemOrderId);
    }

    modifyItemInOrder(itemOrderId: string, customizations:Customization[], toppings: string[]) {
        const existingIndex = this._order.findIndex(item => item.orderId === itemOrderId);

        if(existingIndex !== -1) {
            this._order[existingIndex].customizations = customizations;
            this._order[existingIndex].toppings = toppings;
        } else {
            throw new Error(`Item with id "${itemOrderId}" not found in order`);
        }
    }

    getOrderTotal() {
        const total = this._order.reduce((total, item) => {
            const customizationTotal = item.customizations.reduce((total, customization) => {
                return total + customization.priceAdjustment;
            }, 0);
            return total + item.price + customizationTotal;
         }, 0)
         
         return total;
    }

    completeOrder(): void {
        console.log(`Order complete. Total: $${this.getOrderTotal()}`);
        console.log(`Order You ordered:`);
        this._order.forEach(item => {
            console.log(`\t${item.name}`);
            item.toppings.forEach(topping => {
                console.log(`\t\t${topping}`);
            });
            item.customizations.forEach(customization => {
                console.log(`\t\t${customization.name}`);
            });


        });
    }






    

}