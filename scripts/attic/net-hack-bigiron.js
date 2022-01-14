import { getAllServerObjects, getPlayerInfo, printfSeverAsTarget, worker_size } from '/scripts/bit-lib.js';
import { Server } from "/scripts/classes/Server.js";
import { findTargets, getAttackStatus } from '/scripts/net-hack.js';

const script_grow = '/scripts/util/growOnce.js';
const script_weaken = '/scripts/util/weakenOnce.js';
const script_hack = '/scripts/util/hackOnce.js';

/** @param {import(".").NS} ns */
export async function main(ns) {
    // handle command line
    let args = ns.flags([['target', 'b-and-a']]);

    // Establish some initial conditions.
    let hostname = ns.getHostname();
    let scriptname = ns.getScriptName();
    let playerInfo = getPlayerInfo(ns);
    let servers = getAllServerObjects({}, ns);
    let host = servers[hostname];
    let targets = findTargets(servers, playerInfo, ns);
    getAttackStatus(servers, targets, ns);

    let target = targets.find((target) => target.name === args.target);
    if (target == null) {
        ns.tprint(`Could not find target '${args.target}' in the attack network list.`);
        ns.print(`ERROR: Could not find target '${args.target}' in the attack network list.`);
        ns.print(`ERROR: Target list: ${JSON.stringify(targets.map((t) => t.name).sort())}`);

        return;
    }
    // Make sure the target is prepped, and that there are no inbound attacks.
    let wait = prepare(host, target, ns);
    while (wait > 0) {
        await ns.asleep(wait - Date.now() + 200);
        getAttackStatus(servers, targets, ns);
        wait = prepare(host, target, ns);
    }

    // Now that the target is prepped, begin attack run
    

}

/**
 * Prepare a target for attack.
 * Minimize security rating, maximize cash on hand.
 *
 * @param {Server} host - The host from which to run attacks
 * @param {Server} target - The server we are attacking
 * @param {import('.').NS} ns
 * @returns {number} time when everything should hit (relative to reinc time), or 0 if that time is now.
 */
export async function prepare(host, target, ns) {
    ns.print(`Preparing target.`);
    let info = printfSeverAsTarget(target, ns);
    for (const line of info) {
        ns.print(line);
    }
    ns.print(`Security: ${target.securityCurrent}`);
    let desired = { grow: 0, weaken: 0 };

    // Calculate growth threads, accounting for any inbound attack threads
    let hackAmount = target.hackFactor * target.targetedBy.hack;
    let growthFactor = (target.maxMoney + hackAmount) / target.currentMoney;
    desired['grow'] = Math.ceil(ns.growthAnalyze(target.name, growthFactor, host.cores));
    desired['grow'] -= target.targetedBy.grow;

    // Assuming we launch those grow threads, how much will security increase?
    let secGrowth = ns.growthAnalyzeSecurity(desired.grow);
    // And all the other inbound hack and growth threads.
    secGrowth += ns.hackAnalyzeSecurity(target.targetedBy.hack);
    secGrowth += ns.growthAnalyzeSecurity(target.targetedBy.grow);
    desired['weaken'] = (target.securityCurrent - target.securityBase + secGrowth) / 0.05;
    desired['weaken'] = Math.ceil(desired['weaken']);

    let free = host.slots;
    let time = Date.now();
    let completetime = 0;
    if (target.targetedBy.hack) {
        completetime = Math.max(ns.getHackTime(target.name), completetime);
    }
    if (desired.grow || target.targetedBy.grow) {
        completetime = Math.max(ns.getGrowTime(target.name), completetime);
    }
    if (desired.weaken || target.targetedBy.weaken) {
        completetime = Math.max(ns.getWeakenTime(target.name), completetime);
    }
    if (completetime > 0) completetime += time;

    if (desired.grow + desired.weaken <= free) {
        if (desired.grow > 0) {
            ns.print(`Launcing ${desired.grow} grow threads versus '${target.name}'`);
            let pid = launch(host, target, script_grow, desired.grow, time, ns);
            if (pid != 0) {
                host.running.grow += desired.grow;
                target.targetedBy.grow += desired.grow;
                free -= desired.grow;
            }
        }
        if (desired.weaken > 0) {
            ns.print(`Launcing ${desired.weaken} weaken threads versus '${target.name}'`);
            let pid = launch(host, target, script_weaken, desired.weaken, time, ns);
            if (pid != 0) {
                host.running.weaken += desired.weaken;
                target.targetedBy.weaken += desired.weaken;
                free -= desired.weaken;
            }
        }
    } else {
        // Not enough free space... Maybe there's a bunch of stuff running?
        if (host.ram / worker_size > desired.grow + desired.weaken) {
            ns.print('Waiting for resources.');
            completetime = Date.now() + 1000;
        } else {
            ns.tprint(`Not enough free space to prepare '${target.name}' from host '${host.name}'.`);
            ns.exit();
        }
    }
    return completetime;
}
/**
 *
 * @param {Server} host - Host to run the script
 * @param {Server} target - Target (becomes args[0])
 * @param {string} script - path to the script
 * @param {number} threads - Number of threads
 * @param {number} time - time to launch
 * @param {import('.').NS} ns
 * @returns {number} - PID if successful, else 0
 */
function launch(host, target, script, threads, time, ns) {
    let retval = ns.exec(script, host.name, threads, target.name, time);
    return retval;
}
