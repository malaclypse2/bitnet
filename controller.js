/** @param {NS} ns **/

export async function main(ns) {
	var ratio = {
		grow: 0.50,
		weaken: 0.25,
		hack: 0.25
	}
	//getTargetServer
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

	await ns.exec('purchaseServers.ns', 'home');
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
			await ns.exec('purchaseServers.ns', 'home');
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
		while (i < 25) {
			var maxRam = await ns.getServerMaxRam(purchasedServers[i]);
			await scriptsExecution(purchasedServers[i], maxRam, targetServer, ratio, ns);
			i++;
		}
	}

	//run HackScript in Home Server
	var usePercentage = '0.90'
	if (myInfo.level == 1)
		usePercentage = '0.95';
	var maxRam = Math.ceil(await ns.getServerMaxRam('home') - 40)
	await scriptsExecution('home', maxRam, targetServer, ratio, ns);


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
						await scriptsExecution(nearServers[i], maxRam, targetServer, ratio, ns)
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
export async function scriptsExecution(currentServer, maxRam, targetServer, ratio, ns) {
	// ns.tprint(currentServer)
	if (currentServer != 'home') {
		await ns.scp('grow.js', currentServer);
		await ns.scp('weaken.js', currentServer);
		await ns.scp('hack.js', currentServer);
	}
	if (ns.scriptRunning('grow.js', currentServer)) {
		await ns.scriptKill('grow.js', currentServer);
	}
	if (ns.scriptRunning('weaken.js', currentServer)) {
		await ns.scriptKill('weaken.js', currentServer);
	}
	if (ns.scriptRunning('hack.js', currentServer)) {
		await ns.scriptKill('hack.js', currentServer);
	}

	var growThread = Math.floor(maxRam * ratio.grow / await ns.getScriptRam('grow.js'));
	var weakenThread = Math.floor(maxRam * ratio.weaken / await ns.getScriptRam('weaken.js'));
	var hackThread = Math.floor((maxRam * ratio.hack) / await ns.getScriptRam('hack.js'));
	// ns.tprint('Ratio : ' + JSON.stringify(ratio))
	if (growThread != 0) {
		if (weakenThread == 0 && hackThread == 0) {
			growThread = Math.floor(maxRam * 1 / await ns.getScriptRam('grow.js'));
		}
		await ns.exec('grow.js', currentServer, growThread, targetServer);

	}
	if (weakenThread != 0)
		await ns.exec('weaken.js', currentServer, weakenThread, targetServer);
	if (hackThread != 0)
		await ns.exec('hack.js', currentServer, hackThread, targetServer);
}

export async function getProgramsAndInstall(installCheck, ns) {
	if (!installCheck) {
		var count = 1; //BruteSSH.exe is always installed due to the augmentation
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
