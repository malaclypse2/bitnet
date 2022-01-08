import { Server } from "./bit-types";

export const worker_size = 2.0; // in GB

/** @param {import(".").NS } ns */
export async function main(ns) {
    ns.tprint('No user servicable parts inside.');

    ns.tprint('getPlayerInfo:');
    let playerInfo = getPlayerInfo(ns);
    ns.tprint(JSON.stringify(playerInfo));

    ns.tprint("new Server('n00dles')");
    ns.tprint(JSON.stringify(new Server('n00dles', ns)));

    ns.tprint('getAllServerInfo:');
    let servers = getAllServerInfo({}, ns);
    ns.tprint(JSON.stringify(servers));
}

/**
 * @typedef {import(".").Player} Player
 * @property {number} exploits - The number of exploits owned by the player
 * @property {number} level - player hacking level
 * @property {number} moneyAvailable - The amount of money the player has available
 */

/**
 * Get a player object, and enrich it a bit
 *
 * @export
 * @param {import(".").NS} ns
 * @return {Player}
 */
export function getPlayerInfo(ns) {
    let p = ns.getPlayer();
    p.level = ns.getHackingLevel();
    p.exploits = getProgramCount(ns);
    p.moneyAvailable = ns.getServerMoneyAvailable('home');
    return p;
}

/**
 * Pad a string. Defaults to right pad. The length is based on the pad string.
 * @param {string} pad - padding
 * @param {string} str - the base string
 * @param {boolean} [padLeft=false] - pad to the left?
 * @return {string} - the string with padding applied
 * */
export function pad(pad, str, padLeft) {
    if (typeof str === 'undefined') return pad;
    if (padLeft) {
        return (pad + str).slice(-pad.length);
    } else {
        return (str + pad).substring(0, pad.length);
    }
}

/** @param {import(".").NS } ns */
export function tprintServerAsTarget(server, ns) {
    const lines = printfSeverAsTarget(server, ns);
    for (const line of lines) {
        ns.tprint(line);
    }
}

/** @param {import(".").NS } ns */
export function printfSeverAsTarget(server, ns) {
    // Try to keep it to two or three lines per server, or it will never fit in a log window, even with just a few targets
    const moneyCur = ns.nFormat(server.currentMoney, '$0.0a');
    const moneyPercent = pad('   ', ns.nFormat((100 * server.currentMoney) / server.maxMoney, '0'), true) + '%';
    const moneyStr = `${moneyCur} (${moneyPercent})`;

    const secBase = pad('  ', ns.nFormat(server.securityBase, '0'), true);
    const secIncr = pad('    ', ns.nFormat(server.securityCurrent - server.securityBase, '0.0'));
    const secStr = `Sec ${secBase} +${secIncr}`;

    const hacksRunning = ns.nFormat(server.running.hack, '0');
    const hacksWanted = ns.nFormat(server.desired.hack, '0');
    const growsRunning = ns.nFormat(server.running.grow, '0');
    const growsWanted = ns.nFormat(server.desired.grow, '0');
    const weakensRunning = ns.nFormat(server.running.weaken, '0');
    const weakensWanted = ns.nFormat(server.desired.weaken, '0');

    const hackStr = pad(Array(16).join('─'), `Hack ${hacksRunning}/${hacksWanted}├`);
    const growStr = pad(Array(17).join('─'), `┤Grow ${growsRunning}/${growsWanted}├`);
    const weakenStr = pad(Array(18).join('─'), `┤Weaken ${weakensRunning}/${weakensWanted}`, true);

    let line1 = `╭─┤`;
    line1 += pad(Array(17).join('─'), server.name + '├');
    line1 += pad(Array(17).join('─'), '┤ ' + moneyStr, true) + ' ├─';
    line1 += '┤' + secStr + `├─╮`;

    let line2 = `╰─┤${hackStr}${growStr}${weakenStr}├─╯`;
    let line3 = '';

    return [line1, line2, line3];
}

