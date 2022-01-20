// It looks like corporation access is super expensive, and I can't test any of it on a small computer.
/** @typedef{import('/scripts/index.js').NS} NS*/

import { getServerNames } from '/scripts/bit-lib.js';

export const corporateServerName = 'Corp(©)';

const argspec = [
	['help', false],
	['copy', true],
	['purchase', true],
];

/** @param {NS} ns */
export async function main(ns) {
	let args = ns.flags(argspec);
	if (args.purchase) {
		// Buy a corporate server if we don't have one.
		let servers = getServerNames(ns);
		if (!servers.includes(corporateServerName)) {
			ns.exec('/scripts/net-servers.js', 'home', 1, '--buy', 11, '--name', corporateServerName);
		}
	}
	if (args.copy) {
		// If the corporate server exists, copy *everything* out there
		let files = ns.ls('home');
		files = files.filter((f)=>f.endsWith('.js'));
		let done = ns.scp(files, 'home', corporateServerName);
		await done;
		await ns.sleep(5);
	}
	ns.exec('/scripts/net-corp-remote.js', corporateServerName, 1, ...ns.args)
}