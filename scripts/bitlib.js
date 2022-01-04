/** @type import(".").NS */
let ns = null;
export const worker_size = 2.0 	// in GB

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

	ns.tprint("findTargets:")
	let targets = findTargets(servers, playerInfo, ns).slice(5)
	for (const target of targets) {
		ns.tprint(target)
		tprintServerAsTarget(target, ns)
	}
}

export async function getPlayerInfo(ns) {
	return {
		level: ns.getHackingLevel(),
		exploits: getProgramCount(ns),
		moneyAvailable: await ns.getServerMoneyAvailable('home')
	}
}

export function pad(pad, str, padLeft) {
	if (typeof str === 'undefined')
		return pad;
	if (padLeft) {
		return (pad + str).slice(-pad.length);
	} else {
		return (str + pad).substring(0, pad.length);
	}
}

export function tprintServerAsTarget(server, _ns) {
	ns = _ns
	const lines = printfSeverAsTarget(server, ns)
	for (const line of lines) {
		ns.tprint(line)
	}

}
export function printfSeverAsTarget(server, _ns){
	ns = _ns
	// Try to keep it to two or three lines per server, or it will never fit in a log window, even with just a few targets
	const moneyCur = ns.nFormat(server.currentMoney, "$0.0a")
	const moneyPercent = pad('   ', ns.nFormat(100*server.currentMoney / server.maxMoney, "0"), true)+'%'
	const moneyStr = `${moneyCur} (${moneyPercent})`

	const secBase = pad('  ',ns.nFormat(server.securityBase, "0"), true)
	const secIncr = pad('    ', ns.nFormat(server.securityCurrent - server.securityBase, "0.0"))
	const secStr = `Sec ${secBase} +${secIncr}`

	const hacksRunning   = ns.nFormat(server.runningHackThreads || 0, "0")
	const hacksWanted    = ns.nFormat(server.desiredHackThreads || 0, "0")
	const growsRunning   = ns.nFormat(server.runningGrowThreads || 0, "0")
	const growsWanted    = ns.nFormat(server.desiredGrowThreads || 0, "0")
	const weakensRunning = ns.nFormat(server.runningWeakenThreads || 0, "0")
	const weakensWanted  = ns.nFormat(server.desiredWeakenThreads || 0, "0")

	const hackStr = pad(Array(16).join('─'), `Hack ${hacksRunning}/${hacksWanted}├`)
	const growStr = pad(Array(17).join('─'), `┤Grow ${growsRunning}/${growsWanted}├`)
	const weakenStr = pad(Array(18).join('─'), `┤Weaken ${weakensRunning}/${weakensWanted}`, true)

	let line1 = `╭─┤`
		line1 += pad(Array(17).join('─'), server.name + '├')
		line1 += pad(Array(17).join('─'), '┤ ' + moneyStr, true) + ' ├─'
		line1 += '┤' + secStr + `├─╮`

	let line2 = `╰─┤${hackStr}${growStr}${weakenStr}├─╯`
	let line3 = ''
	
	return [line1, line2, line3]
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