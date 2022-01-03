/** @type import(".").NS */
let ns = null;

import { getPlayerInfo, getAllServerInfo, getServerInfo, root, findTargets } from "/scripts/netlib.js";

const script_purchaseServers = "/scripts/purchaseServers.js";
const script_grow = "/scripts/grow.js";
const script_weaken = "/scripts/weaken.js";
const script_hack = "/scripts/hack.js";

export async function main(_ns) {
	ns = _ns;
	ns.tprint('Starting hacking controller.')
	
	validateScripts(ns);
	
	// Pick a target
	let playerInfo = await getPlayerInfo(ns);
	//	ns.tprint(JSON.stringify(playerInfo))
	let servers = await getAllServerInfo(ns);
	// Force a root check on available servers when we start up
	servers = await rootServers(servers, ns)
	let targets = findTargets(servers, 5, playerInfo, ns)
	ns.tprint(`Target: ${targets}`)

	while (true) {
		// Root any available servers
		const oldExploitCount = playerInfo.exploits
		playerInfo = await getPlayerInfo(ns);
		if (oldExploitCount != playerInfo.exploits) {
			// It's only worth evaluating new targets when we get a new exploit.
			servers = await rootServers(servers, ns)
		}
		//		ns.tprint(JSON.stringify(servers))

		// See how many slots we have available.

		let pool = getPoolFromServers(servers, ns);
		ns.tprint(`Total available hacking slots: ${pool.slots}`)
		ns.tprint(`Hack  : ${pool.hack}`)
		ns.tprint(`Grow  : ${pool.grow}`)
		ns.tprint(`Weaken: ${pool.weaken}`)

		// Check target status
		// Decide if we need to re-allocate threads

		// Sleep 
		await ns.sleep(1 * 60 * 1000);
	} // End while(True)

	ns.tprint("Goodnight, Gracie!")
}

function getPoolFromServers(servers, ns) {
	let pool = { slots: 0, grow: 0, hack: 0, weaken: 0 }
	for (const server in servers) {
		const info = servers[server];
		// Treat undefined as 0 here.
		pool.slots  += info.slots || 0;
		pool.grow   += info.g     || 0;
		pool.hack   += info.h     || 0;
		pool.weaken += info.w     || 0;
	}
	return pool;
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

export async function rootServers(servers, _ns) {
	ns = _ns
	for (const server in servers) {
		const info = servers[server]
		// Try to root any servers we haven't gotten yet.
		if (!info.rooted) {
			const success = await root(server, ns)
			if (success) {
				// merge existing data so we don't lose thread counts
				servers[server] = {
					...info,
					...await getServerInfo(server, ns)
				}
			}
		}
	}
	return servers
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
