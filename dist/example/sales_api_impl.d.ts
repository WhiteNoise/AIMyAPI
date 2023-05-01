import { APIInterface, SalesData } from "./sales_api";
export declare class API implements APIInterface {
    sendEmail(to: string, subject: string, body: string): Promise<void>;
    getSalesData(): SalesData[];
    print(text: string): void;
    delay(milliseconds: number): Promise<void>;
}
