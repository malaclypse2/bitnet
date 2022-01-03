/** @type import(".").NS */
let ns = null;

import { getPlayerInfo, getAllServerInfo, getServerInfo, root } from "/scripts/netlib.js";

const script_purchaseServers = "/scripts/purchaseServers.js";
const script_grow = "/scripts/grow.js";
const script_weaken = "/scripts/weaken.js";
const script_hack = "/scripts/hack.js";

/** @param {NS} _ns **/
export async function main(_ns) {
	ns = _ns;
	ns.tprint('Starting hacking controller.')
	
	validateScripts(ns);
	
	// Pick a target
	let playerInfo = await getPlayerInfo(ns);
	//	ns.tprint(JSON.stringify(playerInfo))
	let target = await getTargetServer(playerInfo, ns);
	ns.tprint(`Target: ${target}`)

	while (true) {
		// Root any available servers
		await rootServers(ns)
		playerInfo = await getPlayerInfo(ns);
		let servers = await getAllServerInfo(ns);
		//		ns.tprint(JSON.stringify(servers))

		// See how many slots we have available.
		let slots = 0
		for (const server in servers) {
			slots += servers[server].slots
		}
		ns.tprint(`Total available hacking slots: ${slots}`)

		// Check target status
		// Decide if we need to re-allocate threads

		// Sleep 
		await ns.sleep(1 * 60 * 1000);
	} // End while(True)
}


export async function getTargetServer(info, ns) {
	var target = '';
	if (info.exploits >= 0 && info.level > 0) {
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

export async function rootServers(ns) {
	let servers = await getAllServerInfo(ns);
	for (const server in servers) {
		const info = servers[server]
		// Try to root any servers we haven't gotten yet.
		if (!info.rooted) {
			const success = await root(server, ns)
			if (success) {
				servers[server] = await getServerInfo(server, ns)
			}
		}
	}
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
