export declare const API_VERSION = "1.0.1";
export interface SalesData {
    sales: number;
    month: number;
    year: number;
    businessUnit: "Advertising" | "Hardware" | "Software";
}
export interface APIInterface {
    sendEmail(to: string, subject: string, body: string): Promise<void>;
    getSalesData(): SalesData[];
    print(text: string): void;
    delay(milliseconds: number): Promise<void>;
}
declare global {
    var api: APIInterface;
}
