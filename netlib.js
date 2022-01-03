/** @param {NS} ns **/
export async function main(ns) {
	ns.tprint("No user servicable parts inside.")
	ns.tprint("getPlayerInfo:")
	ns.tprint(JSON.stringify(await getPlayerInfo(ns)))
	ns.tprint("getServerInfo('n00dles')")
	ns.tprint(JSON.stringify(await getServerInfo('n00dles')))
}

export async function getPlayerInfo(ns) {
	return {
		level: ns.getHackingLevel(),
		exploits: await getProgramCount(ns),
		moneyAvailable: await ns.getServerMoneyAvailable('home')
	}
}

export async function getProgramCount(ns) {
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
	let exploits = await getProgramCount();
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

export async function getServerInfo(server, ns) {
	let ram = await ns.getServerMaxRam(server)
	return {
		'ram': ram,
		'slots': Math.floor(ram/1.75),
		'rooted': await ns.hasRootAccess(server)
		}
	
}