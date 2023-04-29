import { delay } from "../lib/utils";
import { APIInterface, SalesData } from "./sales_api";

export class API implements APIInterface {

    // Mock implementation, doesn't actually send an email
    sendEmail(to: string, subject: string, body: string): Promise<void> {
        console.log(`Sending email to "${to}" with subject "${subject}" and body\n"${body}"`);
        return delay(1000);
    }

    getSalesData(): SalesData[] {
        return [
            { sales: 100, month: 1, year: 2020, businessUnit: "Advertising" },
            { sales: 200, month: 2, year: 2020, businessUnit: "Advertising" },
            { sales: 300, month: 3, year: 2020, businessUnit: "Advertising" },
            { sales: 400, month: 4, year: 2020, businessUnit: "Advertising" },
            { sales: 500, month: 5, year: 2020, businessUnit: "Advertising" },
            { sales: 600, month: 6, year: 2020, businessUnit: "Advertising" },
            { sales: 700, month: 7, year: 2020, businessUnit: "Advertising" },
            { sales: 800, month: 8, year: 2020, businessUnit: "Advertising" },
            { sales: 900, month: 9, year: 2020, businessUnit: "Advertising" },
            { sales: 1000, month: 10, year: 2020, businessUnit: "Advertising" },
            { sales: 1100, month: 11, year: 2020, businessUnit: "Advertising" },
            { sales: 1100, month: 12, year: 2020, businessUnit: "Advertising" },
            { sales: 1200, month: 1, year: 2020, businessUnit: "Software" },
            { sales: 1300, month: 2, year: 2020, businessUnit: "Software" },
            { sales: 1400, month: 3, year: 2020, businessUnit: "Software" },
            { sales: 1500, month: 4, year: 2020, businessUnit: "Software" },
            { sales: 1600, month: 5, year: 2020, businessUnit: "Software" },
            { sales: 1700, month: 6, year: 2020, businessUnit: "Software" },
            { sales: 1800, month: 7, year: 2020, businessUnit: "Software" },
            { sales: 1800, month: 8, year: 2020, businessUnit: "Software" },
            { sales: 1500, month: 9, year: 2020, businessUnit: "Software" },
            { sales: 1200, month: 10, year: 2020, businessUnit: "Software" },
            { sales: 1000, month: 11, year: 2020, businessUnit: "Software" },
            { sales: 100, month: 12, year: 2020, businessUnit: "Software" },
            { sales: 1200, month: 1, year: 2020, businessUnit: "Hardware" },
            { sales: 1300, month: 2, year: 2020, businessUnit: "Hardware" },
            { sales: 1400, month: 3, year: 2020, businessUnit: "Hardware" },
            { sales: 1500, month: 4, year: 2020, businessUnit: "Hardware" },
            { sales: 1600, month: 5, year: 2020, businessUnit: "Hardware" },
            { sales: 1700, month: 6, year: 2020, businessUnit: "Hardware" },
            { sales: 1800, month: 7, year: 2020, businessUnit: "Hardware" },
            { sales: 1800, month: 8, year: 2020, businessUnit: "Hardware" },
            { sales: 1500, month: 9, year: 2020, businessUnit: "Hardware" },
            { sales: 1200, month: 10, year: 2020, businessUnit: "Hardware" },
            { sales: 1000, month: 11, year: 2020, businessUnit: "Hardware" },
            { sales: 100, month: 12, year: 2020, businessUnit: "Hardware" },            
        ]
    };

    print(text: string): void {
        console.log(text);
    }
    delay(milliseconds: number): Promise<void> {
        return delay(milliseconds);
    }
}

