import { ChatCompletionRequestMessage } from "openai";
import { Customization, MenuItemBase, OrderingAPIInterface } from "./ordering_api";
export declare class OrderingAPI implements OrderingAPIInterface {
    private _order;
    private _lastOrderIdNumber;
    _isCompleted: boolean;
    private _history;
    sendEmail(to: string, subject: string, body: string): Promise<void>;
    respondToUser(text: string): void;
    delay(milliseconds: number): Promise<void>;
    getCurrentOrder(): MenuItemBase[];
    getCustomizationByName(itemName: string, name: string): Customization | undefined;
    addItemToOrder(itemName: string, customizationNames: string[], toppings: string[]): void;
    getItemInOrder(itemOrderId: string): MenuItemBase;
    removeItemFromOrder(itemOrderId: string): void;
    modifyItemInOrder(itemOrderId: string, customizationNames: string[], toppings: string[]): void;
    getOrderTotal(): number;
    completeOrder(): void;
    displayItem(item: MenuItemBase): void;
    displayOrder(): void;
    _addMessageToHistory(message: ChatCompletionRequestMessage): void;
    _getHistory(): ChatCompletionRequestMessage[];
}
