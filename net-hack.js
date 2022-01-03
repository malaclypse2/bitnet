import * as netlib from "/scripts/netlib.js";

const script_purchaseServers = "/scripts/purchaseServers.js";
const script_grow = "/scripts/grow.js";
const script_weaken = "/scripts/weaken.js";
const script_hack = "/scripts/hack.js";

/** @param {NS} ns **/
export async function main(ns) {
	ns.tprint('Starting hacking controller.')
	validateScripts(ns);

	// Pick a target
	var playerInfo = netlib.getPlayerInfo(ns);
	let target = await getTargetServer(playerInfo, ns);
	ns.tprint(`Target: ${target}`)

	while(True) {
		// Hack available servers


		
		// Check target status
		// Decide if we need to re-allocate threads
	} // End while(True)
}


export async function getTargetServer(info, ns) {
	var target = '';
	if (info.exploits >= 0 && info.level > 0 ){
		target = 'foodnstuff'
	}
	if (info.exploits >= 1 && info.level > 40) {
		target = 'harakiri-sushi'
	}
	if (info.exploits >= 2) {
		target = 'phantasy'
	}
	return target;
}

function validateScripts(ns) {
	// Make sure the scripts all exist.
	if (!ns.fileExists(script_purchaseServers, 'home')) {
		ns.tprint(`Could not find script '${script_purchaseServers}`)
		return
	}
	if (!ns.fileExists(script_grow, 'home')) {
		ns.tprint(`Could not find script '${script_grow}`)
		return
	}
	if (!ns.fileExists(script_weaken, 'home')) {
		ns.tprint(`Could not find script '${script_weaken}`)
		return
	}
	if (!ns.fileExists(script_hack, 'home')) {
		ns.tprint(`Could not find script '${script_hack}`)
		return
	}
}
