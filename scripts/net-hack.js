/** @type import(".").NS */
let ns = null;

import { getPlayerInfo, getAllServerInfo, getServerInfo, root, findTargets, tprintSeverAsTarget, evaluateTarget, worker_size, stopscript } from "/scripts/netlib.js";

const script_purchaseServers = "/scripts/purchaseServers.js";
const script_grow = "/scripts/growOnce.js";
const script_weaken = "/scripts/weakenOnce.js";
const script_hack = "/scripts/hackOnce.js";
const num_targets = 5;

async function runStart(num_targets, _ns) {
	ns = _ns

	ns.tprint('Starting hacking controller.')

	ns.disableLog('getServerRequiredHackingLevel');
	ns.disableLog('getServerMaxRam');
	ns.disableLog('getServerUsedRam');
	ns.disableLog('getServerMaxMoney');
	ns.disableLog('getServerMoneyAvailable');
	ns.disableLog('getServerMinSecurityLevel');
	ns.disableLog('getServerSecurityLevel');
	ns.disableLog('getHackingLevel');

	validateScripts(ns);

	let playerInfo = await getPlayerInfo(ns);
	let servers = await getAllServerInfo({}, ns);
	// Force a root check on available servers
	servers = await rootServers(servers, ns)

	// Distribute fresh copies of attack scripts to all servers
	for (const servername in servers) {
		if (servername != 'home') {
			await ns.scp(script_grow, servername);
			await ns.scp(script_hack, servername);
			await ns.scp(script_weaken, servername);
		}
	}
	await ns.sleep(100);

	// Get the best targets based on our evaluation function
	let targets = findTargets(servers, num_targets, playerInfo, ns)

	// Everyone loves a noodle shop.
	let additionalTarget = getServerInfo('n00dles', ns)
	additionalTarget = evaluateTarget(additionalTarget, playerInfo, ns)
	targets.unshift(additionalTarget)

	while (true) {
		// Root any available servers
		const oldExploitCount = playerInfo.exploits
		playerInfo = await getPlayerInfo(ns);
		if (oldExploitCount != playerInfo.exploits) {
			// It's only worth evaluating new targets to root when we get a new exploit.
			servers = await rootServers(servers, ns)
		}
		//		ns.tprint(JSON.stringify(servers))

		// re-evaluate our targets.
		for (let i = 0; i < targets.length; i++) {
			let target = targets[i]
			// Update server information
			target = { ...target, ...getServerInfo(target.name, ns) }
			// Re-evaluate targetting criteria
			target = await evaluateTarget(target, playerInfo, ns);
			targets[i] = target
		}

		// Allocate any free server slots
		servers = await allocateThreads(servers, targets, ns)

		// Display some status before we sleep
		for (const target of targets) {
			tprintSeverAsTarget(target, ns)
		}

		// Sleep 
		await ns.sleep(1 * 1000);
	} // End while(True)
}

