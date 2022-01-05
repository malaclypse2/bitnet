import { getPlayerInfo, getAllServerInfo, getServerInfo, root, printfSeverAsTarget, worker_size, stopscript } from "scripts/bitlib.js";

let hackThreshold = 0.50 	// Don't start hacking unless a server has this percentage of max money
let hackFactor = 0.20 	// Try to hack this percentage of money at a time
let max_targets = 100;
let sleep_time = 1000;

const script_grow = "/scripts/util/growOnce.js";
const script_weaken = "/scripts/util/weakenOnce.js";
const script_hack = "/scripts/util/hackOnce.js";

// Globals so we can access them from other running instances of this program if we like.
var targets
var servers

/** @param {import(".").NS } ns */
export async function main(ns) {
	// Do something with arguments
	let args = ns.flags([
		['start', false],
		['stop', false],
		['max_targets', 100],
		['hackFactor', 0.20],
		['hackThreshold', 0.50],
		['sleep_time', 1000],
		['tail', false],
	])

	if (args.stop) {
		ns.tprint('Stopping any running controllers.')
		runStop(ns);
	} else if (args.start) {
		max_targets = args.max_targets;
		hackFactor = args.hackFactor;
		hackThreshold = args.hackThreshold;
		sleep_time = args.sleep_time
		if (args.tail) {
			ns.tail()
		}
		await runStart(ns);
	} else {
		let msg = `
			Invalid flags.  Command line should include either:
				--start To begin hacking, or
				--stop to end all hacking instances.	
			Optional with --start:
				--max_targets, --hackFactor, --hackThreshold, --tail, sleep_time
			`
		ns.tprint(msg)
		return
	}
}

/** @param {import(".").NS } ns */
function runStop(ns) {
	ns.scriptKill(ns.getScriptName(), ns.getHostname())
}

/** @param {import(".").NS } ns */
async function runStart(ns) {
	targets = []
	servers = {}
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
	ns.disableLog('asleep');

	validateScripts(ns);

	let playerInfo = getPlayerInfo(ns);
	servers = getAllServerInfo({}, ns);

	// Force a root check on available servers
	servers = rootServers(servers, ns)

	// Distribute fresh copies of attack scripts to all servers
	for (const servername in servers) {
		if (servername != 'home') {
			await ns.scp(script_grow, servername);
			await ns.scp(script_hack, servername);
			await ns.scp(script_weaken, servername);
		}
	}
	await ns.asleep(100);

	// Everyone loves a noodle shop. Let's start there.
	let firstTarget = getServerInfo('n00dles', ns)
	firstTarget = evaluateTarget(firstTarget, playerInfo, ns)
	targets.unshift(firstTarget)

	//Set up a few timers (approx 30sec, 1min, 10min)
	let on30 = 0, on60 = 0, on600 = 0
	while (true) {
		on30 = ++on30 % 30;	on60 = ++on60 % 60;	on600 = ++on600 % 600;
		// Check for comand & control 
		// checkC2Ports(ns)

		// Root any available servers
		const oldExploitCount = playerInfo.exploits
		playerInfo = getPlayerInfo(ns);
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
		let pool = getPoolFromServers(servers, ns)

		// Occasionally consider adding a new target
		if (on30 == 1) {
			// If we have a bunch of free threads, go ahead and add new targets
			let additionalTargets = Math.floor(pool.free / 1000) + 1
			additionalTargets = Math.min(additionalTargets, max_targets - targets.length)
			if (pool.free > 1000 && additionalTargets) {
				addTargets(playerInfo, additionalTargets, ns);
			}
		}

		// Sleep 
		await ns.asleep(sleep_time);
	} // End while(True)
}

