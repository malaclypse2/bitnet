import {
    getPlayerInfo,
    getPoolFromServers,
    getAllServerObjects,
    printfSeverAsTarget,
    printfServer,
    printItemsNColumns,
    updateAttackStatus,
    pad,
    boxdraw,
    percentToGraph,
    C2Command,
    Server,
    SubSystem
} from '/scripts/bit-lib.js';
import { readC2messages } from '/scripts/net.js';

/**@typedef{import('/scripts/index.js').NS} NS */

export const subsystems = [
    //new SubSystem('net-hack', '/scripts/net-hack.js', 'home'),
    new SubSystem('daemon', 'daemon.js', 'home'),
    new SubSystem('net-monitor', '/scripts/net-monitor.js', 'home'),
    new SubSystem('stats', 'stats.js', 'home'),
    new SubSystem('hacknet-upgrade-manager', 'hacknet-upgrade-manager.js', 'home'),
    new SubSystem('stockmaster', 'stockmaster.js', 'home'),
    new SubSystem('gangs', 'gangs.js', 'home'),
    new SubSystem('spend-hacknet-hashes', 'spend-hacknet-hashes.js', 'home'),
    new SubSystem('sleeve', 'spend-hacknet-hashes.js', 'home'),
    new SubSystem('work-for-factions', 'work-for-factions.js', 'home'),
];

const displayTypes = ['Short', 'Targets1Up', 'Targets2Up', 'Servers2Up', 'Servers3Up'];
const displayTargets = ['net-hack'];

// Let's try to replicate all of the fancy monitoring and logging from net-hack.js here.
// That way we can move it out of net-hack.js and use that log for actual debugging.
/** @param {NS} ns */
export async function main(ns) {
    // Do something with arguments
    let args = ns.flags([
        ['start', false],
        ['stop', false],
        ['display', 'Short'],
        ['target', 'net-hack'],
    ]);

    if (displayTypes.findIndex((e) => e == args.display) == -1) {
        ns.tprint(`Invalid display type. Valid display types are: ${displayTypes}.`);
        return;
    }
    if (displayTargets.findIndex((e) => e == args.target) == -1) {
        ns.tprint(`Invalid monitoring target. Valid targets are: ${displayTargets}.`);
        return;
    }

    if (args.stop) {
        ns.tprint('Stopping any running monitors.');
        runStop(ns);
    } else if (args.start) {
        await runDisplayLoop(args.target, args.display, ns);
    } else {
        let msg = `
			Invalid flags.  Command line should include either:
				--start To begin monitoring, or
				--stop to end all monitoring.	
			Optional:
				--display ${displayTypes}
				--target ${displayTargets}
			`;
        ns.tprint(msg);
        return;
    }
}

/** @param {NS} ns */
async function runDisplayLoop(displayTarget, displayType, ns) {
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

    /** @type {Object.<string,Server} */
    let servers = {};
    /** @type {Server[]} */
    let targets = [];
    /** @type {import('./bit-lib.js').Player} */
    let playerInfo = {};
    let processesToMonitor = [];

    ns.tail();
    let lastlog = ``;

    let on10 = 0,
        on50 = 0,
        on100 = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        on10 = ++on10 % 10;
        on50 = ++on50 % 50;
        on100 = ++on100 % 100;

        if (on10 == 1) {
            // Read our C2 messages.
            let inbox = await readC2messages('net-monitor', ns);
            for (const msg of inbox) {
                if (msg.subtype === 'C2Command' && msg.action === 'set') {
                    if (msg.key === 'display') {
                        if (msg.value === 'next') {
                            let i = displayTypes.findIndex((t) => t === displayType);
                            i = ++i % displayTypes.length;
                            displayType = displayTypes[i];
                        } else {
                            let newDisplayType = displayTypes.find((t) => t.toLowerCase() === msg.value.toLowerCase());
                            if (newDisplayType) displayType = newDisplayType;
                        }
                    }
                }
            }
        }

        if (on100 == 1) {
            // Update our player info.
            playerInfo = getPlayerInfo(ns);
        }

        // Get all the servers, including any newly purchased ones, and refresh the data on them.
        servers = getAllServerObjects(servers, ns);
        // Get the status of the attack.
        updateAttackStatus(servers, ns);
        // Get the status of any running subsystems
        updateSubsystemInfo(ns);

        // Finally, print a fancy log of the current state of play
        printFancyLog(servers, displayType, playerInfo, ns);
        ns.print(lastlog);
        await ns.asleep(100);
    }
}

/**
 * @param {NS} ns
 */
function updateSubsystemInfo(ns) {
    for (const subsys of subsystems) {
        subsys.refreshStatus(ns);
    }
}

/** @param {NS } ns */
function runStop(ns) {
    ns.scriptKill(ns.getScriptName(), ns.getHostname());
}

/**
 *
 * @param {Object.<string,Server>} servers
 * @param {Server[]} targets
 * @param {*} logType
 * @param {*} playerInfo
 * @param {NS} ns
 */
