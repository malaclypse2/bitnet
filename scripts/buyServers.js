import { getServerInfo, pad } from "scripts/bitlib.js";

/** @param {import(".").NS} ns */
export async function main(ns) {
	let servers = ns.getPurchasedServers()
	var moneyAvailable = ns.getServerMoneyAvailable('home');
	var maxRam = await ns.getPurchasedServerMaxRam();

	ns.tprint(`Current servers [${servers.length}/${ns.getPurchasedServerLimit()}]: `)
	let i = 0
	for (const servername of servers) {
		let server = getServerInfo(servername, ns);
		let serverStr = pad('           ', servername, true)
		let ram = ns.nFormat(server.ram * Math.pow(2, 30), "0 b")
		ram =  pad('      ', ram)
		let cost = pad('     ', ns.nFormat(ns.getPurchasedServerCost(server.ram), '$0.00a'), true)
		ns.tprint(` ${pad('  ', i, true)}. ${serverStr} ( ${ram}) - ${cost}`)
		i++
	}
	ns.tprint('')
	ns.tprint('Available Money ' + ns.nFormat(moneyAvailable, "$0.00a"))
	ns.tprint(`Server Costs: `)
	ns.tprint(`   #      RAM  Price`)
	for (let i = 1; i <= 20; i++) {
		let ram = Math.pow(2,i)
		let cost = ns.nFormat(ns.getPurchasedServerCost(ram), '$0.00a')
		ram = ns.nFormat(ram * Math.pow(2, 30), "0 b")
		ns.tprint(`  ${pad('  ', i, true)}.  ${pad('      ', ram, true)}  ${pad('        ', cost)}`)
	}


}