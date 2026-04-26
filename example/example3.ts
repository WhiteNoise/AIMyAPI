
import path from "path";
import { AIMyAPI } from "../src";
import * as APIExports from "./ordering_api";
import { OrderingAPI } from "./ordering_api_impl";

import readline from 'readline';

function getInput(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

// More complex fast food ordering example that uses chat history.
// Fast food ordering example.
// -- Interactive version
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
        const result = await aimyapi.generateCode(query, orderingApi._getHistory());

        if(result) {
            orderingApi._addMessageToHistory({
                content: query,
                role: "user",
                name: "user",
            });

            orderingApi._addMessageToHistory({
                content: result.comments || "done",
                role: "assistant",
                name: "assistant",
            });

            // run the code in the sandbox
            if(result.code) {
                await aimyapi.runCode(result.code);
            }       
        }
    }
   
    console.log("Welcome to the restaurant. You can ask to hear the menu or order something. What would you like to do?");
    while (!orderingApi._isCompleted) {
        const query:string = await getInput("Your query: ");
        await runQuery(query);
    }

})();