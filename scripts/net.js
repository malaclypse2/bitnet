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
 * net hack add target
 * net hack drop target
 * net monitor short
 * net monitor Targets2Up
 * (TODO)
 * net servers list
 * net servers buy
 * net servers upgrade
 * net hacknet buy
 * net backdoor
 *
 */
const c2_port = 2;

import { SubSystem } from '/scripts/classes/SubSystem.js';
import { C2Command, C2Message } from '/scripts/classes/C2Message.js';

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
        //        start: runStartCommand,
        //        stop: runStopCommand,
        //        restart: runRestartCommand,
        status: runStatusCommand,
        hack: runHackCommand,
        monitor: runMonitorCommand,
        servers: runServersCommand,
        backdoor: runBackdoorCommand,
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
 * @param {import('/scripts/index.js').NS} ns
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
async function runHackCommand(host, args, ns) {
    if (args.help) {
        let msg = `
            net-hack controls. 
            Examples: 
            net hack add target n00dles
            net hack drop target n00dles
            `;
        ns.tprint(msg);
    } else if (args._.length > 0) {
        let cmd = args._.shift();
        // Handle the command.
        if (cmd === 'add' && args._.length >= 2) {
            // 'net hack add' (probably net hack add target <someserver>?)
            let key = args._.shift();
            let value = args._.shift();
            let msg = new C2Command('net-hack', 'net', 'add', key, value, ns);
            await sendC2message(msg, ns);
        }
        if (cmd === 'drop' && args._.length >= 2) {
            // 'net hack add' (probably net hack add target <someserver>?)
            let key = args._.shift();
            let value = args._.shift();
            let msg = new C2Command('net-hack', 'net', 'drop', key, value, ns);
            await sendC2message(msg, ns);
        } else {
            let msg = `I don't know how to handle the command '${cmd}' with additional options (${args._.join(',')}) `;
            ns.tprint(msg);
        }
    }
}

/**
 * Do something with the monitoring subsystem
 *
 * @param {string} host - the host to run against
 * @param {*} args - flags passed in from the command line.
 * @param {import('/scripts/index.js').NS} ns
 */
async function runMonitorCommand(host, args, ns) {
    if (args.help) {
        let msg =
            'monitor commands. net monitor [DisplayType] to change the running display type. Will also try to open the tail window.';
        ns.tprint(msg);
    } else if (args._.length > 0) {
        // See if we can find a tail window to open
        let mon = subsystems.find((sys) => sys.name === 'net-monitor');
        if (mon.status !== 'RUNNING') {
            ns.exec('/scripts/net-monitor.js', host, 1, '--start');
        }
        mon.refreshStatus(ns);
        if (mon.status === 'RUNNING') {
            ns.tail(mon.filename, mon.host, ...mon.process.args);
        }
        // Broadcast to the monitor app.
        let display = args._.shift();
        let cmd = new C2Command('net-monitor', 'net', 'set', 'display', display, ns);
        await sendC2message(cmd, ns);
    }
}

/**
 * Do something with the monitoring subsystem
 *
 * @param {string} host - the host to run against
 * @param {*} args - flags passed in from the command line.
 * @param {import('/scripts/index.js').NS} ns
 */
async function runServersCommand(host, args, ns) {
    const script_server = '/scripts/net-servers.js';
    ns.tprint(`Running server commands: '${args._}'`);
    if (args.help) {
        let msg = `
        server commands. 
        net server list -  list current purchased servers
        net server prices - show price list
        net server buy [num] size - Buy num servers at a particular size. Default 1
        net server delete server# - delete a server
        net server upgrade [server#] size - upgrade existing purchased server to size`;
        ns.tprint(msg);
    } else if (args._.length > 0) {
        let action = args._.shift();
        if (action === 'list') {
            ns.exec(script_server, host, 1, '--list');
        }
        if (action == 'prices') {
            ns.exec(script_server, host, 1, '--prices');
        }
        if (action == 'buy') {
            // There should be one or two more items on the command line.
            // If it's just one, then that's the size. If there's two it should be number then size
            if (args._.length > 0 && args._.length <= 2) {
                let siz = args._.pop();
                let num = args._.pop();
                num = num ?? 1;
                ns.exec(script_server, host, 1, '--buy', siz, '--num', num, '--list');
            } else {
                let msg = `Unknown arguments to net server buy: '${args._.join(
                    ' '
                )}' expected net server buy [num] siz`;
                ns.tprint(msg);
            }
        }
        if (action === 'delete') {
            let num = args._.shift();
            ns.exec(script_server, host, 1, '--delete', num);
        }
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
        if (system.status === 'RUNNING') {
            ns.tprint(`...    ${money}; Running ${duration}`);
        }
    }
    ns.tprint(``);
    // Some summary info, too
}

/**
 * Try to backdoor all the things.
 * @param {string} host - the host to run against
 * @param {*} args - flags passed in from the command line.
 * @param {import("/scripts/index.js").NS} ns
 */
async function runBackdoorCommand(host, args, ns) {
    ns.tprint(`Backdooring all systems. `);
    ns.exec('/scripts/net-backdoor', host, 1);
}

/**
 * Send a C2 message. If the queue is full, drops whatever falls off.
 * @param {C2Command} msg
 * @param {import("/scripts/index.js").NS} ns
 */
export async function sendC2message(msg, ns) {
    let s = JSON.stringify(msg);
    await ns.writePort(c2_port, s);
    ns.tprint(`C2 Message sent: ${s}`);
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
        if (msg.type === 'C2Message' && msg.to === system) {
            inbox.push(msg);
            ns.tprint(`C2 Message recieved for '${system}': ${JSON.stringify(msg)}`);
        } else {
            let expiryTime = ns.getTimeSinceLastAug() - 90 * 1000;
            if (msg.createtime > expiryTime) {
                await sendC2message(msg, ns);
            }
        }
    }
    return inbox;
}
