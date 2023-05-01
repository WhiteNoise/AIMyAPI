"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay = void 0;
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}
exports.delay = delay;
