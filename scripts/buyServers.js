import { pad, print2Up, print1Up } from '/scripts/bit-lib.js';
import { Server } from "/scripts/classes/Server";

/** @param {import(".").NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tail();
    let servers = ns.getPurchasedServers();
    var moneyAvailable = ns.getServerMoneyAvailable('home');
    var maxRam = ns.getPurchasedServerMaxRam();

    // Do something with arguments
    let args = ns.flags([
        ['buy', 0],
        ['delete', 0],
        ['name', 'slave'],
        ['num', 1],
    ]);
    if (args.delete != 0) {
        if (args.delete == 999) {
            for (const servername of servers) {
                let deleted = ns.deleteServer(servername);
                if (!deleted) ns.print('ERROR: Failed to delete server ' + servername);
            }
        } else {
            if (typeof args.delete == 'number' && args.delete > 0 && args.delete <= servers.length) {
                let servername = servers[args.delete - 1];
                let deleted = ns.deleteServer(servername);
                if (!deleted) ns.print('ERROR: Failed to delete server ' + servername);
            } else {
                let deleted = ns.deleteServer(args.delete);
                if (!deleted) ns.print('ERROR: Failed to delete server ' + args.delete);
            }
        }
        servers = ns.getPurchasedServers();
    }
    if (args.buy != 0) {
        for (let i = 0; i < args.num; i++) {
            ns.purchaseServer(args.name, Math.pow(2, args.buy));
        }
        servers = ns.getPurchasedServers();
    }

    ns.print(`Current servers [${servers.length}/${ns.getPurchasedServerLimit()}]: `);
    let i = 1;
    let lines = [];
    for (const servername of servers) {
        let server = new Server(servername, ns);
        let serverStr = pad('        ', servername, true);
        let ram = ns.nFormat(server.ram * Math.pow(2, 30), '0 b');
        ram = pad('      ', ram);
        let cost = pad('         ', ns.nFormat(ns.getPurchasedServerCost(server.ram), '$0.00a'));
        lines.push(` ${pad('  ', i, true)}. ${serverStr} ( ${ram}) - ${cost}`);
        i++;
    }
    let half = Math.ceil(lines.length / 2);
    print2Up([lines.slice(half), lines.slice(0, half)], ns);

    if (args.buy == 0 && args.delete == 0) {
        lines = [];
        ns.print('');
        ns.print('Available Money ' + ns.nFormat(moneyAvailable, '$0.00a'));
        ns.print(`Server Costs: `);
        ns.print(`   #      RAM  Price`);
        for (let i = 1; i <= 20; i++) {
            let ram = Math.pow(2, i);
            let cost = ns.nFormat(ns.getPurchasedServerCost(ram), '$0.00a');
            ram = ns.nFormat(ram * Math.pow(2, 30), '0 b');
            lines.push(`  ${pad('  ', i, true)}.  ${pad('      ', ram, true)}  ${pad('        ', cost)}`);
        }
        half = Math.ceil(lines.length / 2);
        print2Up([lines.slice(half), lines.slice(0, half)], ns);
    }
}
