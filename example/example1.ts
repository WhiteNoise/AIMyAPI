
import AIMyAPI from "../lib/aimyapi";
import { API } from "./sales_api_impl";
import * as APIExports from "./sales_api";
import path from "path";


// FIXME: do fast food ordering example..

(async () => {
    const api = new API();

    const aimyapi = await AIMyAPI.createWithAPI({
        apiObject: api,
        apiExports: APIExports,
        apiDefFilePath: path.join(__dirname, "./sales_api.ts"),
        debug: false,
    })
    
    console.log("Print 'hello' three times.")
    await aimyapi.processRequest("Print 'hello' three times.");

    console.log("What was our best month in 2020")
    await aimyapi.processRequest("What was our best month in 2020");

    console.log("Which business unit had the highest sales in 2020?")
    await aimyapi.processRequest("Which business unit had the highest sales in 2020?");

    console.log("Compute the total sales for each month in 2020 then email the top 3 to test@email.com")
    await aimyapi.processRequest("Compute the total sales for each month in 2020 then email the top 3 to test@email.com");
})();