/** @typedef {import('.').NS} NS */

import { pad, percentToGraph } from '/scripts/bit-lib.js';

/**@param {NS} ns */
export async function main(ns) {
	//let self = globalThis;
	for (let i = 0; i <= 100; i++) {
		let pct = i / 100;
		let num = pad('   ', i, true);
		let fill = percentToGraph(pct, '          ');
		let line = `${num}. [${fill}]`
		ns.tprint(line);
	}

	
}