export function printfServer(server, ns) {
    // Maybe try a narrower but higher format this time, just for visual distinction.
    // length 24?
    let lines = new Array(5);

    let servername = pad(Array(20).join('─'), `┤${server.name}├`);
    lines[0] = `╭─${servername       }─╮`;
    lines[1] = `| 000 Gb               │`;
    lines[2] = `|                      │`;
    lines[3] = `|                      │`;
    lines[4] = `╰                     ╯`;
    ns.nFormat('');
    return lines;
}

function scan(ns, parent, server, list) {
    const children = ns.scan(server);
    for (let child of children) {
        if (parent == child) {
            continue;
        }
        list.push(child);

        scan(ns, server, child, list);
    }
}

/**
 * Get a list of all server names.
 *
 * @export
 * @param {import(".").NS } ns
 * @return {string[]}
 */
export function getServerNames(ns) {
    const list = [];
    scan(ns, '', 'home', list);
    return list;
}

/**
 * Return some basic info about all servers we can reach
 * @param {Object.<string, Server>} servers - a set of current servers to update. {} is acceptable and will be populated..
 * @param {import(".").NS } ns
 * @returns {Object.<string, Server>} a set of all reachable servers.
 **/
export function getAllServerInfo(servers, ns) {
    if (servers['home']) servers['home'].update(ns);
    else servers['home'] = new Server('home', ns);

    let foundServers = getServerNames(ns);
    for (const servername of foundServers) {
        if (servers[servername]) servers[servername].update(ns);
        else servers[servername] = new Server(servername, ns);
    }
    return servers;
}

/** @param {import(".").NS } ns */
export function getProgramCount(ns) {
    let count = 0;
    if (ns.fileExists('BruteSSH.exe', 'home')) count++;
    if (ns.fileExists('FTPCrack.exe', 'home')) count++;
    if (ns.fileExists('relaySMTP.exe', 'home')) count++;
    if (ns.fileExists('HTTPWorm.exe', 'home')) count++;
    if (ns.fileExists('SQLInject.exe', 'home')) count++;

    return count;
}

/** @param {import(".").NS } ns */
export function root(target, ns) {
    let exploits = getProgramCount(ns);
    let needed = ns.getServerNumPortsRequired(target);
    if (exploits >= needed) {
        if (ns.fileExists('BruteSSH.exe', 'home')) ns.brutessh(target);
        if (ns.fileExists('FTPCrack.exe', 'home')) ns.ftpcrack(target);
        if (ns.fileExists('relaySMTP.exe', 'home')) ns.relaysmtp(target);
        if (ns.fileExists('HTTPWorm.exe', 'home')) ns.httpworm(target);
        if (ns.fileExists('SQLInject.exe', 'home')) ns.sqlinject(target);
        ns.nuke(target);
        return 1;
    }
    return 0;
}

/** @param {import(".").NS } ns */
export function stopscript(servers, script, ns) {
    for (const servername in servers) {
        ns.scriptKill(script, servername);
    }
}

export function print3Up(displayData, ns) {
    // Two-Column. Assumes everything is pretty uniform. And pretty narrow.
    let n = 3;
    while (displayData.length >= n) {
        let columns = Array(n).map(() => displayData.pop());
        for (let rowNum = 0; rowNum < columns[0].length; rowNum++) {
            let line = '';
            for (let colNum = 0; colNum < columns.length; colNum++) {
                if (colNum > 0) line += '  ';
                line += columns[colNum];
            }
            ns.print(line);
        }
    }
    if (displayData.length > 0) {
        print2Up(displayData, ns);
    }
}

export function print2Up(displayData, ns) {
    // Two-Column. Assumes everything is pretty uniform.
    while (displayData.length >= 2) {
        let col1Lines = displayData.pop();
        let col2Lines = displayData.pop();
        for (let i = 0; i < col1Lines.length; i++) {
            let col1 = col1Lines[i];
            let col2 = col2Lines[i];
            ns.print(col1 + '   ' + col2);
        }
    }
    if (displayData.length > 0) {
        print1Up(displayData, ns);
    }
}

export function print1Up(displayData, ns) {
    for (const data of displayData) {
        for (const line of data) {
            ns.print(line);
        }
    }
}
