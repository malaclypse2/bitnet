/**
 * Command and control.
 *
 * This is the user interface to start, stop, and control all of the
 * other subsystems.
 *
 * alias net='run /scripts/net.js'
 *
 * The idea is to run, do our thing, then exit.
 * Don't stay resident longer than needed.
 * Try not to use more ram than needed.
 *
 * Examples I'd like to handle:
 *
 * (Done)
 * net start
 * net stop
 * net status
 *
 * (TODO)
 * net hack add target
 * net hack drop target
 * net monitor short
 * net monitor Targets2Up
 * net buy server
 * net buy hacknet
 * net upgrade servers
 * net backdoor
 *
 */
const c2_port = 2;

// eslint-disable-next-line no-unused-vars
import { C2Command, C2Message } from '/scripts/bit-types.js';

export class SubSystem {
    /**
     * @param {string} name - The human readable name of this subsystem
     * @param {string} filename - The script name that starts this subsystem
     */
    constructor(name, filename, host) {
        this.name = name;
        this.filename = filename;
        this.host = host;
        this.status = 'UNKNOWN';
        /** @type {import("/scripts/index.js").ProcessInfo} */
        this.process = {};
        /** @type {import("/scripts/index.js").RunningScript} */
        this.scriptInfo = {};
    } // end constructor()

    /**
     *
     * @param {import("/scripts/index.js").NS} ns
     */
    refreshStatus(ns) {
        let ps = ns.ps(this.host);
        this.status = 'STOPPED';
        for (const process of ps) {
            let isSystemScript = this.filename === process.filename;
            let hasStart = process.args.includes('--start');
            if (isSystemScript && hasStart) {
                this.status = 'RUNNING';
                this.process = process;
                this.scriptInfo = ns.getRunningScript(this.filename, this.host, ...process.args);
                break;
            }
        }
    } // end refreshStatus()
}

export const subsystems = [
    new SubSystem('net-hack', '/scripts/net-hack.js', 'home'),
    new SubSystem('net-monitor', '/scripts/net-monitor.js', 'home'),
];

/**
 * @param {import(".").NS } ns
 */
export async function main(ns) {
    // arg parsing
    let args = ns.flags([['help', false]]);
    let host = ns.getHostname();

    // Make sure our subsystem status is set up.
    for (const sys of subsystems) {
        sys.refreshStatus(ns);
    }

    let handlers = {
        start: runStartCommand,
        stop: runStopCommand,
        restart: runRestartCommand,
        status: runStatusCommand,
        hack: runHackCommand,
        monitor: runMonitorCommand,
    };
    // command aliases
    if (args._.length > 0) {
        if (args._[0] === 'mon') args._[0] = 'monitor';
    }    

    // Process command line
    if (args._.length > 0) {
        let command = args._.shift();
        // Call one of the subsystems.
        if (handlers[command]) {
            await handlers[command](host, args, ns);
        } else {
            ns.tprint(`I don't know how to handle the command '${command}'`);
        }
    } else {
        if (args.help) {
            let msg = `	This is the command and control program. Try one of the following:
            net start - start persistent servers
            net stop - stop persistent servers
            net restart - stop then start persistent servers
            net monitor --help
            `;
            ns.tprint(msg);
        }
    }
}

/**
 * Start all persistent processes.
 *
 * For the moment:
 * /scripts/net-hack.js --start
 * /scripts/net-monitor.js --start
 *
 * @param {string} host - the host to run against
 * @param {*} args - flags passed in from the command line.
 * @param {import(".").NS} ns
 */
async function runStartCommand(host, args, ns) {
    ns.exec('/scripts/net-hack.js', host, 1, '--start');
    if (host !== ns.getHostname()) {
        ns.exec('/scripts/net-monitor.js', host, 1, '--start');
    } else {
        ns.spawn('/scripts/net-monitor.js', 1, '--start');
    }
}

/**
 * Stop all persistent processes on this host
 * .
 * All of our long running stuff should be named net-*, and should
 * have been started using --start flags.
 *
 * @param {string} host - the host to run against
 * @param {*} args - flags passed in from the command line.
 * @param {import(".").NS} ns
 */
