/** @type import(".").NS */
let ns = null;

import { getPlayerInfo, getAllServerInfo, getServerInfo, root, printfSeverAsTarget, worker_size, stopscript } from "/scripts/bitlib.js";
const hackThreshold = 0.50 	// Don't start hacking unless a server has this percentage of max money
const hackFactor = 0.20 	// Try to hack this percentage of money at a time
const max_targets = 100;

const script_purchaseServers = "/scripts/purchaseServers.js";
const script_grow = "/scripts/growOnce.js";
const script_weaken = "/scripts/weakenOnce.js";
const script_hack = "/scripts/hackOnce.js";

// Globals so we can access them from other running instances of this porgram if we like.
var targets
var servers

export async function main(_ns) {
	ns = _ns;
	// Do something with arguments
	await runStart(ns);
	ns.tprint("Goodnight, Gracie!")
}

async function runMonitor(_ns) {
	ns = _ns
	ns.tail()
	while(true){
		printFancyLog(ns)
		await ns.sleep(100)
	}
}

async function runStop(_ns) {
	ns = _ns
	ns.kill(ns.getScriptName(), ns.getHostname(), "start")
	ns.kill(ns.getScriptName(), ns.getHostname(), "run")
	ns.kill(ns.getScriptName(), ns.getHostname(), "hack")
	ns.kill(ns.getScriptName(), ns.getHostname(), "monitor")
	ns.kill(ns.getScriptName(), ns.getHostname(), "status")
	ns.kill(ns.getScriptName(), ns.getHostname())
}

async function runStart(_ns) {
	ns = _ns
	targets = []
	servers = {}
	ns.tail()
	ns.tprint('Starting hacking controller.')

	ns.disableLog('getServerRequiredHackingLevel');
	ns.disableLog('getServerMaxRam');
	ns.disableLog('getServerUsedRam');
	ns.disableLog('getServerMaxMoney');
	ns.disableLog('getServerMoneyAvailable');
	ns.disableLog('getServerMinSecurityLevel');
	ns.disableLog('getServerSecurityLevel');
	ns.disableLog('getHackingLevel');
	ns.disableLog('sleep');

	validateScripts(ns);

	let playerInfo = await getPlayerInfo(ns);
//	let servers = await getAllServerInfo({}, ns);
	servers = await getAllServerInfo({}, ns);
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

	// Everyone loves a noodle shop. Let's start there.
	let firstTarget = getServerInfo('n00dles', ns)
	firstTarget = evaluateTarget(firstTarget, playerInfo, ns)
	targets.unshift(firstTarget)

	// How many extra targets should we start with? 
	let pool = getPoolFromServers(servers, ns)
	let additionalTargets = Math.floor(pool.free / 2000)
	additionalTargets = Math.min(additionalTargets, max_targets)
	if (pool.free > 5000 && additionalTargets) {
		addTargets(playerInfo, additionalTargets);
	}


	//Set up a few timers (approx 30sec, 1min, 10min)
	let on30 = 0, on60 = 0, on600 = 0
	while (true) {
		on30 = ++on30 % 30;	on60 = ++on60 % 60;	on600 = ++on600 % 600;
		// Root any available servers
		const oldExploitCount = playerInfo.exploits
		playerInfo = await getPlayerInfo(ns);
		if (oldExploitCount != playerInfo.exploits || on60 == 0) {
			// We either have a new exploit, or it's been a little while.
			// Let's refresh our server info, and make sure there's nothing new to root.
			servers = await rootServers(servers, ns)
		}

		// re-evaluate our targets.
		for (let i = 0; i < targets.length; i++) {
			let target = targets[i]
			// Update server information
			target = { ...target, ...getServerInfo(target.name, ns) }
			// Re-evaluate targetting criteria, including desired attack threads
			target = await evaluateTarget(target, playerInfo, ns);
			targets[i] = target
		}

		// Allocate any free server slots
		servers = await allocateThreads(servers, targets, ns)
		pool = getPoolFromServers(servers, ns)

		// Occasionally consider adding a new target
		if (on30 == 0) {
			// If we have a bunch of free threads, go ahead and add new targets
			let additionalTargets = Math.floor(pool.free / 1000) + 1
			additionalTargets = Math.min(additionalTargets, max_targets - targets.length)
			if (pool.free > 1000 && additionalTargets) {
				addTargets(playerInfo, additionalTargets);
			}
		}

		// Display some status before we sleep
		printFancyLog(ns)

		// Sleep 
		await ns.sleep(1 * 1000);
	} // End while(True)
}

function addTargets(playerInfo, numTargets) {
	let potentialTargets = findTargets(servers, playerInfo, ns);
	let done = false;
	let x = potentialTargets.shift();
	while (!done && x) {
		let existing = targets.find(target => target.name == x.name);
		if (!existing) {
			targets.push(x);
			done = targets.length >= numTargets + 1;
		}
		x = potentialTargets.shift();
	}
}

