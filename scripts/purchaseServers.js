/** @param {NS} ns **/
export async function main(ns) {
	ns.tprint('Buying servers...');
	var moneyAvailable = ns.getServerMoneyAvailable('home');
	var maxRam = await ns.getPurchasedServerMaxRam();
	var ram = 2, serverCost;
	var purchaseToggle = false;

	//get maximum Ram that could be purchased with available money
	for (ram = 2; ram <= maxRam; ram *= 2) {
		var prevCost = serverCost;
		serverCost = await ns.getPurchasedServerCost(ram) * 25;
		if (moneyAvailable < serverCost * 2) {
			ram /= 2;
			serverCost = prevCost;

			break;
		}
	}
	if (ram > 2) {
		var purchasedServers = await ns.getPurchasedServers();
		if (purchasedServers.length == 0) {
			var i = 0;
			while (i <= 24) {
				var hostname = ns.purchaseServer('pserv-' + i, ram);
				++i;
			}
		}
		else if (ram > await ns.getServerMaxRam('pserv-0')) {
			if (purchaseToggle) {
				var i = 0;
				ns.tprint('$$$---Buying 25 ' + ram + 'GB servers for $' + serverCost)
				while (i <= 24) {
					await ns.killall('pserv-' + i);
					await ns.deleteServer('pserv-' + i);
					await ns.purchaseServer('pserv-' + i, ram);

					i++;
				}
			}
			else {
				ns.tprint('Purchasing Servers is OFF for now. Switch ON when necessary');
			}
		}
		else {
			ns.tprint('Cannot afford to Buy Servers with higher Ram than Current ' + await ns.getServerMaxRam('pserv-0') + 'GB');
		}
	}
}