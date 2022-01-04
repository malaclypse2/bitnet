/** @type import(".").NS */
let ns = null;
export const worker_size = 2.0 	// in GB
const hackThreshold = 0.75 	// Don't start hacking unless a server has this percentage of max money
const hackFactor = 0.15 	// Try to hack this percentage of money at a time

export async function main(_ns) {
	ns = _ns;
	
	ns.tprint("No user servicable parts inside.")
	
	ns.tprint("getPlayerInfo:")
	let playerInfo = await getPlayerInfo(ns)
	ns.tprint(JSON.stringify(playerInfo))

	ns.tprint("getServerInfo('n00dles')")
	ns.tprint(JSON.stringify(getServerInfo('n00dles', ns)))

	ns.tprint("getAllServerInfo:")
	let servers = getAllServerInfo( {}, ns )
	ns.tprint(JSON.stringify(servers))

	ns.tprint("findTargets(servers, 5):")
	let targets = findTargets(servers, 5, playerInfo, ns)
	for (const target of targets) {
		ns.tprint(target)
		tprintSeverAsTarget(target, ns)
	}
}

export async function getPlayerInfo(ns) {
	return {
		level: ns.getHackingLevel(),
		exploits: getProgramCount(ns),
		moneyAvailable: await ns.getServerMoneyAvailable('home')
	}
}

export function printSeverAsTarget(server, _ns){
	ns = _ns
	// Try to keep it to two or three lines per server, or it will never fit in a log window, even with just a few targets
	const width = 35
	const moneyCur = ns.nFormat(server.currentMoney, "$0.0a")
	const moneyMax = ns.nFormat(server.maxMoney, "$0.0a")
	const moneyPercent = ns.nFormat(server.currentMoney / server.maxMoney, "0%")
	const secBase = ns.nFormat(server.securityBase, "0")
	const secIncr = ns.nFormat(server.securityCurrent - server.securityBase, "0.0")
	
	ns.print(`┌┤ ${server.name} [${moneyCur}/${moneyMax} (${moneyPercent})]		SecLevel ${secBase}+${secIncr} ├───`)
	ns.print(`└─ Hack: [${server.runningHackThreads || 0}/${server.desiredHackThreads || 0}] Grow: [${server.runningGrowThreads || 0}/${server.desiredGrowThreads || 0}], Weaken: [${server.runningWeakenThreads || 0}/${server.desiredWeakenThreads || 0}] ───`)
}

export function getServerInfo(server, _ns) {
	ns = _ns
	let ram = ns.getServerMaxRam(server)
	let freeRam = ram - ns.getServerUsedRam(server)
	let rooted = ns.hasRootAccess(server)
	let slots = 0
	if (rooted) {
		slots = Math.floor(freeRam / worker_size)
	}
	return {
		'name': server,
		'ram': ram,
		'slots': slots,
		'rooted': rooted,
		'maxMoney': ns.getServerMaxMoney(server),
		'currentMoney': ns.getServerMoneyAvailable(server),
		'hackFactor': ns.hackAnalyze(server), 			// Percentage of cash stolen per thread
		'hackTime': ns.getHackTime(server),				// ms per hack() call
		'growTime': ns.getGrowTime(server),
		'weakenTime': ns.getWeakenTime(server),
		'securityBase': ns.getServerMinSecurityLevel(server),
		'securityCurrent': ns.getServerSecurityLevel(server),
		'levelRequired': ns.getServerRequiredHackingLevel(server)
	}

}

export function findTargets(servers, num, playerInfo, _ns){
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
	targets.sort((a,b) => a.score - b.score)
	targets.reverse()
	return targets.slice(0,num)
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

function scan(ns, parent, server, list) {
	const children = ns.scan(server);
	for (let child of children) {
		if (parent == child) {
			continue;
		}
		list.push(child);

		scan(ns, server, child, list);
	}
}

export function getServerNames(ns) {
	const list = [];
	scan(ns, '', 'home', list);
	return list;
}

export function getAllServerInfo(servers, _ns) {
	ns = _ns
	servers['home'] = {...servers['home'], ...getServerInfo('home', ns)}

	let foundServers = getServerNames(ns);
	for (const server of foundServers) {
		let info = getServerInfo(server, ns);
		servers[server] = {...servers[server], ...info}
	}
	return servers
}

export function getProgramCount(ns) {
	let count = 0;
	if (ns.fileExists('BruteSSH.exe', 'home'))
		count++;
	if (ns.fileExists('FTPCrack.exe', 'home'))
		count++;
	if (ns.fileExists('relaySMTP.exe', 'home'))
		count++;
	if (ns.fileExists('HTTPWorm.exe', 'home'))
		count++;
	if (ns.fileExists('SQLInject.exe', 'home'))
		count++;

	return count;
}

export async function root(target, ns) {
	let exploits = getProgramCount(ns);
	let needed = await ns.getServerNumPortsRequired(target);
	if (exploits >= needed) {
		if (ns.fileExists('BruteSSH.exe', 'home'))
			ns.brutessh(target)
		if (ns.fileExists('FTPCrack.exe', 'home'))
			ns.ftpcrack(target);
		if (ns.fileExists('relaySMTP.exe', 'home'))
			ns.relaysmtp(target);
		if (ns.fileExists('HTTPWorm.exe', 'home'))
			ns.httpworm(target);
		if (ns.fileExists('SQLInject.exe', 'home'))
			ns.sqlinject(target);
		ns.nuke(target);
		return 1;
	}
	return 0;
}

export function stopscript(servers, script,_ns){
	ns = _ns
	for (const servername in servers) {
		ns.scriptKill(script, servername)
	}
}