export function printFancyLog(servers, logType, playerInfo, ns) {
    ns.clearLog(...ns.args);
    const defaultWidth = 52;
    const insideWidth = 48;

    let lines = [];

    // Printing.  Kind of hacky use of the logtype. Should probably fix it.
    let printColumns;
    if (logType.endsWith('3Up')) {
        printColumns = (data) => printItemsNColumns(data, 3, ns.print);
    }
    if (logType.endsWith('2Up')) {
        printColumns = (data) => printItemsNColumns(data, 2, ns.print);
    }
    if (logType.endsWith('1Up')) {
        printColumns = (data) => printItemsNColumns(data, 1, ns.print);
    }

    let targets = Object.values(servers);
    targets = targets.filter((s) => s.targetedBy.hack > 0 || s.targetedBy.grow > 0 || s.targetedBy.weaken > 0);
    targets.sort((t) => t.name);

    let hackTargets = targets.filter((t) => t.targetedBy.hack !== 0);
    let prepTargets = targets.filter((t) => t.targetedBy.hack === 0);

    if (logType.includes('Targets')) {
        // === TARGET DETAIL ===
        // --- Hacking ---
        ns.print(`Hacking the following targets: `);
        for (const target of hackTargets) {
            let lines = printfSeverAsTarget(target, ns);
            lines.push(lines);
        }
        printColumns(lines);

        // --- Prepping ---
        ns.print(`Preparing ${prepTargets.length} targets for attack:`);
        lines = [];
        ns.print(`    ${prepTargets.map((target) => target.name).join(', ')}`);
    }

    if (logType.includes('Servers')) {
        // === SERVER DETAIL ===
        for (const servername in servers) {
            let server = servers[servername];
            let lines = printfServer(server, ns);
            lines.push(lines);
        }
        printColumns(lines);
    }

    if (logType === 'Short') {
        // === "SHORT" ---
        // --- HOME DATA ---
        let lines = [];
        let server = servers['home'];
        let ram = ns.nFormat(server.ram * Math.pow(10, 9), '0 b');
        let free = ns.nFormat(server.freeRam * Math.pow(10, 9), '0 b');
        let pctUsed = (server.ram - server.freeRam) / server.ram;
        // Let's display the percent in used in 5 characters, plus 2 more for brackets
        let progressbar = percentToGraph(pctUsed, '      ');
        ram = pad('      ', ram, true);

        let cores = `Cores `;
        cores += Array(server.cores + 1).join('■');
        cores = pad('                      ', cores);
        lines.push(`${cores}            ${ram} ${progressbar}▏`);

        // --- Purchased Servers ---
        let purchasedServers = Object.values(servers).filter((s) => s.isPurchasedServer);
        let num = purchasedServers.length;

        ram = purchasedServers.reduce((sum, server) => sum + server.ram, 0);
        free = purchasedServers.reduce((sum, server) => sum + server.freeRam, 0);
        pctUsed = (ram - free) / ram;

        progressbar = percentToGraph(pctUsed, '      ');
        ram = ns.nFormat(ram * Math.pow(10, 9), '0 b');
        ram = pad('      ', ram, true);

        free = ns.nFormat(free * Math.pow(10, 9), '0 b');
        free = pad('      ', free, true);
        if (num > 0) {
            let symbols = purchasedServers.map((s) => s.symbol).join('');
            symbols = pad('                         ', symbols);
            lines.push(`Servers ${symbols} ${ram} ${progressbar}▏`);
        }
        lines = boxdraw(lines, 'Home', insideWidth);
        printItemsNColumns([lines], 1, ns.print);
        lines = [];

        // --- RUNNING PROGRAMS ---
        ns.print('');
        // Let's only care about the running systems.
        let runningSubsystems = subsystems.filter((s) => s.status === 'RUNNING');
        runningSubsystems.sort((a, b) => a.scriptInfo.onlineMoneyMade - b.scriptInfo.onlineMoneyMade).reverse();

        // Pad out the subsystem name display to fit the longest name in a neat column.
        let namePadLen = 21;

        let namePad = Array(namePadLen + 1).join(' ');

        for (const system of runningSubsystems) {
            let script = system.scriptInfo;
            let income = '';
            let cps = '';
            if (script.onlineMoneyMade !== 0) {
                income = ns.nFormat(script.onlineMoneyMade, '$0.0a');
                income = `${pad('       ', income, true)}`;
                cps = ns.nFormat(script.onlineMoneyMade / script.onlineRunningTime, '$0a');
                cps = `(${cps}/s)`;
            }
            let name = pad(namePad, system.name);
            let size = ns.nFormat(script.ramUsage * Math.pow(10, 9), '0.00 b');
            size = pad('       ', size, true);
            let line = `${name} ${size}  ${income} ${cps}`;
            lines.push(line);
        }
        lines = boxdraw(lines, 'Running subsystems', insideWidth);
        printItemsNColumns([lines], 1, ns.print);
        lines = [];
    }

    // === SHARED ===
    // --- SWARM STATUS ---
    // get information about the current pool of workers, and reformat everything as pretty strings.
    let pool = getPoolFromServers(servers, ns);
    let percentUsed = pool.running / (pool.free + pool.running);
    percentUsed = ns.nFormat(percentUsed, '0%');
    for (const key in pool) {
        pool[key] = ns.nFormat(pool[key], '0a');
    }

    // Shared summary trailer.
    ns.print('');
    lines = [
        `  Free: ${pool.free}, Running: ${pool.running} (${percentUsed})`,
        `  Hack: ${pool.hack}, Grow: ${pool.grow}, Weaken: ${pool.weaken}`,
    ];
    let swarmStats = boxdraw(lines, 'Swarm Status', insideWidth);
    lines = [`  Being Hacked: ${hackTargets.length}, Being Prepped: ${prepTargets.length}`];
    swarmStats.push(...boxdraw(lines, 'Target Summary', insideWidth));

    printItemsNColumns([swarmStats], 1, ns.print);
}
