/** @typedef {import('/scripts/index.js').NS} NS */

import { hashCode } from './helpers.js';

/**@param {NS} ns */
export async function main(ns) {
	let items = [
		{ interval: 32000, name: "hacknet-upgrade-manager.js", shouldRun: true, args: () => ["-c", "--max-payoff-time", "4h", "--max-spend", ns.getServerMoneyAvailable("home") * 0.1] },
        { interval: 33000, name: "hacknet-upgrade-manager.js", shouldRun: true, args: () => ["-c", "--max-payoff-time", "8h", "--max-spend", ns.getServerMoneyAvailable("home") * 0.01] },
	]
	
	ns.tprint(hashToolDefinition(items[0]));
	ns.tprint(hashToolDefinition(items[1]));

}

const hashToolDefinition = s => hashCode(s.name + JSON.stringify(s.args || []));

