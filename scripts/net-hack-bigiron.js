import { getAllServerInfo, getPlayerInfo, Server, worker_size } from '/scripts/bitlib.js';
import { findTargets, getAttackStatus } from '/scripts/net-hack.js';
/** @typedef {Server} */

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
    let playerInfo = getPlayerInfo();

    let servers = getAllServerInfo({}, ns);
    let host = servers[hostname];
    let targets = findTargets(servers, playerInfo, ns);
    getAttackStatus(servers, targets, ns);

    let target = targets.find((target) => {
        target.name == args.target;
    });
    if (target == null) {
        ns.tprint(`Could not find target '${args.target}' in the attack network list.`);
        ns.print(`ERROR: Could not find target '${args.target}' in the attack network list.`);
        ns.print(`ERROR: Target list: ${JSON.stringify(targets)}`);

        return;
    }
    // Make sure the target is prepped, and that there are no inbound attacks.
    let wait = prepare(host, target, ns);
    while (wait > 0) {
        await ns.asleep(wait - ns.getTimeSinceLastAug());
        wait = prepare(host, target, ns);
    }
    // Begin attack run
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
async function prepare(host, target, ns) {
    let desired = { grow: 0, weaken: 0 };

    // Calculate growth threads, accounting for any inbound attack threads
    let hackAmount = target.hackFactor * target.running.hack;
    let growthFactor = target.currentMoney / (target.maxMoney + hackAmount);
    desired['grow'] = ns.growthAnalyze(target.name, growthFactor, host.cores);
    desired['grow'] -= target.running.grow;

    // Assuming we launch those grow threads, how much will security increase?
    let secGrowth = ns.growthAnalyzeSecurity(desired.grow);
    // And all the other inbound hack and growth threads.
    secGrowth += ns.hackAnalyzeSecurity(target.running.hack);
    secGrowth += ns.growthAnalyzeSecurity(target.running.grow);
    desired['weaken'] = target.securityCurrent - target.securityBase + secGrowth;
    desired['weaken'] -= target.running.weaken;

    let free = host.slots;
    let time = ns.getTimeSinceLastAug();
    let completetime = 0;
    if (target.running.hack) {
        completetime = Math.max(ns.getHackTime(target.name), completetime);
    }
    if (desired.grow || target.running.grow) {
        completetime = Math.max(ns.getGrowTime(target.name), completetime);
    }
    if (desired.weaken || target.running.weaken) {
        completetime = Math.max(ns.getWeakenTime(target.name), completetime);
    }
    if (completetime > 0) completetime += time;

    if (desired.grow + desired.weaken <= free) {
        if (desired.grow > 0) {
            let pid = launch(host, target, script_grow, desired.grow, time, ns);
            if (pid != 0) {
                host.g += desired.grow;
                target.running.grow += desired.grow;
                free -= desired.grow;
            }
        }
        if (desired.weaken > 0) {
            let pid = launch(host, target, script_weaken, desired.weaken, time, ns);
            if (pid != 0) {
                host.w += desired.weaken;
                target.running.weaken += desired.weaken;
                free -= desired.weaken;
            }
        }
    } else {
        // Not enough free space... Maybe there's a bunch of stuff running?
        if ((host.ram/worker_size) > (desired.grow + desired.weaken)) {
            await ns.asleep(1000);
        } else {
            ns.tprint(`Not enough free space to prepare '${target.name}' from host '${host.name}'.`)
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
 * @param {number} time - time to launch (relative to ns.getTimeSinceLastAug())
 * @param {import('.').NS} ns
 * @returns {number} - PID if successful, else 0
 */
function launch(host, target, script, threads, time, ns) {
    let retval = ns.exec(script, host.name, threads, target, time);
    return retval;
}
