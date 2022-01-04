/** @type import(".").NS */
let ns = null;

import { getPlayerInfo, getAllServerInfo, getServerInfo, root, findTargets, tprintSeverAsTarget, evaluateTarget, worker_size, stopscript } from "/scripts/netlib.js";

const script_purchaseServers = "/scripts/purchaseServers.js";
const script_grow = "/scripts/growOnce.js";
const script_weaken = "/scripts/weakenOnce.js";
const script_hack = "/scripts/hackOnce.js";

export async function main(_ns) {
	ns = _ns;
	ns.tprint('Starting hacking controller.')
	
	validateScripts(ns);
	
	// Pick a target
	let playerInfo = await getPlayerInfo(ns);
	//	ns.tprint(JSON.stringify(playerInfo))
	let servers = await getAllServerInfo({}, ns);
	
	// Stop all previously running workers
	stopscript(servers, script_grow, ns)
	stopscript(servers, script_weaken, ns)
	stopscript(servers, script_hack, ns)
	await ns.sleep(500);

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
	await ns.sleep(500);
	
	// Get the best targets based on our evaluation function
	let targets = findTargets(servers, 5, playerInfo, ns)
	
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
			targets[i] = await evaluateTarget(targets[i], playerInfo, ns);
		}

		// Allocate any free server slots
		servers = await allocateThreads(servers, targets, ns)
		
		// Display some status before we sleep
		for (const target of targets) {
			tprintSeverAsTarget(target, ns)
		}

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

async function allocateThreads(servers, targets, _ns) {
	ns = _ns
	ns.tprint('Allocating attack threads.')
	
	let freeSlots = 0
	for (const server in servers) {
		freeSlots += servers[server].slots || 0
	}

	// Make sure our notion of running attack threads against each target matches reality.
	// First, reset all our assumptions
	for (const servername in servers) {
		let server = servers[servername]
		server.w = 0
		server.h = 0
		server.g = 0
		server.slots = Math.floor((ns.getServerMaxRam(server.name) - ns.getServerUsedRam(server.name)) / worker_size)
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
		if (server.rooted) {
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
		} // End if(rooted)
		servers[servername] = server
	} // End loop over servers

	ns.tprint('Pool before allocation of hacking threads')
	let pool = getPoolFromServers(servers, ns)
	ns.tprint(JSON.stringify(pool))

	let totalDesiredHackThreads = targets.reduce((sum, target) => sum + target.desiredHackThreads || 0, 0) - targets.reduce((sum, target) => sum + target.runningHackThreads || 0, 0)
	let totalDesiredGrowThreads = targets.reduce((sum, target) => sum + target.desiredGrowThreads || 0, 0) - targets.reduce((sum, target) => sum + target.runningGrowThreads || 0, 0)
	let totalDesiredWeakenThreads = targets.reduce((sum, target) => sum + target.desiredWeakenThreads || 0, 0) - targets.reduce((sum, target) => sum + target.runningWeakenThreads || 0, 0)
	ns.tprint(`Want to assign ${totalDesiredHackThreads} hack threads, ${totalDesiredWeakenThreads} weaken threads, and ${totalDesiredGrowThreads} grow threads in ${freeSlots} free slots.`)
	
	let allocatedHackThreads = 0, allocatedGrowThreads = 0, allocatedWeakenThreads = 0
	// Allocate the attack threads first.
	allocatedHackThreads = Math.min(freeSlots, totalDesiredHackThreads);
	let unallocatedSlots = freeSlots - allocatedHackThreads;
	// Split up the rest of the slots in proportion to demand
	const totalDesiredNonHackThreads = totalDesiredWeakenThreads + totalDesiredGrowThreads;
	allocatedGrowThreads = Math.floor(unallocatedSlots * totalDesiredGrowThreads / totalDesiredNonHackThreads)
	allocatedWeakenThreads = Math.floor(unallocatedSlots * totalDesiredWeakenThreads / totalDesiredNonHackThreads)
	ns.tprint(`Dividing free slots as ${allocatedHackThreads} hack threads, ${allocatedWeakenThreads} weaken threads, and ${allocatedGrowThreads} grow threads.`)
	// Allocate all hack threads first.
	ns.tprint(`Allocating ${allocatedHackThreads} hack threads`)
	for (const item in servers) {
		let server = servers[item]
		if (allocatedHackThreads > 0) {
			for(let target of targets) {
				if (allocatedHackThreads > 0 && server.slots > 0) {
					let desired = target.desiredHackThreads || 0 - target.runningHackThreads || 0
					let alloc = Math.min(desired, allocatedHackThreads, server.slots)	
					if (alloc > 0) {
						let retval = await spawnProgram(server.name, script_hack, target.name, alloc, ns)
						if (retval > 0) {
							allocatedHackThreads -= alloc
							server.slots -= alloc
							target.runningHackThreads = target.runningHackThreads || 0 + alloc
							server.h = server.h || 0 + alloc
						}
					}
				} else {
					break;
				}
			}
		} else {
			break;
		}
		servers[item] = server
	}

	ns.tprint('Pool after allocation of hacking threads')
	pool = getPoolFromServers(servers, ns)
	ns.tprint(JSON.stringify(pool))
	ns.tprint(JSON.stringify(servers))
	ns.tprint(JSON.stringify(targets))

	ns.tprint(`Allocating ${allocatedGrowThreads} grow threads`)
	for (const item in servers) {
		let server = servers[item]
		if (allocatedGrowThreads > 0) {
			for (let target of targets) {
				if (allocatedGrowThreads > 0 && server.slots > 0) {
					let desired = target.desiredGrowThreads || 0 - target.runningGrowThreads || 0
					let alloc = Math.min(desired, allocatedGrowThreads, server.slots)
					if (alloc > 0) {
						let retval = await spawnProgram(server.name, script_grow, target.name, alloc, ns)
						if (retval > 0) {
							allocatedGrowThreads -= alloc
							server.slots -= alloc
							target.runningGrowThreads = target.runningGrowThreads || 0 + alloc
							server.g = server.g || 0 + alloc
						}
					}
				} else {
					break;
				}
			}
		} else {
			break;
		}
		servers[item] = server
	}

	ns.tprint(`Allocating ${allocatedWeakenThreads} weaken threads`)
	for (const item in servers) {
		let server = servers[item]
		if (allocatedWeakenThreads > 0) {
			for (let target of targets) {
				if (allocatedWeakenThreads > 0 && server.slots > 0) {
					let desired = target.desiredWeakenThreads || 0 - target.runningWeakenThreads || 0
					let alloc = Math.min(desired, allocatedWeakenThreads, server.slots)
					if (alloc > 0) {
						let retval = spawnProgram(server.name, script_weaken, target.name, alloc, ns)
						if (retval > 0) {
							allocatedWeakenThreads -= alloc
							server.slots -= alloc
							target.runningWeakenThreads = target.runningWeakenThreads || 0 + alloc
							server.w = server.w || 0 + alloc
						}
					}
				} else {
					break;
				}
			}
		} else {
			break;
		}
		servers[item] = server
	}

	ns.print('Pool after allocation:')
	pool = getPoolFromServers(servers, ns)
	ns.tprint(JSON.stringify(pool))

	return servers

}

function spawnProgram(server, script, target, threads, _ns) {
	ns = _ns
	if (server === 'home') {
		ns.run(script, threads, target)
	} else {
		ns.exec(script, server, threads, target);
	}
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
