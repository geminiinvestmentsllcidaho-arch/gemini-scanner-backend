import test from "node:test";
import assert from "node:assert/strict";
import {CUSTOMER_ICON_SYSTEM_VERSION,renderCustomerIcon} from "../src/scanner/customer_icons.mjs";
test("renders reusable accessible SVG icons",()=>{const a=renderCustomerIcon("bell");const b=renderCustomerIcon("exit",{label:"Exit alert"});assert.equal(CUSTOMER_ICON_SYSTEM_VERSION,"customer_icon_system_v1");assert.match(a,/<svg/);assert.match(a,/aria-hidden="true"/);assert.match(b,/aria-label="Exit alert"/);assert.doesNotMatch(a,/http|script|emoji/i);});
