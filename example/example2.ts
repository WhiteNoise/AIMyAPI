
import AIMyAPI from "../lib/aimyapi";
import { OrderingAPI } from "./ordering_api_impl";
import * as APIExports from "./ordering_api";
import path from "path";


// FIXME: do fast food ordering example..

(async () => {
    const api = new OrderingAPI();

    const aimyapi = await AIMyAPI.createWithAPI({
        apiObject: api,
        apiGlobalName: "orderingApi",
        apiExports: APIExports,
        apiDefFilePath: path.join(__dirname, "./ordering_api.ts"),
        apiDocsPath: path.join(__dirname, "./ordering_api.md"),
        debug: false,
    })
    
    // console.log("Print 'hello' three times.")
    await aimyapi.processRequest("I'd like a plain hamburger and a large fries, a pizza with anchovies and a cola. I'd also like a cheese burger with bacon and avocado.");
    await aimyapi.processRequest("I changed my mind, remove the anchovies from my pizza and make it a large gluten free pizza with pineapple instead.");
    await aimyapi.processRequest("email me the total at myemail@test.com and complete the order");


})();