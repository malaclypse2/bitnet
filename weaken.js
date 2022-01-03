/** @param {NS} ns **/
export async function main(ns) {
	var host = ns.args[0];
	while (true) {
		await ns.weaken(host);
	}
}