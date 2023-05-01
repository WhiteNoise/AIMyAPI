"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = __importDefault(require("../lib"));
const sales_api_impl_1 = require("./sales_api_impl");
const APIExports = __importStar(require("./sales_api"));
const path_1 = __importDefault(require("path"));
// Simpler example using no support for chat history; 
(async () => {
    const api = new sales_api_impl_1.API();
    const aimyapi = await lib_1.default.createWithAPI({
        apiObject: api,
        apiGlobalName: "api",
        apiExports: APIExports,
        apiDefFilePath: path_1.default.join(__dirname, "./sales_api.ts"),
        apiDocsPath: path_1.default.join(__dirname, "./sales_api.md"),
        debug: false,
    });
    console.log("Print 'hello' three times.");
    await aimyapi.processRequest("Print 'hello' three times.");
    console.log("What was our best month in 2020");
    await aimyapi.processRequest("What was our best month in 2020");
    console.log("Which business unit had the highest sales in 2020?");
    await aimyapi.processRequest("Which business unit had the highest sales in 2020?");
    console.log("Compute the total sales for each month in 2020 then email the top 3 to test@email.com");
    await aimyapi.processRequest("Compute the total sales for each month in 2020 then email the top 3 to test@email.com");
})();