async function runStopCommand(host, args, ns) {
    ns.tprint(`Killing running subsystems`);
    for (const sys of subsystems) {
        if (sys.status === 'RUNNING') {
            let process = sys.process;
            let isThisScript =
                process.filename === ns.getScriptName() && process.args === ns.args && host === ns.getHostname();
            if (!isThisScript) {
                ns.tprint(`... Killing ${process.filename} ${process.args.join(' ')}`);
                ns.kill(process.filename, host, ...process.args);
            }
            sys.refreshStatus(ns);
        }
    }
}

/**
 * Stop then Start all persistent processes.
 *
 * @param {string} host - the host to run against
 * @param {*} args - flags passed in from the command line.
 * @param {import(".").NS} ns
 */
async function runRestartCommand(host, args, ns) {
    await runStopCommand(host, args, ns);
    await ns.asleep(100);
    await runStartCommand(host, args, ns);
}

/**
 * Do something with the hacking subsystem
 * 
 * @param {string} host - the host to run against
 * @param {*} args - flags passed in from the command line.
 * @param {import(".").NS} ns
 */
async function runHackCommand(host, args, ns) {}

/**
 * Do something with the monitoring subsystem
 * 
 * @param {string} host - the host to run against
 * @param {*} args - flags passed in from the command line.
 * @param {import('/scripts/index.js').NS} ns
 */
async function runMonitorCommand(host, args, ns) {
    if (args.help) {
        let msg = `monitor commands. net monitor [DisplayType] to change the running display type. Will also try to open the tail window.`
        ns.tprint(msg);
    } else if (args._.length > 0) {
        // See if we can find a tail window to open
        let mon = subsystems.find( (sys) => sys.name = 'net-mon');
        if (mon.status !== 'RUNNING') {
            ns.exec('/scripts/net-monitor.js', host, 1, '--start');
        }
        mon.refreshStatus(ns);
        if (mon.status === 'RUNNING') {
            ns.tail(mon.filename, mon.host, ...mon.args);
        }
        // Broadcast to the monitor app.
        let display = args._.shift();
        let cmd = new C2Command('net-mon', 'net', 'set', 'display', display, ns);
        sendC2message(cmd, ns);
    }
}

/**
 * Print out something about the system status.
 * @param {string} host - the host to run against
 * @param {*} args - flags passed in from the command line.
 * @param {import("/scripts/index.js").NS} ns
 */
async function runStatusCommand(host, args, ns) {
    ns.tprint(`Getting system status: `);
    // Check each subsystem.
    for (const system of subsystems) {
        let money = ns.nFormat(system.scriptInfo.onlineMoneyMade, '$0.00a');
        let duration = ns.tFormat(system.scriptInfo.onlineRunningTime * 1000);
        ns.tprint(`... ${system.name}: ${system.status}.`);
        ns.tprint(`...    ${money}; Running ${duration}`);
    }
    ns.tprint(``);
    // Some summary info, too
}

/**
 * Send a C2 message. If the queue is full, drops whatever falls off.
 * @param {C2Command} msg
 * @param {import("/scripts/index.js").NS} ns
 */
export function sendC2message(msg, ns) {
    ns.writePort(c2_port, msg);
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
export function readC2messages(system, ns) {
    let allmsgs = [];
    let inbox = [];
    // Get everything from the queue
    /** @type {C2Message} */
    let msg = ns.readPort(c2_port);
    while (msg !== 'NULL PORT DATA') {
        allmsgs.push(msg);
        msg = ns.readPort(2);
    }
    // Figure out which messages we shouyld keep
    while (allmsgs.length > 0) {
        msg = allmsgs.pop();
        if (msg.type === 'C2Message' && msg.to === system) {
            inbox.push(msg);
        } else {
            let expiryTime = ns.getTimeSinceLastAug() - 90 * 1000;
            if (msg.createtime < expiryTime) {
                sendC2message(msg, ns);
            }
        }
    }
    return inbox;
}
