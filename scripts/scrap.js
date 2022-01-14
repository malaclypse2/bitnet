/** @typedef {import('/scripts/index.js').NS} NS */

import { wordwrap } from '/scripts/bit-lib.js';

/**@param {NS} ns */
export async function main(ns) {
	//let self = globalThis;

	// for (let i = 0; i <= 100; i++) {
	// 	let pct = i / 100;
	// 	let num = pad('   ', i, true);
	// 	let fill = percentToGraph(pct, '          ');
	// 	let line = `${num}. [${fill}]`
	// 	ns.tprint(line);
	// }

	let line = 'one one-two one-two-three one-two-three-four one-two-three-four-five-six-sever-eight-nine-ten-eleven'
	let lines = wordwrap(line, 20);
	for (let l of lines){
		ns.tprint(l);
	}
}