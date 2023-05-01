import AIMyAPI from "../lib";
import { OrderingAPI } from "./ordering_api_impl";
import * as APIExports from "./ordering_api";
import path from "path";

// More complex fast food ordering example that uses chat history.
// Fast food ordering example.

// IDEA: If the order history becomes too long, we could summarize it by listing the current order state and remove the rest.
(async () => {
    const api = new OrderingAPI();

    const options = {
        apiObject: api,
        apiGlobalName: "orderingApi",       // Should match whatever you declared as your global in your ordering api.
        apiExports: APIExports,
        apiDefFilePath: path.join(__dirname, "./ordering_api.ts"),
        apiDocsPath: path.join(__dirname, "./ordering_api.md"),
        debug: false,
    };
    const aimyapi = await AIMyAPI.createWithAPI(options)

    async function runQuery(query:string) {
        console.log(`Query: ${query}`)

        // generate the code for this query
        const code = await aimyapi.generateCode(query, api._getHistory());

        api._addMessageToHistory({
            content: query,
            role: "user",
            name: "user",
        });

        api._addMessageToHistory({
            content: '```\n' + code.replace(options.apiDefFilePath, "./api.ts") + '\n```',
            role: "assistant",
            name: "assistant",
        });

        // run the code in the sandbox
        await aimyapi.runCode(code);
    }
   
    await runQuery("How's the burger here?");
    await runQuery("I'd like a plain hamburger (no cheese) and a large fries, a pizza with anchovies and a cola. I'd also like a cheese burger with bacon and avocado.");
    await runQuery("I changed my mind, instead of anchovies, can I get a large gluten free pizza with pineapple instead.");
    await runQuery("email me the total at myemail@test.com and complete the order");

})();