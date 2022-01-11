import { Server } from '/scripts/classes/Server.js';
/**@typedef{import('/scripts/index.js').NS} NS */

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint('No user servicable parts inside.');

    ns.tprint('getPlayerInfo:');
    let playerInfo = getPlayerInfo(ns);
    ns.tprint(JSON.stringify(playerInfo));

    ns.tprint("new Server('n00dles')");
    ns.tprint(JSON.stringify(new Server('n00dles', ns)));

    ns.tprint('getAllServerInfo:');
    let servers = getAllServerObjects({}, ns);
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

    const hacksRunning = ns.nFormat(server.targetedBy.hack, '0a');
    const growsRunning = ns.nFormat(server.targetedBy.grow, '0a');
    const weakensRunning = ns.nFormat(server.targetedBy.weaken, '0a');

    const hackStr = pad(Array(16).join('─'), `Hack ${hacksRunning}├`);
    const growStr = pad(Array(17).join('─'), `┤Grow ${growsRunning}├`);
    const weakenStr = pad(Array(18).join('─'), `┤Weaken ${weakensRunning}`, true);

    let line1 = `┌─┤`;
    line1 += pad(Array(17).join('─'), server.name + '├');
    line1 += pad(Array(17).join('─'), '┤ ' + moneyStr, true) + ' ├─';
    line1 += '┤' + secStr + `├─┐`;

    let line2 = `└─┤${hackStr}${growStr}${weakenStr}├─┘`;
    let line3 = '';

    return [line1, line2, line3];
}
// prettier-ignore
/**
 * Given an array of lines, draw a box around them. Optionally, give it a title
 * @param {string[]} lines - and array of lines to bound in a box
 * @param {string} title - optional. title for the box.
 * @param {number} width - trim lines to a maximum of this width.
 * @param {boolean} top - add the top line?
 * @param {boolean} bottom - add the bottom line?
 * @param {boolean} left - add the left line?
 * @param {boolean} right - add the right line?
 * @returns {string[]}
 * 
 */
export function boxdraw(lines, title='', width=0, top=true, bottom=true, left=true, right = true) {
    // linedrawingchars = '─ │ ┌ ┐ └ ┘ ├ ┬ ┤ ┴ ';
    let maxlen = width;
    if (width==0) {
        maxlen = Math.max(...lines.map((l) => l.length) );
    } 
    if (title !== '') title = pad(Array(maxlen+3).join('─'), '┤'+title+'├');
    else title = Array(maxlen+3).join('─'); 
    let bline = Array(maxlen+3).join('─');

    let topline = `┌${title}┐`;
    let bottomline = `└${bline}┘`
    // pad out the lines to the right width
    lines = lines.map((line) => pad(Array(maxlen+1).join(' '), line));
    if (left) lines = lines.map((line) => '│ ' + line)
    if (right) lines = lines.map((line) => line + ' │')
    if (top) lines.unshift(topline);
    if(bottom) lines.push(bottomline);

    return lines;
}

export function percentToGraph(pct, graph='     '){
    const progressSteps = '▏▎▍▌▋▊▉█';
    let progressbar = Array.from(graph);
    let filled = Math.floor(pct * progressbar.length);
    for (let i = 0; i < filled; i++) {
        progressbar[i] = progressSteps[progressSteps.length - 1];
    }
    let pctleft = (pct * progressbar.length) - filled;
    let whichbar = Math.round(pctleft * progressSteps.length);
    progressbar[filled] = progressSteps[whichbar];
    progressbar = progressbar.join('');
    return progressbar;
}

