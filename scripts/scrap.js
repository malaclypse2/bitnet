/** @typedef {import('/scripts/index.js').NS} NS */

import { getPlayerObj } from '/scripts/bit-lib.js';

/**@param {NS} ns */
export async function main(ns) {
    let p = getPlayerObj();
    //ns.tprint(JSON.stringify(p, null, 4));
    let d = p.corporation.divisions[1];
    //ns.tprint(d);
    ns.tprint(d['sciResearch']['qty']);
	d['sciResearch']['qty'] *= 10;
    ns.tprint(d['sciResearch']['qty']);
}
