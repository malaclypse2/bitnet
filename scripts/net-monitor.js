import { getPlayerInfo, getAllServerInfo, getServerInfo, printfSeverAsTarget, print1Up, print2Up, print3Up } from "scripts/bitlib.js";
import { findTargets, getAttackStatus, getPoolFromServers } from "scripts/net-hack.js";

const displayTypes = ["Short", "Targets1Up", "Targets2Up", "Servers2Up", "Servers3Up"]
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
	let processesToMonitor = []

	ns.tail()

	let on10 = 0, on50 = 0, on100 = 0;
	while(true) {
		on10 = ++on10 % 10; on50 = ++on50 % 50; on100 = ++on100 % 100;
		if (on100 == 1) {
			playerInfo = getPlayerInfo(ns)
			servers = getAllServerInfo(servers, ns)
			targets = findTargets(servers, playerInfo, ns)
			processesToMonitor = findInterestingProcesses(ns)
		}
		if (on10 == 1) {
			getAttackStatus(servers, targets, ns)
		}
		if (on100 == 1) {
			targets = targets.filter(target => (target.runningWeakenThreads || 0) > 0)
		}

		printFancyLog(servers, targets, processesToMonitor, displayType, ns)
		await ns.asleep(100)
	}	
}

function findInterestingProcesses(ns) {
	let interestingProcs = []
	// Start by looking at the script's host
	let hostname = ns.getHostname()
	let procs = ns.ps(hostname)
	for (const procInfo of procs) {
		if (procInfo.filename.includes('net-')) {
			let proc = ns.getRunningScript(procInfo.filename, hostname, ...procInfo.args)
			if (proc && proc.onlineMoneyMade > 0) {
				procInfo.hostname = hostname
				interestingProcs.push(procInfo)
			}
		}
	}
	return interestingProcs;
}

/** @param {import(".").NS } ns */
function runStop(ns) {
	ns.scriptKill(ns.getScriptName(), ns.getHostname())
}

/** @param {import(".").NS } ns */
export function printFancyLog(servers, targets, controlScriptInfo, logType, ns) {
	ns.clearLog(...ns.args)

	// get information about the current pool of workers, and reformat everything as pretty strings.
	let pool = getPoolFromServers(servers, ns)
	for (const key in pool) {
		pool[key] = ns.nFormat(pool[key], "0a");
	}
	let displayData = []

	if (logType.includes("Targets")) {
		for (const target of targets) {
			let lines = printfSeverAsTarget(target, ns)
			displayData.push(lines)
		}
	}

	if (logType.includes("Servers")) {
		for (const servername in servers) {
			let server = servers[servername]
			let lines = printfServer(server, ns)
			displayData.push(lines)
		}
	}

	// Printing.  Kind of hacky use of the logtype. Should probably fix it.
	if (logType.endsWith("3Up")) {
		print3Up(displayData, ns);
	}
	if (logType.endsWith("2Up")) {
		print2Up(displayData, ns);
	}
	if (logType.endsWith("1Up")) {
		print1Up(displayData, ns);
	}
	 
	if (logType === "Short") {
		for (const controller of controlScriptInfo) {
			let script = ns.getRunningScript(controller.filename, controller.hostname, ...controller.args);	
			if (script) {
				let runTime = ns.tFormat(script.onlineRunningTime * 1000)
				let basename = script.filename.split('/').pop()
				let cps = ns.nFormat(script.onlineMoneyMade / script.onlineRunningTime, "$0a")
				
				ns.print(`${basename}@${controller.hostname} args=[${script.args}] `)
				ns.print(`Runtime: ${runTime}`)
				ns.print(`Income: ${ns.nFormat(script.onlineMoneyMade, "$0a")} (${cps}/sec)`)
			}
			ns.print('')
		}
		
		ns.print(`Currently attacking ${targets.length} targets.`)
	}

	ns.print('Swarm Worker Status')
	ns.print(`Free: ${pool.free}, Running: ${pool.running}`)
	ns.print(`Hack: ${pool.hack}, Grow: ${pool.grow}, Weaken: ${pool.weaken}`)
}


