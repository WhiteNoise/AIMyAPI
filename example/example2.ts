// Note: This example is quite stupid and slow and you'd be better off using Tool calling for something like this, but I'm leaving it for demonstration purposes

import path from "path";
import { AIMyAPI } from "../src";
import * as APIExports from "./ordering_api";
import { OrderingAPI } from "./ordering_api_impl";

// More complex fast food ordering example that uses chat history.
// Fast food ordering example.

(async () => {
    const orderingApi = new OrderingAPI();

    const options = {
        apiObject: orderingApi,
        apiGlobalName: "orderingApi",       // Should match whatever you declared as your global in your ordering api.
        apiGlobals: {
            Menu: APIExports.Menu,
        },
        apiExports: APIExports,
        apiDefFilePath: path.join(__dirname, "./ordering_api.ts"),
        apiDocsPath: path.join(__dirname, "./ordering_api.md"),
        debug: false,
    };
    const aimyapi = await AIMyAPI.createWithAPI(options)

    async function runQuery(query:string) {
        console.log(`Query: ${query}`)

        // generate the code for this query
        const codeResult = await aimyapi.generateCode(query, orderingApi._getHistory());

        if(codeResult) {
            orderingApi._addMessageToHistory({
                content: query,
                role: "user",
                name: "user",
            });

            orderingApi._addMessageToHistory({
                content: codeResult.comments || "done",
                role: "assistant",
                name: "assistant",
            });

            // run the code in the sandbox
            if(codeResult.code) {
                await aimyapi.runCode(codeResult.code);
            }
        } else {
            console.error("No code generated for this query.");
        }

    }
   
    await runQuery("How's the burger here?");
    await runQuery("I'd like a plain hamburger (no cheese) and a large fries, a pizza with anchovies and a cola. I'd also like a cheese burger with bacon and avocado.");
    await runQuery("I changed my mind, instead of anchovies, can I get a large gluten free pizza with pineapple instead.");
    await runQuery("email me the total at myemail@test.com and complete the order");

})();