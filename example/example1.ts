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

    // test the sandbox:
     await aimyapi.runCode(`await salesApi.display("Hello from the sandbox! Here is some sales data:");`);
    
    console.log("Test parameter validation (should fail)");
    const failResult = await aimyapi.runCode(`await salesApi.sendEmail("fail");`);
    console.log(JSON.stringify(failResult, null, 2));
    console.log("Test parameter validation (should pass)");
    await aimyapi.runCode(`await salesApi.sendEmail("to@email.com", "Your emails", "body text");`);

    await aimyapi.runCode(`await salesApi.display(salesApi.getDate());`);

    // test code writing:
    const queries = [ "Display 'hello' three times.", "What month had the highest sales in 2020 for any business unit?", "Which business unit had the highest sales in 2020? Display the totals for each business unit", "Compute the total sales for each month in 2020 then email the top 3 to test@email.com"]

    for(const k in queries) {
        const query = queries[k];
        console.log(`Query: ${query}`);
        const testResult = await aimyapi.processRequest(query);
        if(testResult?.code)
            console.log("Code:", testResult.code)
        else {
            console.log(testResult);
        }
    }

})();