/** @param {import(".").NS } ns */
function addTargets(playerInfo, numTargets, ns) {
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


/** @param {import(".").NS } ns */
export function getPoolFromServers(servers, ns) {
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

/** @param {import(".").NS } ns */
async function allocateThreads(servers, targets, ns) {
	ns.print('Allocating attack threads.')
	
	// Make sure our notion of running attack threads against each target matches reality.
	// First, reset all our assumptions
	getAttackStatus(servers, targets, ns); // End loop over servers

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
	allocatedHackThreads = Math.max(allocatedHackThreads, 0)
	let unallocatedSlots = freeSlots - allocatedHackThreads;

	// Split up the rest of the slots in proportion to demand
	const totalDesiredNonHackThreads = totalDesiredWeakenThreads + totalDesiredGrowThreads;
	if (totalDesiredNonHackThreads > freeSlots) {
		allocatedGrowThreads = Math.floor(unallocatedSlots * totalDesiredGrowThreads / totalDesiredNonHackThreads)
		allocatedGrowThreads = Math.min(totalDesiredGrowThreads, allocatedGrowThreads)
		allocatedGrowThreads = Math.max(allocatedGrowThreads, 0)

		allocatedWeakenThreads = Math.floor(unallocatedSlots * totalDesiredWeakenThreads / totalDesiredNonHackThreads)
		allocatedWeakenThreads = Math.min(totalDesiredWeakenThreads, allocatedWeakenThreads)
		allocatedWeakenThreads = Math.max(allocatedWeakenThreads, 0)
	} else {
		allocatedGrowThreads = totalDesiredGrowThreads;
		allocatedWeakenThreads = totalDesiredWeakenThreads;
	}
	//ns.tprint(`Dividing free slots as ${allocatedHackThreads} hack threads, ${allocatedWeakenThreads} weaken threads, and ${allocatedGrowThreads} grow threads.`)
	
	// Put things into variables they'll be easier to get later
	let allocated = { hack: allocatedHackThreads, grow: allocatedGrowThreads, weaken: allocatedWeakenThreads }
	let totalAllocated = allocated.hack + allocated.grow + allocated.weaken
	let attackScripts = { hack: script_hack, grow: script_grow, weaken: script_weaken }
	for (const target of targets) {
		target.desired = { hack: target.desiredHackThreads, grow: target.desiredGrowThreads, weaken: target.desiredWeakenThreads }
		target.running = { hack: target.runningHackThreads, grow: target.runningGrowThreads, weaken: target.runningWeakenThreads }
	}
	// Exec all the attack threads on servers
	for (const servername in servers) {
		let server = servers[servername];
		// If we don't have any slots left, move to the next server
		if (server.slots < 1) continue;

		totalAllocated = allocated.hack + allocated.grow + allocated.weaken
		// If we don't have anything left to assign, quit.
		if (totalAllocated < 1) break;

		ns.print(`Server ${server.name} has ${server.slots} for attack threads.`)
		for (const target of targets) {
			for (const attackType of ['hack', 'weaken', 'grow']) {
				let desired = Math.min(
					target.desired[attackType] - target.running[attackType],
					allocated[attackType],
					server.slots,
				)
				if (desired > 0) {
					let retval = ns.exec(attackScripts[attackType], server.name, desired, target.name, ns.getTimeSinceLastAug());
					if (retval > 0) {
						allocated[attackType] -= desired
						server.slots -= desired
						target.running[attackType] = target.running[attackType] + desired
						switch (attackType) {
							case 'hack':
								server.h = (server.h || 0) + desired
								target.runningHackThreads = (target.runningHackThreads||0) + desired
								break;
							case 'grow':
								server.g = (server.g||0) + desired
								target.runningGrowThreads = (target.runningGrowThreads||0) + desired
								break;
							case 'weaken':
								server.w = (server.w||0) + desired
								target.runningWeakenThreads = (target.runningWeakenThreads||0) + desired
								break;
							default:
								break;
						}
					} // end if succeeded.
				}
			} 
		}
		servers[servername] = server
	}

	return servers
}

/** @param {import(".").NS } ns */
export function getAttackStatus(servers, targets, ns) {
	for (const servername in servers) {
		let server = servers[servername];
		server.w = 0;
		server.h = 0;
		server.g = 0;
		servers[servername] = server;
	} // End loop over servers
	for (let target of targets) {
		target.runningWeakenThreads = 0;
		target.runningHackThreads = 0;
		target.runningGrowThreads = 0;
	} // End loop over targets


	// Then reset by querying all the servers
	for (const servername in servers) {
		let server = servers[servername];
		// Pull fresh server info
		server = { ...server, ...getServerInfo(server.name, ns) };
		// Query the server to see what attack threads it is running.
		let procs = ns.ps(server.name) 
		while(procs.length > 0) {
			const proc = procs.pop()
			if (proc.filename.includes('weaken')) {
				let target = targets.find(target => target.name == proc.args[0])
				if (target) target.runningWeakenThreads += proc.threads;
				server.w += proc.threads
			}
			if (proc.filename.includes('grow')) {
				let target = targets.find(target => target.name == proc.args[0])
				if (target) target.runningGrowThreads += proc.threads;
				server.g += proc.threads
			}
			if (proc.filename.includes('hack')) {
				let target = targets.find(target => target.name == proc.args[0])
				if (target) target.runningHackThreads += proc.threads;
				server.h += proc.threads
			}
		}
		servers[servername] = server;
	}
}

/** @param {import(".").NS } ns */
export function rootServers(servers, ns) {
	for (const server in servers) {
		const info = servers[server]
		// Try to root any servers we haven't gotten yet.
		if (!info.rooted) {
			const success = root(server, ns)
			if (success) {
				// merge existing data so we don't lose thread counts
				servers[server] = {
					...info,
					...getServerInfo(server, ns)
				}
			}
		}
	}
	return servers
}

function validateScripts(ns) {
	// Make sure the scripts all exist.
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

/** @param {import(".").NS } ns */
export function findTargets(servers, playerInfo, ns) {
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

/** @param {import(".").NS } ns */
export function evaluateTarget(server, playerInfo, ns) {
	// We can only hack servers that are rooted, and that have a level lower than our level.
	if (server.levelRequired <= playerInfo.level && server.rooted) {
		server.score = server.maxMoney * server.hackFactor / server.securityBase;
		if (server.score == 0) {
			return server;
		}

		if (server.currentMoney / server.maxMoney > hackThreshold) {
			let desiredHackFactor = hackFactor // percentage to steal per hacking cycle
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

/** @param {import(".").NS } ns */
function checkC2Ports(ns) {
	// To start with, we can allow adjusting some of our global parameters via c2:
	// hackThreshold, hackFactor, max_targets, logType
	let commands = []
	let cmd = ns.readPort(2)
	while (cmd != "NULL PORT DATA") {
		commands.push(cmd)
		cmd = ns.readPort(2)
	}
	while (commands) {
		// expects {owner:'net-hack', action: 'set', key:'some-key', value:'some-value'}
		// ...at least for now.
		cmd = commands.pop()
		ns.tprint('Reading C2 command: ' + cmd)
		if (cmd == undefined || cmd == null) {
			continue;
		}
		if (cmd.owner != "net-hack") {
			ns.writePort(cmd)
			continue;
		}
		if (cmd.key == 'hackThreshold' && cmd.action == 'set') hackThreshold = cmd.value;
		if (cmd.key == 'hackFactor' && cmd.action == 'set') hackFactor = cmd.value;
		if (cmd.key == 'max_targets' && cmd.action == 'set') max_targets = cmd.value;
		if (cmd.key == 'logType' && cmd.action == 'set') logType = cmd.value;
	}

}