/** @typedef{import('/scripts/index.js').NS} NS*/
/** @param {NS} ns */
export async function main(ns) {
	let corp = ns.corporation();
	ns.tprint(JSON.stringify(corp));
}