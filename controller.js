/** @param {NS} ns **/

const script_purchaseServers = "/scripts/purchaseServers.js";
const script_grow = "/scripts/grow.js";
const script_weaken = "/scripts/weaken.js";
const script_hack = "/scripts/hack.js";

var servers = {};


export async function main(ns) {

	// Make sure the scripts all exist.
	if (!ns.fileExists(script_purchaseServers, 'home')) {
		ns.tprint(`Could not find script '${script_purchaseServers}`)
		return
	}
	if (!ns.ls("home").find(f => f === script_grow)) {
		ns.tprint(`Could not find script '${script_grow}`)
		return
	}
	if (!ns.ls("home").find(f => f === script_weaken)) {
		ns.tprint(`Could not find script '${script_weaken}`)
		return
	}
	if (!ns.ls("home").find(f => f === script_hack)) {
		ns.tprint(`Could not find script '${script_hack}`)
		return
	}

	// Set an initial set of ratios.
	var ratio = {
		grow: 0.50,
		weaken: 0.25,
		hack: 0.25
	}

	var programsCount = await getProgramsAndInstall(false, ns);
	var myInfo = {
		level: ns.getHackingLevel(),
		portsUnlocked: programsCount,
		moneyAvailable: await ns.getServerMoneyAvailable('home')
	}
	var targetServer = await getTargetServer(myInfo, ns)
	await getProgramsAndInstall(targetServer, ns);
	await ns.nuke(targetServer);
	ratio = await getRatio(targetServer, ns);

	await ns.exec(script_purchaseServers, 'home');
	await ns.sleep(1 * 5 * 1000);
	// printing Logs
	var targetMoneyAvailable = await ns.getServerMoneyAvailable(targetServer);
	var targetSecurityLevel = await ns.getServerSecurityLevel(targetServer);
	var targetMinSecurityLevel = await ns.getServerMinSecurityLevel(targetServer);
	var securityThresh = targetMinSecurityLevel + 5;

	var identifyRatio = (ratio.grow == 0.8) ? 'GROWING' : (ratio.weaken == 0.8) ? 'WEAKENING' : 'HACKING';
	ns.tprint('---------------------------------------------------');
	ns.tprint('Starting Scripts.....')
	ns.tprint('Ratio : ' + JSON.stringify(ratio))
	ns.tprint('Target Server Money : ' + ns.nFormat(targetMoneyAvailable, "$0.000a"))
	ns.tprint('Target Server Security Level : +' + (targetSecurityLevel - targetMinSecurityLevel).toFixed(2))
	ns.tprint('RUNNING ' + identifyRatio + ' SCRIPTS')
	ns.tprint('---------------------------------------------------');

	await callScripts(targetServer, ratio, myInfo, programsCount, ns);
	await controlRatio(targetServer, ratio, myInfo, programsCount, ns);
}

async function controlRatio(targetServer, ratio, myInfo, programsCount, ns) {
	while (true) {
		var prevRatio = ratio;
		ratio = await getRatio(targetServer, ns);
		var targetMoneyAvailable = await ns.getServerMoneyAvailable(targetServer);
		var targetSecurityLevel = await ns.getServerSecurityLevel(targetServer);
		var targetMinSecurityLevel = await ns.getServerMinSecurityLevel(targetServer);
		var securityThresh = targetMinSecurityLevel + 5;

		ns.tprint('----- Current Servers -----')
		var w=0, h=0, g=0;
		for (const server in servers) {
			w += servers[server].w;
			h += servers[server].h;
			g += servers[server].g;
		}
		let total = w + h + g;

		ns.tprint(`Hacking: ${h}, Growing: ${g}, Weakening: ${h}.`);
		ns.tprint(JSON.stringify(servers));
		ns.tprint('----- Current Servers -----')

		var identifyRatio = (ratio.grow == 0.8) ? 'GROWING' : (ratio.weaken == 0.8) ? 'WEAKENING' : 'HACKING';
		if (prevRatio.grow != ratio.grow) {
			ns.tprint('---------------------------------------------------');
			ns.tprint('Changing Ratio AND resetting Scripts.....')
			ns.tprint('Ratio : ' + JSON.stringify(ratio))
			ns.tprint('Target Server Money : ' + ns.nFormat(targetMoneyAvailable, "$0.000a"))
			ns.tprint('Target Server Security Level : +' + (targetSecurityLevel - targetMinSecurityLevel).toFixed(2))
			ns.tprint('RUNNING ' + identifyRatio + ' SCRIPTS')
			ns.tprint('---------------------------------------------------');
			targetServer = await getTargetServer(myInfo, ns);
			await ns.exec(script_purchaseServers, 'home');
			await ns.sleep(1 * 5 * 1000);
			await callScripts(targetServer, ratio, myInfo, programsCount, ns);
		}
		else {
			ns.tprint('---------------------------------------------------');
			ns.tprint('Ratio Not Changed.....')
			ns.tprint('Ratio : ' + JSON.stringify(ratio))
			ns.tprint('Target Server Money : ' + ns.nFormat(targetMoneyAvailable, "$0.000a"))
			ns.tprint('Target Server Security Level : +' + (targetSecurityLevel - targetMinSecurityLevel).toFixed(2))
			ns.tprint('RUNNING ' + identifyRatio + ' SCRIPTS')
			ns.tprint('---------------------------------------------------');
		}

		// sleep
		await ns.sleep(5 * 60 * 1000);
		//await ns.sleep(1 * 60 * 1000);
	}
}

