/** @param {NS} ns **/
export async function main(ns) {
	var host = ns.args[0];
	await ns.grow(host);
}