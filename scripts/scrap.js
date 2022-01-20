/** @typedef {import('/scripts/index.js').NS} NS */

import { getServerNames } from '/scripts/bit-lib.js';

/**@param {NS} ns */
export async function main(ns) {
	let servernames = getServerNames(ns);
	for(let nm of servernames) ns.tprint(nm);

}