async function getRatio(targetServer, ns) {
	var ratio;
	var targetMoneyAvailable = await ns.getServerMoneyAvailable(targetServer);
	var targetMaxMoney = await ns.getServerMaxMoney(targetServer);
	var moneyThresh = targetMaxMoney * 0.85;

	var targetSecurity = await ns.getServerSecurityLevel(targetServer)
	var securityThresh = await ns.getServerMinSecurityLevel(targetServer) + 5;

	if (targetMoneyAvailable < moneyThresh) {
		ratio = {
			grow: 0.80,
			weaken: 0.195,
			hack: 0.005
		}
	}
	else if (targetSecurity > securityThresh) {
		ratio = {
			grow: 0.10,
			weaken: 0.80,
			hack: 0.10
		}
	}
	else {
		ratio = {
			grow: 0.60,
			weaken: 0.25,
			hack: 0.15
		}
	}
	// ns.tprint('Ratio : ' + JSON.stringify(ratio));
	return ratio;
}

async function callScripts(targetServer, ratio, myInfo, programsCount, ns) {
	//run HackScript in Owned Servers
	var purchasedServers = await ns.getPurchasedServers();
	if (purchasedServers.length != 0) {
		var i = 0;
		while (i < purchasedServers.length) {
			var maxRam = await ns.getServerMaxRam(purchasedServers[i]);
			await dispatchToServer(purchasedServers[i], maxRam, targetServer, ratio, ns);
			i++;
		}
	}

	//run HackScript in Home Server
	var usePercentage = '0.90'
	if (myInfo.level == 1)
		usePercentage = '0.95';
	var maxRam = Math.ceil(await ns.getServerMaxRam('home') - 40)
	await dispatchToServer('home', maxRam, targetServer, ratio, ns);


	//run searchAndHack in other Servers
	var nearServers = await ns.scan('home');
	var searchedServers = [];
	await nearServersCapture(nearServers, searchedServers, programsCount, targetServer, ratio, 15, ns);
}

// searchAndHack
export async function nearServersCapture(nearServers, searchedServers, programsCount, targetServer, ratio, searchDepth, ns) {
	for (var i = 0; i < nearServers.length; i++) {
		var find, findCheck = false;
		if (searchedServers.length == 0) {
			searchedServers.push(nearServers[i])
		}
		else {
			var find = searchedServers.find(ele => ele == nearServers[i])
			if (find === undefined) {
				searchedServers.push(nearServers[i]);
				findCheck = true;
			}
		}
		if (findCheck) {
			var reqLevel = ns.getServerRequiredHackingLevel(nearServers[i]);
			var currentLevel = ns.getHackingLevel();
			if (nearServers[i] != 'home' && reqLevel <= currentLevel) {
				var totalPorts = programsCount;
				await getProgramsAndInstall(nearServers[i], ns);
				if (await ns.getServerNumPortsRequired(nearServers[i]) <= totalPorts) {
					await ns.nuke(nearServers[i]);
					var maxRam = await ns.getServerMaxRam(nearServers[i]);
					// ns.tprint(maxRam)

					if (maxRam != 0)
						await dispatchToServer(nearServers[i], maxRam, targetServer, ratio, ns)
					var nearServersDeeper = await ns.scan(nearServers[i]);

					if (nearServersDeeper.length > 1 && searchDepth > 0) {
						await nearServersCapture(nearServersDeeper, searchedServers, programsCount, targetServer, ratio, searchDepth - 1, ns)
					}
				}
			}
		}
	}
}

