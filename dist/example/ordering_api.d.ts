export declare const API_VERSION = "1.0.1";
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
export declare const Menu: MenuItemBase[];
export interface OrderingAPIInterface {
    sendEmail(to: string, subject: string, body: string): Promise<void>;
    getCurrentOrder(): MenuItemBase[];
    getItemInOrder(itemOrderId: string): MenuItemBase | undefined;
    getCustomizationByName(itemName: string, name: string): Customization | undefined;
    addItemToOrder(itemName: string, customizationNames: string[], toppings: string[]): void;
    removeItemFromOrder(itemOrderId: string): void;
    modifyItemInOrder(itemOrderId: string, customizationNames: string[], toppings: string[]): void;
    getOrderTotal(): number;
    completeOrder(): void;
    respondToUser(text: string): void;
    delay(milliseconds: number): Promise<void>;
    displayItem(item: MenuItemBase): void;
    displayOrder(): void;
}
declare global {
    var orderingApi: OrderingAPIInterface;
}
