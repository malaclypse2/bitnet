/** @type import(".").NS */
let ns = null;
const worker_size = 2.0 // in GB

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

export function tprintSeverAsTarget(server, _ns){
	ns = _ns
	ns.tprint(`----- Server: ${server.name} -----`)
	ns.tprint(`-- Money:    ${ns.nFormat(server.currentMoney, "$0.0a")} / ${ns.nFormat(server.maxMoney, "$0.0a")} (${ns.nFormat(server.currentMoney / server.maxMoney,"0%")})`)
	ns.tprint(`-- Security: ${server.securityBase}+${(server.securityCurrent - server.securityBase).toFixed(2)}` )
	ns.tprint('')
}

export function getServerInfo(server, _ns) {
	ns = _ns
	let ram = ns.getServerMaxRam(server)
	return {
		'name': server,
		'ram': ram,
		'slots': Math.floor(ram / worker_size),
		'rooted': ns.hasRootAccess(server),
		'maxMoney': ns.getServerMaxMoney(server),
		'currentMoney': ns.getServerMoneyAvailable(server),
		'hackFactor': ns.hackAnalyze(server), 			// Percentage of cash stolen per thread
		'hackTime': ns.getHackTime(server),				// ms per hack() call
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
		info.score = info.maxMoney * info.hackFactor / info.securityBase
		if (info.levelRequired > playerInfo.level) {
			info.score = 0;
		}
		targets.push(info)
	}
	// sort the target array by score
	targets.sort((a,b) => a.score - b.score)
	targets.reverse()
	return targets.slice(0,num)
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