// execute 3 hacking scripts in the given server
export async function dispatchToServer(server, maxRam, target, ratio, ns) {
	// ns.tprint("Setting up " + currentServer)
	if (server != 'home') {
		await ns.scp(script_grow, server);
		await ns.scp(script_weaken, server);
		await ns.scp(script_hack, server);
	}
	if (ns.scriptRunning(script_grow, server)) {
		await ns.scriptKill(script_grow, server);
	}
	if (ns.scriptRunning(script_weaken, server)) {
		await ns.scriptKill(script_weaken, server);
	}
	if (ns.scriptRunning(script_hack, server)) {
		await ns.scriptKill(script_hack, server);
	}

	var growThread = Math.floor(maxRam * ratio.grow / await ns.getScriptRam(script_grow));
	var weakenThread = Math.floor(maxRam * ratio.weaken / await ns.getScriptRam(script_weaken));
	var hackThread = Math.floor((maxRam * ratio.hack) / await ns.getScriptRam(script_hack));
	// ns.tprint('Ratio : ' + JSON.stringify(ratio))
	if (growThread != 0) {
		if (weakenThread == 0 && hackThread == 0) {
			growThread = Math.floor(maxRam * 1 / await ns.getScriptRam(script_grow));
		}
		await ns.exec(script_grow, server, growThread, target);

	}
	if (weakenThread != 0)
		await ns.exec(script_weaken, server, weakenThread, target);
	if (hackThread != 0)
		await ns.exec(script_hack, server, hackThread, target);
	
	// Save some statistics about this server and the threads running on it.
	let dispatchTime = await ns.getTimeSinceLastAug();
	var waitTime = 0;
	if (growThread > 0) { 
		var w = await ns.getGrowTime(target);
		waitTime = Math.max(waitTime, w);
	}
	if (weakenThread > 0) {
		var w = await ns.getWeakenTime(target);
		waitTime = Math.max(waitTime, w);
	}
	if (hackThread > 0) {
		var w = await ns.getHackTime(target);
		waitTime = Math.max(waitTime, w);
	}

	servers[server] = {'g': growThread, 'w': weakenThread, 'h': hackThread, 't': dispatchTime, 'w': waitTime};
}

export async function getProgramsAndInstall(installCheck, ns) {
	if (!installCheck) {
		var count = 0; 
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
	if (ns.fileExists('BruteSSH.exe', 'home'))
		ns.brutessh(installCheck)
	if (ns.fileExists('FTPCrack.exe', 'home'))
		ns.ftpcrack(installCheck);
	if (ns.fileExists('relaySMTP.exe', 'home'))
		ns.relaysmtp(installCheck);
	if (ns.fileExists('HTTPWorm.exe', 'home'))
		ns.httpworm(installCheck);
	if (ns.fileExists('SQLInject.exe', 'home'))
		ns.sqlinject(installCheck);

}

export async function getTargetServer(myInfo, ns) {
	var target = 'foodnstuff';
	if (myInfo.level == 1) {
		return 'foodnstuff';
	}
	else if ((myInfo.level > 40 && (myInfo.level < 100)) || myInfo.portsUnlocked == 1) {
		target = 'harakiri-sushi'
	}
	else if (myInfo.portsUnlocked == 2 || (myInfo.portsUnlocked > 2 && myInfo.level < 500)) {
		if (myInfo.level < 292)
			target = 'phantasy';
		else
			target = 'phantasy';
	}
	else if (myInfo.portsUnlocked == 3 || (myInfo.portsUnlocked > 3 && myInfo.level < 800)) {
		target = 'phantasy';
	}
	else if (myInfo.portsUnlocked == 4 || (myInfo.portsUnlocked > 4 && myInfo.level < 900)) {
		target = 'phantasy';
	}
	else if (myInfo.portsUnlocked == 5) {
		target = 'phantasy';
	}
	ns.tprint('Target Server : ' + target);
	return target;
}
