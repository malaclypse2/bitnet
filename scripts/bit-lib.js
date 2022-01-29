/**@typedef{import('/scripts/index.js').NS} NS */

// --- EXPORTED CONSTANTS ---
export const worker_size = 2.0; // 1.75 is probably more acurate, but this gives some grace for inefficient scripts.
export const c2_port = 2;
export class SubSystem {
    /**
     * @param {string} name - The human readable name of this subsystem
     * @param {string} filename - The script name that starts this subsystem
     * @param {string} host - The host the subsystem should be running on
     * @param {string|number[]} defaultargs - default arguments if we want to start / restart this subsystem.
     * @param {boolean} shouldTail - Is the tail file of this subsystem useful?
     */
    constructor(name, filename, host, defaultargs = [], shouldTail = false) {
        this.name = name;
        this.filename = filename;
        this.host = host;
        this.shouldTail = shouldTail;
        this.defaultargs = defaultargs;
        this.status = 'UNKNOWN';
        this.lastSeenRunning = 0;
        /** @type {import("/scripts/index.js").ProcessInfo} */
        this.process = {};
        /** @type {import("/scripts/index.js").RunningScript} */
        this.scriptInfo = {};
    } // end constructor()

    /**
     * @param {import("/scripts/index.js").NS} ns
     */
    refreshStatus(ns) {
        let ps = ns.ps(this.host);
        ps.reverse();
        this.status = 'STOPPED';
        for (const process of ps) {
            let isSystemScript = this.filename === process.filename;
            if (isSystemScript) {
                this.status = 'RUNNING';
                this.lastSeenRunning = Date.now();
                this.process = process;
                this.scriptInfo = ns.getRunningScript(this.filename, this.host, ...process.args);
                break;
            }
        }
    } // end refreshStatus()
}

export const subsystems = [
    //new SubSystem('net-hack', '/scripts/net-hack.js', 'home'),
    new SubSystem('daemon', 'daemon.js', 'home', ['-s', '--cycle-timing-delay', 400, '--share-max-utilization', 0.8], true),
    new SubSystem('net-monitor', '/scripts/net-monitor.js', 'home', ['--start'], false),
    new SubSystem('stats', 'stats.js', 'home'),
    new SubSystem('hacknet-manager', 'hacknet-upgrade-manager.js', 'home', [], false),
    new SubSystem('stockmaster', 'stockmaster.js', 'home', [], true),
    new SubSystem('stockticker', '/Temp/stockmarket-summary-tail.js', 'home', [], true),
    new SubSystem('gangs', 'gangs.js', 'home', [], true),
    new SubSystem('spend-hacknet-hashes', 'spend-hacknet-hashes.js', 'home', [], true),
    new SubSystem('sleeve', 'sleeve.js', 'home', [], true),
    new SubSystem('work', 'work-for-factions.js', 'home', [], true),
    new SubSystem('host-manager', 'host-manager.js', 'home', ['-c', '--utilization-trigger', 0.7, '--reserve-by-time'], true),
];

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

// --- UTILITY FUNCTIONS ---
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
 * @param {NS} ns
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

/**
 *
 * @param {Server} server
 * @param {NS} ns
 * @returns {string}[]
 */
