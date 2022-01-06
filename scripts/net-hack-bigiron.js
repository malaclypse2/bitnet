import { getServerInfo, getPlayerInfo, getAllServerInfo } from "./bitlib"
import { findTargets, getAttackStatus } from "./net-hack"

/** @param {import(".").NS} ns */
export async function main(ns) {
	// handle command line
	let args = ns.flags([
		['target', 'b-and-a']
	])

	// Establish some initial conditions.
	let hostname = ns.getHostname()
	let scriptname = ns.getScriptName()
	let playerInfo = getPlayerInfo()

	let servers = getAllServerInfo({}, ns)
	let targets = findTargets(servers, playerInfo, ns)
	getAttackStatus(servers, targets, ns)

	let target = targets.find( target => { target.name == args.target } )
	if (target == null) {
		ns.tprint(`Could not find target '${args.target}' in the attack network list.`)
		ns.print(`ERROR: Could not find target '${args.target}' in the attack network list.`)
		ns.print(`ERROR: Target list: ${JSON.stringify(targets)}`)

		return
	}

	// Make sure the target is prepped, and that there are no inbound attacks.
	


	// Begin attack run

}