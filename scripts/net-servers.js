import { Server, pad, printLinesNColumns } from '/scripts/bit-lib.js';

let names = ['Alpha(α)', 'Beta(β)', 'Gamma(γ)', 'Delta(Δ)', 'Epsilon(ε)', 'Zeta(ζ)', 'Eta(η)', 'Theta(θ)', 'Iota(ι)', 'Kappa(κ)', 'Lambda(λ)', 'Mu(μ)', 'Nu(ν)', 'Xi(ξ)', 'Omicron(ο)', 'Pi(π)', 'Rho(ρ)', 'Sigma(σ)', 'Tau(τ)', 'Upsilon(υ)', 'Phi(φ)', 'Chi(χ)', 'Psi(Ψ)', 'Omega(Ω)', 'Infinity(∞)'];

/** @param {import('/scripts/index.js').NS} ns */
export async function main(ns) {
    let servers = ns.getPurchasedServers();
    var moneyAvailable = ns.getServerMoneyAvailable('home');

    // Do something with arguments
    let args = ns.flags([
        ['list', false],
        ['prices', false],
        ['buy', 0],
        ['delete', 0],
        ['num', 1],
        ['name', ''],
    ]);
    if (args.delete != 0) {
        servers = deleteServers(args, servers, ns);
    }
    if (args.buy != 0) {
        for (let i = 0; i < args.num; i++) {
            let name = names[servers.length % names.length];
            if (args.name !== '') name = args.name;
            ns.purchaseServer(name, Math.pow(2, args.buy));
        }
        servers = ns.getPurchasedServers();
    }
    if (args.list) {
        ns.tprint(`Current servers [${servers.length}/${ns.getPurchasedServerLimit()}]: `);
        let i = 0;
        let lines = [];
        servers.unshift('home');
        for (const servername of servers) {
            let server = new Server(servername, ns);

            let servernm = pad('            ', servername, true);
            let ram = ns.nFormat(server.ram * Math.pow(2, 30), '0 b');
            ram = pad('      ', ram);
            let cost = pad('         ', ns.nFormat(ns.getPurchasedServerCost(server.ram), '$0.00a'));
            let n = ' ' + pad('  ', i, true) + '.';

            let line = `${n} ${servernm} (${ram}) - ${cost}`;
            lines.push(line);
            i++;
        }
        for (const line of lines) {
            ns.tprint(line);
        }
        if (lines.length === 0) {
            ns.tprint('No purchased servers.');
        }
        ns.tprint('');
    }

    if (args.prices) {
        let lines = [];
        ns.tprint('');
        ns.tprint('Available Money ' + ns.nFormat(moneyAvailable, '$0.00a'));
        ns.tprint(`Server Costs: `);
        ns.tprint(`   #      RAM  Price`);
        for (let i = 1; i <= 20; i++) {
            let ram = Math.pow(2, i);
            let cost = ns.nFormat(ns.getPurchasedServerCost(ram), '$0.00a');
            ram = ns.nFormat(ram * Math.pow(10, 9), '0 b');
            lines.push(`  ${pad('  ', i, true)}.  ${pad('      ', ram, true)}  ${pad('        ', cost)}`);
        }
        printLinesNColumns(lines, 2, ns.tprint);
    }
}
function deleteServers(args, servers, ns) {
    if (args.delete == 999) {
        for (const servername of servers) {
            let deleted = ns.deleteServer(servername);
            if (!deleted) ns.tprint('ERROR: Failed to delete server ' + servername);
        }
    } else {
        if (typeof args.delete == 'number' && args.delete > 0 && args.delete <= servers.length) {
            let servername = servers[args.delete - 1];
            let deleted = ns.deleteServer(servername);
            if (!deleted) ns.tprint('ERROR: Failed to delete server ' + servername);
        } else {
            let deleted = ns.deleteServer(args.delete);
            if (!deleted) ns.tprint('ERROR: Failed to delete server ' + args.delete);
        }
    }
    servers = ns.getPurchasedServers();
    return servers;
}
