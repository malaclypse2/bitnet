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
 * net monitor short
 * net monitor Targets2Up
 * net servers list
 * net servers buy
 * net tail
 * (TODO)
 * net servers upgrade
 * net hacknet buy
 * net backdoor
 *
 */
/** @typedef{import('/scripts/index.js').NS} NS*/
import { subsystems, C2Command, C2Message, sendC2message } from '/scripts/bit-lib.js';

const corpServerName = 'Corp(©)';

/**
 * @param {NS} ns
 */
export async function main(ns) {
    // arg parsing
    //let args = ns.flags([['help', false]]);
    let args = { _: [] };
    args._ = ns.args;

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
        servers: runServersCommand,
        backdoor: runBackdoorCommand,
        tail: runTailCommand,
        corp: runCorpCommand,
    };
    // command aliases
    if (args._.length > 0) {
        if (args._[0] === 'mon') args._[0] = 'monitor';
        if (args._[0] === 'server') args._[0] = 'servers';
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
            net server --help
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
 * @param {NS} ns
 */
async function runStartCommand(host, args, ns) {
    // Let's see if we're just restarting one thing
    let sys = '';
    let subsystem;

    if (args._.length > 0) {
        sys = args._.shift();
    }

    // This will bring a running monitor mindow to life, or start one if there isn't one.
    if (['', 'mon'].includes(sys)) {
        await runMonitorCommand(host, args, ns);
    }

    // Start the host manager
    if (['', 'host-manager', 'host'].includes(sys)) {
        subsystem = subsystems.find((s) => s.name === 'host-manager');
        let sysargs = args._.length > 0 ? args._ : subsystem.defaultargs;
        if (subsystem.status === 'STOPPED') {
            ns.exec(subsystem.filename, subsystem.host, 1, ...sysargs);
        } else ns.tprint(`${subsystem.filename} already running with arguments ${subsystem.scriptInfo.args}`);
    }
    // Start the work manager. TODO: check for source files, free ram, and maybe a better place to run this.
    if (['', 'work', 'work-for-faction'].includes(sys)) {
        subsystem = subsystems.find((s) => s.name === 'work');
        let sysargs = args._.length > 0 ? args._ : subsystem.defaultargs;
        if (subsystem.status === 'STOPPED') {
            ns.exec(subsystem.filename, subsystem.host, 1, ...sysargs);
        } else ns.tprint(`${subsystem.filename} already running with arguments ${subsystem.scriptInfo.args}`);
    }
    // Start the daemon in if it's not running. Must do this last, if we're use spawn instead of exec.
    if (['', 'daemon'].includes(sys)) {
        subsystem = subsystems.find((s) => s.name === 'daemon');
        let sysargs = args._.length > 0 ? args._ : subsystem.defaultargs;
        if (subsystem.status === 'STOPPED') {
            //ns.exec(subsystem.filename, subsystem.host, 1, ...subsystem.defaultargs);
            ns.spawn(subsystem.filename, 1, ...sysargs);
        } else ns.tprint(`${subsystem.filename} already running with arguments ${subsystem.scriptInfo.args}`);
    }
}

/**
 * Tail all interesting processes
 * .
 * @param {string} host - Not used
 * @param {*} args - flags passed in from the command line.
 * @param {NS} ns
 */
async function runTailCommand(_host, args, ns) {
    // Default to tailing everything we know about.
    let systemsToTail = subsystems;

    // Unless we were passed arguments.
    if (args._.length > 0) {
        systemsToTail = [];
        while (args._.length > 0) {
            let sysname = args._.shift();
            systemsToTail.push(subsystems.find((s) => s.name.toLowerCase() === sysname.toLowerCase()));
        }
    }

    for (const sys of systemsToTail) {
        if (sys.status === 'RUNNING' && sys.shouldTail) {
            // Use our network monito to tail the windows, so we can do re-coloring and stuff?
            // await sendC2message(new C2Command('net-monitor', 'net', 'set', 'log', sys.name, ns), ns);

            //check to see if there's another instance running to also pull up (mostly for net-monitor)
            for (const ps of ns.ps(sys.host)) {
                if (ps.filename == sys.filename) ns.tail(sys.filename, sys.host, ...ps.args);
            }
        }
    }
}

/**
 * Stop all persistent processes on this host
 * .
 * @param {string} host - the host to run against
 * @param {*} args - flags passed in from the command line.
 * @param {import('/scripts/index.js').NS} ns
 */
async function runStopCommand(host, args, ns) {
    let subsystem = '';
    // If we were passed an argument, just shut down the one subsystem.
    if (args._.length > 0) {
        subsystem = args._.shift();
        ns.tprint(`Killing ${subsystem} subsystem`);
        let sys = subsystems.find((s) => s.name === subsystem);
        if (sys.status === 'RUNNING') {
            let process = sys.process;
            let isThisScript =
                process.filename === ns.getScriptName() && process.args === ns.args && host === ns.getHostname();
            if (sys.name === 'stockmaster') {
                // Quit stockmaster gracefully.
                ns.exec('/stockmaster.js', sys.host, 1, '--liquidate');
            } else if (!isThisScript) {
                // Otherwise, kill everything important other than ourselves.
                ns.tprint(`... Killing ${process.filename} ${process.args.join(' ')}`);
                ns.kill(process.filename, host, ...process.args);
            }
            sys.refreshStatus(ns);
        }
    } else {
        // Otherwise, shut everything  down
        ns.tprint(`Killing all running subsystems`);
        for (const sys of subsystems) {
            if (sys.status === 'RUNNING') {
                let process = sys.process;
                let isThisScript =
                    process.filename === ns.getScriptName() && process.args === ns.args && host === ns.getHostname();
                if (sys.name === 'stockmaster') {
                    // Quit stockmaster gracefully.
                    ns.exec('/stockmaster.js', sys.host, 1, '--liquidate');
                } else if (!isThisScript) {
                    // Otherwise, kill everything important other than ourselves.
                    ns.tprint(`... Killing ${process.filename} ${process.args.join(' ')}`);
                    ns.kill(process.filename, host, ...process.args);
                }
                sys.refreshStatus(ns);
            }
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
    await ns.sleep(750);
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
    } else {
        // See if we can find a tail window to open
        let mon = subsystems.find((sys) => sys.name === 'net-monitor');
        if (mon.status !== 'RUNNING') {
            ns.exec('/scripts/net-monitor.js', host, 1, '--start');
        }
        mon.refreshStatus(ns);
        if (args._.length > 0) {
            // Broadcast to the monitor app.
            let display = args._.shift();
            let cmd = new C2Command('net-monitor', 'net', 'set', 'display', display, ns);
            await sendC2message(cmd, ns);
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
async function runServersCommand(host, args, ns) {
    const script_server = '/scripts/net-servers.js';
    ns.tprint(`Running server commands: '${args._}'`);
    if (args.help) {
        let msg = `
        server commands. 
        net server list -  list current purchased servers
        net server prices - show price list
        net server buy [num] size - Buy num servers at a particular size. Default 1
        net server buy corp - Buy a 2 TB server, reserved for corporate scripts
        net server delete server# - delete a server
        net server upgrade [server#] size - upgrade existing purchased server to size`;
        ns.tprint(msg);
    } else {
        let action = 'list';
        if (args._.length > 0) {
            action = args._.shift();
        }
        if (action === 'list') {
            ns.exec(script_server, host, 1, '--list');
        }
        if (['price', 'prices'].includes(action)) {
            ns.exec(script_server, host, 1, '--prices');
        }
        if (action == 'buy') {
            // There should be one or two more items on the command line.
            // If it's just one, then that's the size. If there's two it should be number then size
            if (args._.length > 0 && args._.length <= 2) {
                let siz = args._.pop();
                let num = args._.pop();
                num = num ?? 1;
                if (siz === 'corp') {
                    // Size 11 is 2TB. Use the corp server name from the top of this file.
                    ns.exec(script_server, host, 1, '--buy', 11, '--name', corpServerName);
                } else {
                    for (let i = 0; i < num; i++) {
                        ns.exec(script_server, host, 1, '--buy', siz);
                    }
                }
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
 * Try to backdoor all the things.
 * @param {string} host - the host to run against
 * @param {*} args - flags passed in from the command line.
 * @param {import("/scripts/index.js").NS} ns
 */
async function runCorpCommand(host, args, ns) {
    ns.tprint(`Running corporate subsystem.`);
    ns.exec('/scripts/net-corp.js', host, 1, ...args._);
}
