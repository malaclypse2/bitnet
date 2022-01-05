/** @type import(".").NS */
let ns = null;

const displayTypes = ["Short", "Targets1Up", "Targets2Up"]
const displayTargets = ["net-hack"]

// Let's try to replicate all of the fancy monitoring and logging from net-hack.js here.
// That way we can move it out of net-hack.js and use that log for actual debugging.
export async function main(_ns) {
	ns = _ns;
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

async function runStart(target, displayType, _ns) {
	ns = _ns

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


}

function runStop(_ns) {
	ns = _ns
	ns.scriptKill(ns.getScriptName(), ns.getHostname())
}