// prettier-ignore
export function printfServer(server, ns) {
    // Maybe try a narrower but higher format this time, just for visual distinction.
    // length 24?
    let lines = new Array(5);

    let servername = pad(Array(20+1).join('─'), `┤${server.name}├`);

    // linedrawingchars = '─ │ ┌ ┐ └ ┘ ├ ┬ ┤ ┴ ';
    lines[0] = `┌─${servername       }─┐`;
    lines[1] = `│                      │`;
    lines[2] = `│                      │`;
    lines[3] = `│                      │`;
    lines[4] = `└──────────────────────┘`;
    // lines[0] = `╭───╮`;
    // lines[1] = `│   │`;
    // lines[2] = `│   │`;
    // lines[3] = `│   │`;
    // lines[4] = `╰───╯`;
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

/** Get a list of all server names.
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
export function getAllServerObjects(servers, ns) {
    if (servers['home']) servers['home'].update(ns);
    else servers['home'] = new Server('home', ns);

    let foundServers = getServerNames(ns);
    for (const servername of foundServers) {
        if (servers[servername]) servers[servername].update(ns);
        else servers[servername] = new Server(servername, ns);
    }
    return servers;
}

/**
 * Update the attack status (server.running, server.desired, server.targetedBy).
 * @param {Server[]|Object.<string,Server>} servers - All servers
 * @param {NS} ns
 */
export function updateAttackStatus(_servers, ns) {
    // We have a mix of Arrays and servername-keyed Objects in my codebase. Ought to convert to all Arrays, but I haven't paid the technical debt yet.
    let servers = Object.values(_servers);

    // Server.running and Server.targetedBy need to know what's running on all the servers.
    let isHackProcess = (proc) =>
        proc.filename.includes('hack') && proc.args.length > 0 && servers.some((s) => s.name === proc.args[0]);
    let isWeakenProcess = (proc) =>
        proc.filename.includes('weak') && proc.args.length > 0 && servers.some((s) => s.name === proc.args[0]);
    let isGrowProcess = (proc) =>
        proc.filename.includes('grow') && proc.args.length > 0 && servers.some((s) => s.name === proc.args[0]);
    for (const server of servers) {
        server.running = { grow: 0, hack: 0, weaken: 0 };
        server.targetedBy = { grow: 0, hack: 0, weaken: 0 };
        let ps = ns.ps(server.name);
        for (const proc of ps) {
            let procType = 'unknown';
            if (isHackProcess(proc)) procType = 'hack';
            if (isWeakenProcess(proc)) procType = 'weaken';
            if (isGrowProcess(proc)) procType = 'grow';
            if (procType !== 'unknown') {
                // Update the source and target of these threads.
                server.running[procType] += proc.threads;
                servers.find((s) => s.name === proc.args[0]).targetedBy[procType] += proc.threads;
            }
        }
    }
    // Do we care about the server.desired stats anymore? SKip for now.
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

/**
 *
 * @param {*[]} items
 * @param {number} n
 * @returns {*[][]}
 */
function splitNWays(items, n) {
    let columns = [];
    n = Math.min(n, items.length);
    // split into n columns
    let splitpoint = Math.ceil(items.length / n);
    for (let i = 0; i < n; i++) {
        let from = i * splitpoint;
        let to = (i + 1) * splitpoint;
        columns.push(items.slice(from, to));
    }
    return columns;
}

/**
 *  Print an Array of items, where each item is an Array of strings. Typically each item is a narrow multiline status report about a server.
 * @param {string[][]} items - A list of items to print.
 * @param {number} n - number of columns to print in
 * @param {Function} printfn - what print function to use. Typically ns.print or ns.tprint.
 */
export function printItemsNColumns(items, n, printfn) {
    if (items.length === 0) return;
    /** @type{string[][][]} */
    let columns = splitNWays(items, n);

    // Now columns[0] is is a list of items to print in column 0, etc.
    // Since we want to print by rows, let's transpose the array
    let rows = columns[0].map((_, colIndex) => columns.map((row) => row[colIndex]));
    for (const row of rows) {
        // row is now an Array of n items, with each item being an Array of strings to print.
        for (let i = 0; i < row[0].length; i++) {
            let line = row.map((item) => {
                if (item && item.length > i) return item[i];
                else return '';
            });
            // line is now an Array of strings, which just need to be joined and printed.
            printfn(line.join('   '));
        }
    }
}

/**
 *  Print an Array of strings in N columns.
 * @param {string[]} lines - An array of items to print.
 * @param {number} n - number of columns to print in
 * @param {Function} printfn - what print function to use. Typically ns.print or ns.tprint.
 */
export function printLinesNColumns(lines, n, printfn) {
    let columns = splitNWays(lines, n);

    // Now columns[0] is an array of the lines to print in column[0], etc.
    // Since we want to print by rows, let's transpose the array
    let rows = columns[0].map((_, colIndex) => columns.map((row) => row[colIndex]));
    for (const row of rows) {
        // row is now an array of strings to prints in this row
        printfn(row.join('   '));
    }
}

/**
 * @param {Object.<string,Server>} servers
 * @param {import('/scripts/index.js').NS} ns */
export function getPoolFromServers(servers, ns) {
    const _DEBUG = false;
    let pool = { free: 0, grow: 0, hack: 0, weaken: 0, running: 0 };
    let s = Array.from(Object.values(servers));

    pool.free = s.reduce((sum, server) => sum + server.slots, 0);
    pool.hack = s.reduce((sum, server) => sum + server.running.hack, 0);
    pool.grow = s.reduce((sum, server) => sum + server.running.grow, 0);
    pool.weaken = s.reduce((sum, server) => sum + server.running.weaken, 0);
    pool.running += pool.grow + pool.hack + pool.weaken;
    if (_DEBUG) {
        ns.tprint(`Calculating pool as: ${JSON.stringify(pool)}.`);
    }
    return pool;
}
