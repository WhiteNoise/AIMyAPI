export const API_VERSION="1.0.1";

// Sales data for each month, per business unit
export interface SalesData {
    sales: number;
    month: number;  // 1...12
    year: number;
    businessUnit: "Advertising" | "Hardware" | "Software";
}

export interface APIInterface {

    sendEmail(to: string, subject: string, body: string): Promise<void>;

    getSalesData(): SalesData[];
    // Returns an array of sales data.

    print(text: string): void;
    // Prints the specified text to the user.

    delay(milliseconds: number): Promise<void>;
    // waits for the specified number of milliseconds before resolving the promise.

};

// Global object you will use for accessing the APIInterface
declare global {
    var api: APIInterface;
}