export function printfSeverAsTarget(server, ns) {
    // Try to keep it to two or three lines per server, or it will never fit in a log window, even with just a few targets
    const moneyCur = ns.nFormat(server.currentMoney, '$0.0a');
    const moneyPercent = pad('   ', ns.nFormat((100 * server.currentMoney) / server.maxMoney, '0'), true) + '%';
    const moneyStr = `${moneyCur} (${moneyPercent})`;

    const secBase = pad('  ', ns.nFormat(server.securityBase, '0'), true);
    const secIncr = pad('    ', ns.nFormat(server.securityCurrent - server.securityBase, '0.00'));
    const secStr = `Sec ${secBase} +${secIncr}`;

    const hacksRunning = ns.nFormat(server.targetedBy.hack, '0a');
    const growsRunning = ns.nFormat(server.targetedBy.grow, '0a');
    const weakensRunning = ns.nFormat(server.targetedBy.weaken, '0a');
    let hackFactor = server.hackFactor;
    if (ns.ls('home', 'Formulas.exe').length > 0)
        hackFactor = ns.formulas.hacking.hackPercent(ns.getServer(server.name), ns.getPlayer());
    const amountToBeStolen = hackFactor * server.targetedBy.hack * server.maxMoney;
    let stealing = '';
    if (amountToBeStolen > 0) {
        stealing = ns.nFormat(amountToBeStolen, '$0.0a');
        stealing = ' (' + stealing + ')';
    }

    const hackStr = pad(Array(25).join('─'), `Hack ${hacksRunning}${stealing}├`);
    const growStr = pad(Array(12).join('─'), `┤Grow ${growsRunning}├`);
    const weakenStr = pad(Array(14).join('─'), `┤Weaken ${weakensRunning}`, true);

    let line1 = `┌┤`;
    line1 += pad(Array(17).join('─'), server.name + '├');
    line1 += pad(Array(17).join('─'), '┤ ' + moneyStr, true) + ' ├─';
    line1 += '┤' + secStr + `├┐`;

    let line2 = `└┤${hackStr}${growStr}${weakenStr}├┘`;
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
export function boxdraw(lines, title='', width=0, wrap=false, titleright= false, top=true, bottom=true, left=true, right = true) {
    // linedrawingchars = '─ │ ┌ ┐ └ ┘ ├ ┬ ┤ ┴ ';
    let maxlen = width;
    if (width==0) {
        maxlen = Math.max(...lines.map((l) => l.length) );
    } 
    if (title !== '') title = pad(Array(maxlen+3).join('─'), '┤'+title+'├', titleright);
    else title = Array(maxlen+3).join('─'); 
    let bline = Array(maxlen+3).join('─');

    let topline = `┌${title}┐`;
    let bottomline = `└${bline}┘`
    // wrap if we need to
    if (wrap) {
        lines = lines.map((l)=>wordwrap(l, maxlen)).flat();
    }
    // pad out the lines to the right width
    lines = lines.map((line) => pad(Array(maxlen+1).join(' '), line));
    if (left) lines = lines.map((line) => '│ ' + line)
    if (right) lines = lines.map((line) => line + ' │')
    if (top) lines.unshift(topline);
    if(bottom) lines.push(bottomline);

    return lines;
}

export function percentToGraph(pct, graph = '     ', cap = '▏') {
    // These work better in more fonts, but I don't like them as well.
    // If we enable these, we need to change the default cap too.
    // const progressSteps = '░▒▓█';

    // These look best in Fira Mono
    const progressSteps = '▏▎▍▌▋▊▉█';

    let progressbar = Array.from(graph);
    let filled = Math.floor(pct * progressbar.length);
    for (let i = 0; i <= filled; i++) {
        progressbar[i] = progressSteps[progressSteps.length - 1];
    }
    let pctleft = pct * progressbar.length - filled;
    let whichbar = Math.floor(pctleft * progressSteps.length);
    progressbar[filled] = progressSteps[whichbar];
    progressbar = progressbar.join('');
    progressbar += cap;
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
 * @param {NS} ns
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
    // Reset our counts.
    for (const server of servers) {
        server.running = new Threadcount();
        server.targetedBy = new Threadcount();
    }

    // Server.running and Server.targetedBy need to know what's running on all the servers.
    let isHackProcess = (proc) =>
        proc.filename.includes('hack') && proc.args.length > 0 && servers.some((s) => s.name === proc.args[0]);
    let isWeakenProcess = (proc) =>
        proc.filename.includes('weak') && proc.args.length > 0 && servers.some((s) => s.name === proc.args[0]);
    let isGrowProcess = (proc) =>
        proc.filename.includes('grow') && proc.args.length > 0 && servers.some((s) => s.name === proc.args[0]);
    let isShareProcess = (proc) => proc.filename.includes('share');
    let serversToRemove = [];
    for (const server of servers) {
        try {
            ns.getServer(server.name);
        } catch {
            // Can we remove keys while iterating over the object safely? Better just collect the servers to remove and do it at the end.
            serversToRemove.push(server)
            continue;
        }
        let ps = ns.ps(server.name);
        for (const proc of ps) {
            let procType = 'unknown';
            if (isHackProcess(proc)) procType = 'hack';
            if (isWeakenProcess(proc)) procType = 'weaken';
            if (isGrowProcess(proc)) procType = 'grow';
            if (isShareProcess(proc)) procType = 'share';
            if (procType !== 'unknown') {
                // Update the source and target of these threads.
                server.running[procType] += proc.threads;
                let target = servers.find((s) => s.name === proc.args[0]);
                if (target) {
                    target.targetedBy[procType] += proc.threads;
                    target.lastTimeSeenTargetedBy[procType] = Date.now();
                }
            }
        }
    }
    for (const server of serversToRemove) {
        delete servers[server];
    }
    // Do we care about the server.desired stats anymore? SKip for now.
}

/** @param {NS} ns */
export function getProgramCount(ns) {
    let count = 0;
    if (ns.fileExists('BruteSSH.exe', 'home')) count++;
    if (ns.fileExists('FTPCrack.exe', 'home')) count++;
    if (ns.fileExists('relaySMTP.exe', 'home')) count++;
    if (ns.fileExists('HTTPWorm.exe', 'home')) count++;
    if (ns.fileExists('SQLInject.exe', 'home')) count++;

    return count;
}

/** @param {NS} ns */
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

/** @param {NS} ns */
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
    if (items.length === 1 && items[0].length === 0) return;
    /** @type{string[][][]} */
    let columns = splitNWays(items, n);

    // Now columns[0] is is a list of items to print in column 0, etc.
    // Since we want to print by rows, let's transpose the array
    let rows = columns[0].map((_, colIndex) => columns.map((row) => row[colIndex]));
    for (const row of rows) {
        // row is now an Array of n items, with each item being an Array of strings to print.
        let numrows = 0;
        try {
            numrows = Math.max(...row.map((item) => item.length));
        } catch {
            /*pass*/
        }
        for (let i = 0; i < numrows; i++) {
            let line = row.map((item) => {
                if (item && item.length > i) return item[i];
                else return Array(item[0].length + 1).join(' ');
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
 * @param {NS} ns */
export function getPoolFromServers(servers, ns) {
    const _DEBUG = false;
    let pool = { free: 0, grow: 0, hack: 0, weaken: 0, share: 0, running: 0 };
    let s = Array.from(Object.values(servers));

    pool.free = s.reduce((sum, server) => sum + server.slots, 0);
    pool.hack = s.reduce((sum, server) => sum + server.running.hack, 0);
    pool.grow = s.reduce((sum, server) => sum + server.running.grow, 0);
    pool.weaken = s.reduce((sum, server) => sum + server.running.weaken, 0);
    pool.share = s.reduce((sum, server) => sum + server.running.share, 0);
    pool.running += pool.grow + pool.hack + pool.weaken + pool.share;
    if (_DEBUG) {
        ns.tprint(`Calculating pool as: ${JSON.stringify(pool)}.`);
    }
    return pool;
}

export class C2Message {
    /**
     * @param {string} from
     * @param {string} to
     * @param {string} action
     * @param {string} key
     * @param {*} value
     * @param {import("/scripts/index.js").NS} ns
     */
    constructor(to, from, action, key, value, ns) {
        this.type = 'C2Message';
        this.subtype = '';
        this.to = to;
        this.from = from;
        this.action = action;
        this.key = key;
        this.value = value;
        if (ns) this.createtime = Date.now();
        else this.createtime = 0;
    }
    static fromObject(obj) {
        if (obj.type === 'C2Message') {
            let message;
            if (obj.subtype === 'C2Command') {
                message = new C2Command();
            } else if (obj.subtype === 'C2Response') {
                message = new C2Response();
            } else {
                message = new C2Message();
            }
            message = Object.assign(message, obj);
            return message;
        }
    }
}

export class C2Command extends C2Message {
    constructor(to, from, action, key, value, ns) {
        super(to, from, action, key, value, ns);
        this.subtype = 'C2Command';
    }
}

export class C2Response extends C2Message {
    constructor(to, from, action, key, value, ns) {
        super(to, from, action, key, value, ns);
        this.subtype = 'C2Response';
    }
}

/**
 * @export
 * @class Server
 */
export const PurchasedServerNames = [
    'Alpha(α)',
    'Beta(β)',
    'Gamma(γ)',
    'Delta(Δ)',
    'Epsilon(ε)',
    'Zeta(ζ)',
    'Eta(η)',
    'Theta(θ)',
    'Iota(ι)',
    'Kappa(κ)',
    'Lambda(λ)',
    'Mu(μ)',
    'Nu(ν)',
    'Xi(ξ)',
    'Omicron(ο)',
    'Pi(π)',
    'Rho(ρ)',
    'Sigma(σ)',
    'Tau(τ)',
    'Upsilon(υ)',
    'Phi(φ)',
    'Chi(χ)',
    'Psi(Ψ)',
    'Omega(Ω)',
    'Infinity(∞)',
    'daemon',
    'Corp(©)',
];

class Threadcount {
    constructor(hack = 0, grow = 0, weaken = 0, share = 0) {
        this.hack = hack;
        this.grow = grow;
        this.weaken = weaken;
        this.share = share;
    }
    get total() {
        return this.hack + this.grow + this.weaken + this.share;
    }
}

export class Server {
    /**
     * Creates an instance of Server.
     * @param {string} servername
     * @param {NS} ns
     * @memberof Server
     */
    constructor(servername, ns) {
        this.name = servername;
        this.update(ns);
        this.running = new Threadcount();
        this.targetedBy = new Threadcount();
        this.lastTimeSeenTargetedBy = new Threadcount();
        this.desired = new Threadcount();
        this.isPurchasedServer = false;
        // Let's not actually call ns.getPurchasedServers. That's expensive! Just check for our common server names.
        let basename = this.name.split('-')[0];
        if (PurchasedServerNames.includes(basename)) {
            this.isPurchasedServer = true;
        }
        this.symbol = this.name[0];

        let left = this.name.indexOf('(');
        let right = this.name.lastIndexOf(')');
        if (left !== -1 && right !== -1) {
            this.symbol = this.name.substring(left + 1, right);
        }
    }
    /** @param {NS} ns */
    update(ns) {
        let servername = this.name;
        this.ram = ns.getServerMaxRam(servername);
        this.cores = ns.getServer(servername).cpuCores;
        // Try to leave an extra 10% free on home
        this.freeRam = this.ram - ns.getServerUsedRam(servername);
        this.rooted = ns.hasRootAccess(servername);
        this.slots = 0;
        if (this.rooted) {
            this.slots = Math.floor(this.freeRam / worker_size);
        }
        this.maxMoney = ns.getServerMaxMoney(servername);
        this.currentMoney = ns.getServerMoneyAvailable(servername);
        this.hackFactor = ns.hackAnalyze(servername);
        this.hackTime = ns.getHackTime(servername);
        this.growTime = ns.getGrowTime(servername);
        this.weakenTime = ns.getWeakenTime(servername);
        this.securityBase = ns.getServerMinSecurityLevel(servername);
        this.securityCurrent = ns.getServerSecurityLevel(servername);
        this.levelRequired = ns.getServerRequiredHackingLevel(servername);
    }
}
/**
 * Wrap a string, returning an array of strings, wrapped to the specified length..
 * @param {string} long_string
 * @param {number} max_char
 * @returns {string[]}
 */
export function wordwrap(long_string, max_char) {
    let words = long_string.split(' ');
    let lines = [];
    let line = '';
    while (words.length > 0) {
        let word = words.shift();
        if (line.length + 1 + word.length > max_char) {
            // See if there's a hyphen in the word, and if we could split it there to fit.
            let splitword = word.split('-');
            for (let i = splitword.length; i > 0; i--) {
                let partial = splitword.slice(0, i).join('-') + '-';
                let remainder = splitword.slice(i).join('-');
                if (line.length + 1 + partial.length <= max_char) {
                    // This partial word fits!
                    line += ' ' + partial;
                    word = remainder;
                    continue;
                }
            }
            lines.push(line);
            line = '';
        }
        if (line === '') line = word;
        else line += ' ' + word;
    }
    if (line.length > 0) lines.push(line);
    return lines;
}

/**
 * Empty the C2 queue, looking for our messages. Then put
 * all the messages back on the queue, unless they're more
 * than 90 seconds old. Throw away the old ones.
 *
 * @param {string} system - Get messages addressed to this system
 * @param {import("/scripts/index.js").NS} ns
 * @returns {C2Message[]}
 */

export async function readC2messages(system, ns) {
    let allmsgs = [];
    let inbox = [];
    // Get everything from the queue
    /** @type {C2Message} */
    let msg = ns.readPort(c2_port);
    while (msg !== 'NULL PORT DATA') {
        allmsgs.push(msg);
        msg = ns.readPort(2);
    }
    // Figure out which messages we should keep
    while (allmsgs.length > 0) {
        msg = allmsgs.pop();
        msg = JSON.parse(msg);
        msg = C2Message.fromObject(msg);
        if (msg instanceof C2Message && msg.to === system) {
            inbox.push(msg);
            // ns.tprint(`C2 Message recieved for '${system}': ${JSON.stringify(msg)}`);
        } else {
            let expiryTime = Date.now() - 90 * 1000;
            if (msg.createtime > expiryTime) {
                await sendC2message(msg, ns);
            }
        }
    }
    return inbox;
}

/**
 * Send a C2 message. If the queue is full, drops whatever falls off.
 * @param {C2Command} msg
 * @param {import("/scripts/index.js").NS} ns
 */
export async function sendC2message(msg, ns) {
    let s = JSON.stringify(msg);
    await ns.writePort(c2_port, s);
    // ns.tprint(`C2 Message sent: ${s}`);
}
