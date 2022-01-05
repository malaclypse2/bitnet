import { getPlayerInfo, getAllServerInfo, getServerInfo, printfSeverAsTarget } from "scripts/bitlib.js";
import { findTargets, getAttackStatus, getPoolFromServers } from "scripts/net-hack.js";

const displayTypes = ["Short", "Targets1Up", "Targets2Up"]
const displayTargets = ["net-hack"]

// Let's try to replicate all of the fancy monitoring and logging from net-hack.js here.
// That way we can move it out of net-hack.js and use that log for actual debugging.
/** @param {import(".").NS } ns */
export async function main(ns) {
	// Do something with arguments
	let args = ns.flags([
		['start', false],
		['stop', false],
		['display', 'Short'],
		['target', 'net-hack'],
	])

	if (displayTypes.findIndex(e => e == args.display) == -1) {
		ns.tprint(`Invalid display type. Valid display types are: ${displayTypes}.`)
		return
	}
	if (displayTargets.findIndex(e => e == args.target) == -1) {
		ns.tprint(`Invalid monitoring target. Valid targets are: ${displayTargets}.`)
		return
	}

	if (args.stop) {
		ns.tprint('Stopping any running monitors.')
		runStop(ns);
	} else if (args.start) {
		await runStart(args.target, args.display, ns);
	} else {
		let msg = `
			Invalid flags.  Command line should include either:
				--start To begin monitoring, or
				--stop to end all monitoring.	
			Optional:
				--display ${displayTypes}
				--target ${displayTargets}
			`
		ns.tprint(msg)
		return
	}
}

/** @param {import(".").NS } ns */
async function runStart(displayTarget, displayType, ns) {
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

	let servers = {}
	let targets = []
	let playerInfo = {}

	ns.tail()

	let on10 = 0, on50 = 0, on100 = 0;
	while(true) {
		on10 = ++on10 % 10; on50 = ++on50 % 50; on100 = ++on100 % 100;
		if (on100 == 1) {
			playerInfo = getPlayerInfo(ns)
			servers = getAllServerInfo(servers, ns)
			targets = findTargets(servers, playerInfo, ns)
		}
		if (on10 == 1) {
			getAttackStatus(servers, targets, ns)
			targets = targets.filter( target => { target.runningHack} )
		}

		printFancyLog(servers, targets, displayTarget, displayType, ns)
		await ns.asleep(100)
	}	
}

/** @param {import(".").NS } ns */
function runStop(ns) {
	ns.scriptKill(ns.getScriptName(), ns.getHostname())
}

/** @param {import(".").NS } ns */
export function printFancyLog(servers, targets, displayTarget, logType, ns) {
	ns.clearLog(...ns.args)

	let pool = getPoolFromServers(servers, ns)
	for (const key in pool) {
		pool[key] = ns.nFormat(pool[key], "0a");
	}
	// One column
	if (logType === "Targets1Up") {
		for (const target of targets) {
			const lines = printfSeverAsTarget(target, ns)
			for (const line of lines) {
				ns.print(line)
			}
		}
	}
	else if (logType == "Targets2Up") {
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
	} else if (logType === "Short") {
		let script = ns.getRunningScript(ns.getScriptName(), ns.getHostname(), ...ns.args);
		ns.print('Runtime: ' + ns.tFormat(script.onlineRunningTime * 1000))
		let cps = ns.nFormat(script.onlineMoneyMade / script.onlineRunningTime, "$0a")
		ns.print(`Income: ${ns.nFormat(script.onlineMoneyMade, "$0a")} (${cps}/sec)`)
		ns.print('')
		ns.print(`Currently attacking ${targets.length} servers.`)
	}

	ns.print('Worker Status')
	ns.print(`Free: ${pool.free}, Running: ${pool.running}`)
	ns.print(`Hack: ${pool.hack}, Grow: ${pool.grow}, Weaken: ${pool.weaken}`)
}