export async function main(_ns) {
	ns = _ns;
	args = ns.args
	
	await runStart(num_targets, ns);

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

async function allocateThreads(servers, targets, _ns) {
	ns = _ns
	ns.tprint('Allocating attack threads.')
	
	// Make sure our notion of running attack threads against each target matches reality.
	// First, reset all our assumptions
	for (const servername in servers) {
		let server = servers[servername]
		server.w = 0
		server.h = 0
		server.g = 0
		servers[servername] = server
	} // End loop over servers
	for (let target of targets) {
		target.runningWeakenThreads = 0
		target.runningHackThreads = 0
		target.runningGrowThreads = 0
	} // End loop over targets
	
	// Then reset by querying all the servers
	for (const servername in servers) {
		let server = servers[servername]
		server = { ...server, ...getServerInfo(server.name, ns) }
		for (let target of targets) {
			let wThreads = 0
			const wscript = ns.getRunningScript(script_weaken, server.name, target.name)
			if (wscript != null) {
				wThreads = wscript.threads || 0
			}
			server.w += wThreads
			target.runningWeakenThreads += wThreads

			let hThreads = 0
			const hscript = ns.getRunningScript(script_hack, server.name, target.name)
			if (hscript!=null){
				hThreads = hscript.threads || 0
			}
			server.h += hThreads
			target.runningHackThreads +=hThreads

			let gThreads = 0
			const gscript = ns.getRunningScript(script_grow, server.name, target.name)
			if (gscript != null) {
				gThreads = gscript.threads
			}
			server.g += gThreads
			target.runningGrowThreads += gThreads
		} // End loop over targets
		servers[servername] = server
	} // End loop over servers

	ns.tprint('Pool before allocation of hacking threads')
	let pool = getPoolFromServers(servers, ns)
	ns.tprint(JSON.stringify(pool))

	let freeSlots = 0
	for (const server in servers) {
		freeSlots += servers[server].slots || 0
	}

	let totalDesiredHackThreads = targets.reduce((sum, target) => sum + (target.desiredHackThreads || 0), 0) - targets.reduce((sum, target) => sum + (target.runningHackThreads || 0), 0)
	totalDesiredHackThreads = Math.max(totalDesiredHackThreads, 0)
	let totalDesiredGrowThreads = targets.reduce((sum, target) => sum + (target.desiredGrowThreads || 0), 0) - targets.reduce((sum, target) => sum + (target.runningGrowThreads || 0), 0)
	totalDesiredGrowThreads = Math.max(totalDesiredGrowThreads, 0)
	let totalDesiredWeakenThreads = targets.reduce((sum, target) => sum + (target.desiredWeakenThreads || 0), 0) - targets.reduce((sum, target) => sum + (target.runningWeakenThreads || 0), 0)
	totalDesiredWeakenThreads = Math.max(totalDesiredWeakenThreads, 0)
	
	ns.tprint(`Want to assign ${totalDesiredHackThreads} hack threads, ${totalDesiredWeakenThreads} weaken threads, and ${totalDesiredGrowThreads} grow threads in ${freeSlots} free slots.`)
	
	let allocatedHackThreads = 0, allocatedGrowThreads = 0, allocatedWeakenThreads = 0
	// Allocate the attack threads first.
	allocatedHackThreads = Math.min(freeSlots, totalDesiredHackThreads);
	let unallocatedSlots = freeSlots - allocatedHackThreads;
	// Split up the rest of the slots in proportion to demand
	const totalDesiredNonHackThreads = totalDesiredWeakenThreads + totalDesiredGrowThreads;
	allocatedGrowThreads = Math.floor(unallocatedSlots * totalDesiredGrowThreads / totalDesiredNonHackThreads)
	allocatedGrowThreads = Math.min(totalDesiredGrowThreads, allocatedGrowThreads)

	allocatedWeakenThreads = Math.floor(unallocatedSlots * totalDesiredWeakenThreads / totalDesiredNonHackThreads)
	allocatedWeakenThreads = Math.min(totalDesiredWeakenThreads, allocatedWeakenThreads)
	//ns.tprint(`Dividing free slots as ${allocatedHackThreads} hack threads, ${allocatedWeakenThreads} weaken threads, and ${allocatedGrowThreads} grow threads.`)
	
	// Allocate all hack threads first.
	ns.tprint(`Allocating ${allocatedHackThreads} hack threads`)
	for (const servername in servers) {
		let server = servers[servername];
		if (server.slots < 1) {
			// No slots to allocate, so skip this server
			continue;
		}
		if (allocatedHackThreads < 1){
			// We're done assigning hack threads, so stop working on it.
			break;
		}
		ns.print(`Server ${server.name} has ${server.slots} slots left to allocate, and there are ${allocatedHackThreads} left to assign.`)
		// Find some targets to hack.
		for (let i = 0; i < targets.length; i++) {
			if (server.slots < 1) {
				// We're out of slots, so move on to the next server.
				break;
			}
			const target = targets[i];
			let desired = (target.desiredHackThreads || 0) - (target.runningHackThreads || 0);
			if (desired < (server.slots * 0.01))
			{// Try not to allocate small workloads to servers with lots of capacity.
				continue;
			}
			if (desired > 0) {
				let alloc = Math.min(desired, allocatedHackThreads, server.slots)
				ns.print(`  We would like to allocate ${alloc} threads from '${server.name}' to hack '${target.name}'.`)
				if (alloc > 0) {
					let retval = ns.exec(script_hack, server.name, alloc, target.name);
					if (retval > 0) {
						ns.print(`  Running ${alloc} threads from '${server.name}' to hack '${target.name}.`)
						allocatedHackThreads -= alloc
						server.slots -= alloc
						target.runningHackThreads = (target.runningHackThreads || 0) + alloc
						server.h = (server.h || 0) + alloc
					} else {
						ns.print(`Failed to exec hack from ${server.name} against ${target.name}.`)
					}
				}
			}
			targets[i] = target;
		}
		servers[servername] = server;
	}

	ns.tprint(`Allocating ${allocatedGrowThreads} grow threads`)
	for (const servername in servers) {
		let server = servers[servername];
		if (server.slots < 1) {
			// No slots to allocate, so skip this server
			continue;
		}
		if (allocatedGrowThreads < 1) {
			// We're done assigning grow threads, so stop working on it.
			break;
		}
		ns.print(`Server ${server.name} has ${server.slots} slots left to allocate, and there are ${allocatedGrowThreads} left to assign.`)
		// Find some targets to grow.
		for (let i = 0; i < targets.length; i++) {
			if (server.slots < 1) {
				// We're out of slots, so move on to the next server.
				break;
			}
			const target = targets[i];
			let desired = (target.desiredGrowThreads || 0) - (target.runningGrowThreads || 0);
			if (desired < (server.slots * 0.01)) {// Try not to allocate small workloads to servers with lots of capacity.
				continue;
			}
			if (desired > 0) {
				let alloc = Math.min(desired, allocatedGrowThreads, server.slots)
				ns.print(`  We would like to allocate ${alloc} threads from '${server.name}' to grow '${target.name}'.`)
				if (alloc > 0) {
					let retval = ns.exec(script_grow, server.name, alloc, target.name);
					if (retval > 0) {
						ns.print(`  Running ${alloc} threads from '${server.name}' to grow '${target.name}.`)
						allocatedGrowThreads -= alloc
						server.slots -= alloc
						target.runningGrowThreads = (target.runningGrowThreads || 0) + alloc
						server.h = (server.h || 0) + alloc
					} else {
						ns.print(`Failed to exec grow from ${server.name} against ${target.name}.`)
					}
				}
			}
			targets[i] = target;
		}
		servers[servername] = server;
	}

	ns.tprint(`Allocating ${allocatedWeakenThreads} weaken threads`)
	for (const servername in servers) {
		let server = servers[servername];
		if (server.slots < 1) {
			// No slots to allocate, so skip this server
			continue;
		}
		if (allocatedWeakenThreads < 1) {
			// We're done assigning weaken threads, so stop working on it.
			break;
		}
		ns.print(`Server ${server.name} has ${server.slots} slots left to allocate, and there are ${allocatedWeakenThreads} left to assign.`)
		// Find some targets to weaken.
		for (let i = 0; i < targets.length; i++) {
			if (server.slots < 1) {
				// We're out of slots, so move on to the next server.
				break;
			}
			const target = targets[i];
			let desired = (target.desiredWeakenThreads || 0) - (target.runningWeakenThreads || 0);
			if (desired < (server.slots * 0.01)) {// Try not to allocate small workloads to servers with lots of capacity.
				continue;
			}
			if (desired > 0) {
				let alloc = Math.min(desired, allocatedWeakenThreads, server.slots)
				ns.print(`  We would like to allocate ${alloc} threads from '${server.name}' to weaken '${target.name}'.`)
				if (alloc > 0) {
					let retval = ns.exec(script_weaken, server.name, alloc, target.name);
					if (retval > 0) {
						ns.print(`  Running ${alloc} threads from '${server.name}' to weaken '${target.name}.`)
						allocatedWeakenThreads -= alloc
						server.slots -= alloc
						target.runningWeakenThreads = (target.runningWeakenThreads || 0) + alloc
						server.h = (server.h || 0) + alloc
					} else {
						ns.print(`Failed to exec weaken from ${server.name} against ${target.name}.`)
					}
				}
			}
			targets[i] = target;
		}
		servers[servername] = server;
	}

	return servers
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
