
import AIMyAPI from "../lib/aimyapi";
import { OrderingAPI } from "./ordering_api_impl";
import * as APIExports from "./ordering_api";
import path from "path";



// Fast food ordering example.
(async () => {
    const api = new OrderingAPI();

    const globalContext = { currentOrder: [1, 2, 3]};

    const aimyapi = await AIMyAPI.createWithAPI({
        apiObject: api,
        apiGlobalName: "orderingApi",       // Should match whatever you declared as your global in your ordering api.
        apiGlobals: globalContext,
        apiExports: APIExports,
        apiDefFilePath: path.join(__dirname, "./ordering_api.ts"),
        apiDocsPath: path.join(__dirname, "./ordering_api.md"),
        debug: true,
    })

    async function runQuery(query:string) {
        console.log(`Query: ${query}`)
        await aimyapi.processRequest(query);
    }

    // FIXME: provide examples of common ordering operations in the documentation

    
    //await aimyapi.runCode(`import * as ApiDefs from "D:\\src\\aimyapi\\example\\ordering_api.ts"; console.log(ApiDefs);`);

    //await runQuery("How's the burger here?");
    //await runQuery("What drinks do you have?");
    await runQuery("I'd like a plain hamburger and a large fries, a pizza with anchovies and a cola. I'd also like a cheese burger with bacon and avocado.");
    // FIXME: with past context, it'll be much easier to modify previous orders. add chat history..
    await runQuery("I changed my mind, instead of the pizza with anchovies, can I get a large gluten free pizza with pineapple instead.");
    // await runQuery("email me the total at myemail@test.com and complete the order");


})();