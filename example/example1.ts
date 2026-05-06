import { AIMyAPI } from "../src";
import { API } from "./sales_api_impl";

// Simpler example using no support for chat history; 

(async () => {
    const api = new API();

    const aimyapi = await AIMyAPI.createWithAPI({
        apiObject: api,
        apiGlobalName: "salesApi", // Should match whatever you declared as your global in your api.
        apiDefFilePath:  "./example/sales_api.ts",
        apiDocsPath: "./example/sales_api.md",
        debug: false,
    })

    aimyapi.runCode(`console.log("Hello from the sandbox! Here is some sales data:", salesApi.getSalesData())`);
    
    console.log("Print 'hello' three times.")
    await aimyapi.processRequest("Print 'hello' three times.");

    console.log("What month had the highest sales in 2020 for any business unit?")
    await aimyapi.processRequest("What was our best month in 2020");

    console.log("Which business unit had the highest sales in 2020? Print the totals for each")
    await aimyapi.processRequest("Which business unit had the highest sales in 2020? Print the totals for each");
    // Note: this is a bit of a trick question because two of them are tied for first. The agent usually doesn't realize this edge case. Should we instruct it to look for edge cases?

    console.log("Compute the total sales for each month in 2020 then email the top 3 to test@email.com")
    await aimyapi.processRequest("Compute the total sales for each month in 2020 then email the top 3 to test@email.com");
})();