function printFancyLog(_ns) {
	ns = _ns
	ns.clearLog()

	let pool = getPoolFromServers(servers, ns)
	let free = ns.nFormat(pool.free, "0a")
	let running = ns.nFormat(pool.running, "0a")

	// One column
	if (false) {
		for (const target of targets) {
			const lines = printfSeverAsTarget(target, ns)
			for (const line of lines) {
				ns.print(line)
			}
		}
	}

	// Two-Column. Assumes everything is pretty uniform.
	let displayData = []
	for (const target of targets) {
		const lines = printfSeverAsTarget(target, ns)
		displayData.unshift(lines)
	}
	while (displayData.length > 1) {
		let col1Lines = displayData.pop()
		let col2Lines = displayData.pop()
		for (let i = 0; i < col1Lines.length; i++) {
			let col1 = col1Lines[i];
			let col2 = col2Lines[i];
			ns.print(col1 + '     ' + col2)
		}
	} // Then print any leftovers
	for (const data of displayData) {
		for (const line of data) {
			ns.print(line)
		}
	}
	ns.print('Worker Status')
	ns.print(`Free: ${free}, Running: ${running}`)

}

function getPoolFromServers(servers, _ns) {
	ns = _ns
	let pool = { free: 0, grow: 0, hack: 0, weaken: 0, running: 0 }
	for (const server in servers) {
		const info = servers[server];
		// Treat undefined as 0 here.
		const free   = info.slots || 0;
		const grow   = info.g     || 0;
		const hack   = info.h     || 0;
		const weaken = info.w     || 0;
		pool.free   += free
		pool.grow   += grow  
		pool.hack   += hack  
		pool.weaken += weaken
		pool.running += grow + hack + weaken
	}
	return pool;
}

async function allocateThreads(servers, targets, _ns) {
	ns = _ns
	ns.print('Allocating attack threads.')
	
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
	
	ns.print(`Want to assign ${totalDesiredHackThreads} hack threads, ${totalDesiredWeakenThreads} weaken threads, and ${totalDesiredGrowThreads} grow threads in ${freeSlots} free slots.`)
	
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
	ns.print(`Allocating ${allocatedHackThreads} hack threads`)
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

	ns.print(`Allocating ${allocatedGrowThreads} grow threads`)
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

	ns.print(`Allocating ${allocatedWeakenThreads} weaken threads`)
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
export function findTargets(servers, playerInfo, _ns) {
	ns = _ns
	let targets = []
	// Calculate a theoretical profitiablity score for each server
	for (const server in servers) {
		let info = servers[server]
		info = evaluateTarget(info, playerInfo, ns)
		if (info.score != 0) {
			targets.push(info)
		}
	}
	// sort the target array by score
	targets.sort((a, b) => a.score - b.score)
	targets.reverse()
	return targets
}

export function evaluateTarget(server, playerInfo, _ns) {
	ns = _ns;
	if (server.levelRequired <= playerInfo.level) {
		server.score = server.maxMoney * server.hackFactor / server.securityBase;
		if (server.score == 0) {
			return server;
		}

		if (server.currentMoney / server.maxMoney > hackThreshold) {
			let desiredHackFactor = hackFactor // percentage to steal per hacking cycle. Default 10%
			server.desiredHackThreads = Math.ceil(desiredHackFactor / server.hackFactor)
			server.desiredHackThreads = Math.max(server.desiredHackThreads, 0)
		} else {
			server.desiredHackThreads = 0;
		}

		// How much money is going to be stolen before we grow (on average)?
		let hacksPerGrow = server.growTime / server.hackTime
		let loss = hacksPerGrow * server.desiredHackThreads * server.hackFactor * server.currentMoney
		// How many growth threads would we like to have?
		let desiredGrowthFactor = server.maxMoney / (server.currentMoney - loss);
		if (desiredGrowthFactor >= 1 && desiredGrowthFactor < Infinity) {
			server.desiredGrowThreads = Math.ceil(ns.growthAnalyze(server.name, desiredGrowthFactor));
			server.desiredGrowThreads = Math.max(server.desiredGrowThreads, 0)
		} else {
			server.desiredGrowThreads = 1;
		}
		// Do we need to let the security drop some?
		if ((server.securityCurrent - server.securityBase) > 5) {
			server.desiredGrowThreads = 1;
		}

		// How much will security increase before we weaken?
		let hacksPerWeaken = server.weakenTime / server.hackTime;
		let growsPerWeaken = server.weakenTime / server.growTime;
		let secIncreaseFromHacks = hacksPerWeaken * ns.hackAnalyzeSecurity(server.desiredHackThreads);
		let secIncreaseFromGrowth = growsPerWeaken * ns.growthAnalyzeSecurity(server.desiredGrowThreads);
		let secIncreaseFromThreads = secIncreaseFromGrowth + secIncreaseFromHacks;
		let totalSecToWeaken = server.securityCurrent - server.securityBase + secIncreaseFromThreads;

		server.desiredWeakenThreads = Math.ceil(totalSecToWeaken / 0.05); // Static 0.05 security per thread used.
		server.desiredWeakenThreads = Math.max(server.desiredWeakenThreads, 0)

	} else {
		server.score = 0;
	}

	return server;
}
