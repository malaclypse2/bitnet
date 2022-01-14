import { getPlayerInfo, getAllServerObjects, root, getPoolFromServers, Server } from '/scripts/bit-lib.js';
import { readC2messages, sendC2message, C2Command, C2Response } from '/scripts/bit-lib.js';

let hackThreshold = 0.5; // Don't start hacking unless a server has this percentage of max money
let hackFactor = 0.2; // Try to hack this percentage of money at a time
let max_targets = 100;
let sleep_time = 1000;
let banned_targets = ['b-and-a'];
let _DEBUG = false;

const big_iron_size = 2048; // in GB. Any servers larger than this will get their own codebase.
const big_iron_level = 5000; // Start applying big iron logic once we hit this level.

const script_grow = '/scripts/util/growOnce.js';
const script_weaken = '/scripts/util/weakenOnce.js';
const script_hack = '/scripts/util/hackOnce.js';

// Globals so we can access them from other running instances of this program if we like.
/** @type {Server[]} */
var targets;

/** @type {Object.<string, Server>} */
var servers;

/** @param {import(".").NS } ns */
export async function main(ns) {
    // Do something with arguments
    let args = ns.flags([
        ['start', false],
        ['stop', false],
        ['max_targets', 100],
        ['hackFactor', 0.2],
        ['hackThreshold', 0.5],
        ['sleep_time', 1000],
        ['tail', false],
    ]);

    if (args.stop) {
        ns.tprint('Stopping any running controllers.');
        runStop(ns);
    } else if (args.start) {
        max_targets = args.max_targets;
        hackFactor = args.hackFactor;
        hackThreshold = args.hackThreshold;
        sleep_time = args.sleep_time;
        if (args.tail) {
            ns.tail();
        }
        await runStart(ns);
    } else {
        let msg = `
			Invalid flags.  Command line should include either:
				--start To begin hacking, or
				--stop to end all hacking instances.	
			Optional with --start:
				--max_targets, --hackFactor, --hackThreshold, --tail, sleep_time
			`;
        ns.tprint(msg);
        return;
    }
}

/** @param {import(".").NS } ns */
function runStop(ns) {
    ns.scriptKill(ns.getScriptName(), ns.getHostname());
}

/** @param {import(".").NS } ns */
async function runStart(ns) {
    targets = [];
    servers = {};
    ns.tprint('Starting hacking controller.');

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

    validateScripts(ns);

    let playerInfo = getPlayerInfo(ns);
    servers = getAllServerObjects({}, ns);
    ns.print(servers);

    // Force a root check on available servers
    servers = rootServers(servers, ns);

    // Distribute fresh copies of attack scripts to all servers
    for (const servername in servers) {
        if (servername != 'home') {
            await ns.scp(script_grow, servername);
            await ns.scp(script_hack, servername);
            await ns.scp(script_weaken, servername);
        }
    }
    await ns.asleep(100);

    // Everyone loves a noodle shop. Let's start there.
    let firstTarget = new Server('n00dles', ns);
    firstTarget = evaluateTarget(firstTarget, playerInfo, ns);
    targets.unshift(firstTarget);

    // Add an extra target, since n00dles is pretty small, even early.
    addTargets(playerInfo, 1, ns);

    //Set up a few timers (approx 30sec, 1min, 10min)
    let on30 = 0,
        on60 = 0,
        on600 = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        on30 = ++on30 % 30;
        on60 = ++on60 % 60;
        on600 = ++on600 % 600;
        // Check for comand & control
        await processC2(ns);

        // Root any available servers
        const oldExploitCount = playerInfo.exploits;
        playerInfo = getPlayerInfo(ns);
        if (oldExploitCount != playerInfo.exploits || on60 == 0) {
            // We either have a new exploit, or it's been a little while.
            // Let's refresh our server info, and make sure there's nothing new to root.
            servers = rootServers(servers, ns);
        }

        // re-evaluate our targets.
        for (let i = 0; i < targets.length; i++) {
            let target = targets[i];
            // Update server information
            target.update(ns);
            // Re-evaluate targetting criteria, including desired attack threads
            target = evaluateTarget(target, playerInfo, ns);
            targets[i] = target;
        }

        // Allocate any free server slots
        ns.print('PRE: ' + servers);
        servers = allocateSwarmThreads(servers, targets, playerInfo, ns);
        ns.print('POST: ' + servers);
        let pool = getPoolFromServers(servers, ns);

        // Occasionally consider adding a new target
        if (on30 == 1) {
            // If we have a bunch of free threads, go ahead and add new targets.
            // One target per thousand free threads
            let additionalTargets = Math.floor(pool.free / 1000) + 1;
            additionalTargets = Math.min(additionalTargets, max_targets - targets.length);
            // Only if we have more free threads than we use, on average.
            let enoughFree = pool.free > pool.running / targets.length;

            if (enoughFree && additionalTargets) {
                addTargets(playerInfo, additionalTargets, ns);
            }
        }

        // Sleep
        await ns.asleep(sleep_time);
    } // End while(True)
}

/** @param {import(".").NS } ns */
function addTargets(playerInfo, numTargets, ns) {
    let potentialTargets = findTargets(servers, playerInfo, ns);
    let done = false;
    let x = potentialTargets.shift();
    while (!done && x) {
        let existing = targets.find((target) => target.name == x.name);
        let banned = banned_targets.find((target) => target == x.name);
        if (!existing && !banned) {
            targets.push(x);
            done = targets.length >= numTargets + 1;
        }
        x = potentialTargets.shift();
    }
}

/**
 * Find servers with free capacity, and allocate them to targets with open attack requests.
 * Updates all server and target information.
 *
 * @param {Object.<string,Server>} servers
 * @param {Server[]} targets
 * @param {import('/scripts/bit-lib.js').Player} player
 * @param {import(".").NS } ns
 * @return {Object.<string,Server>} returns servers
 */
function allocateSwarmThreads(servers, targets, player, ns) {
    ns.print('Allocating swarm threads.');

    // Make sure our notion of running attack threads against each target matches reality.
    // First, reset all our assumptions
    getAttackStatus(servers, targets, ns);

    let freeSlots = 0;
    for (const servername in servers) {
        let server = servers[servername];
        let isBigIron = player.level >= big_iron_level && server.ram >= big_iron_size;
        if (isBigIron) {
            server.slots = 0;
        }
        freeSlots += server.slots;
    }
    let totalDesiredHackThreads = 0;
    let totalDesiredWeakenThreads = 0;
    let totalDesiredGrowThreads = 0;

    for (const target of targets) {
        let delta = {};
        delta.h = target.desired.hack - target.targetedBy.hack;
        delta.w = target.desired.weaken - target.targetedBy.weaken;
        delta.g = target.desired.grow - target.targetedBy.grow;

        if (delta.h > 0) totalDesiredHackThreads += delta.h;
        if (delta.w > 0) totalDesiredWeakenThreads += delta.w;
        if (delta.g > 0) totalDesiredGrowThreads += delta.g;
    }

    ns.print(
        `Want to assign ${totalDesiredHackThreads} hack threads, ${totalDesiredWeakenThreads} weaken threads, and ${totalDesiredGrowThreads} grow threads in ${freeSlots} free slots.`
    );

    let allocatedHackThreads = 0,
        allocatedGrowThreads = 0,
        allocatedWeakenThreads = 0;
    // Allocate the attack threads first.
    allocatedHackThreads = Math.min(freeSlots, totalDesiredHackThreads);
    allocatedHackThreads = Math.max(allocatedHackThreads, 0);
    let unallocatedSlots = freeSlots - allocatedHackThreads;

    // Split up the rest of the slots in proportion to demand
    const totalDesiredNonHackThreads = totalDesiredWeakenThreads + totalDesiredGrowThreads;
    if (totalDesiredNonHackThreads > freeSlots) {
        allocatedGrowThreads = Math.floor((unallocatedSlots * totalDesiredGrowThreads) / totalDesiredNonHackThreads);
        allocatedGrowThreads = Math.min(totalDesiredGrowThreads, allocatedGrowThreads);
        allocatedGrowThreads = Math.max(allocatedGrowThreads, 0);

        allocatedWeakenThreads = Math.floor(
            (unallocatedSlots * totalDesiredWeakenThreads) / totalDesiredNonHackThreads
        );
        allocatedWeakenThreads = Math.min(totalDesiredWeakenThreads, allocatedWeakenThreads);
        allocatedWeakenThreads = Math.max(allocatedWeakenThreads, 0);
    } else {
        allocatedGrowThreads = totalDesiredGrowThreads;
        allocatedWeakenThreads = totalDesiredWeakenThreads;
    }
    ns.print(
        `Dividing free slots as ${allocatedHackThreads} hack threads, ${allocatedWeakenThreads} weaken threads, and ${allocatedGrowThreads} grow threads.`
    );

    // Put things into variables they'll be easier to get later
    let allocated = { hack: allocatedHackThreads, grow: allocatedGrowThreads, weaken: allocatedWeakenThreads };
    let totalAllocated = allocated.hack + allocated.grow + allocated.weaken;
    let attackScripts = { hack: script_hack, grow: script_grow, weaken: script_weaken };
    for (const target of targets) {
        target.desired = { hack: target.desired.hack, grow: target.desired.grow, weaken: target.desired.weaken };
        target.targetedBy = {
            hack: target.targetedBy.hack,
            grow: target.targetedBy.grow,
            weaken: target.targetedBy.weaken,
        };
    }
    // Exec all the attack threads on servers
    for (const servername in servers) {
        let server = servers[servername];
        // If we don't have any slots left, move to the next server
        if (server.slots < 1) continue;

        totalAllocated = allocated.hack + allocated.grow + allocated.weaken;
        // If we don't have anything left to assign, quit.
        if (totalAllocated < 1) break;

        ns.print(`Server ${server.name} has ${server.slots} for attack threads.`);
        for (const target of targets) {
            for (const attackType of ['hack', 'weaken', 'grow']) {
                let desired = Math.min(
                    target.desired[attackType] - target.targetedBy[attackType],
                    allocated[attackType],
                    server.slots
                );
                if (desired > 0) {
                    let t = Date.now();
                    let args = [target.name, t];
                    let retval = ns.exec(attackScripts[attackType], server.name, desired, ...args);
                    if (retval > 0) {
                        allocated[attackType] -= desired;
                        server.slots -= desired;
                        target.targetedBy[attackType] += desired;
                        // TODO: bleh. code smell. Sets server.w, server.g, or server.h
                        let letter = attackType[0];
                        server[letter] += desired;
                    } // end if succeeded.
                }
            }
        }
        servers[servername] = server;
    }

    return servers;
}

/**
 * Updates the attack status of servers and targets
 * @param {Object.<string, Server>} servers
 * @param {Server[]} targets
 * @param {import(".").NS } ns
 */
export function getAttackStatus(servers, targets, ns) {
    for (const servername in servers) {
        const server = servers[servername];
        server.running = { hack: 0, grow: 0, weaken: 0 };
        server.update(ns);
    }
    for (const target of targets) {
        target.targetedBy = { hack: 0, grow: 0, weaken: 0 };
        target.update(ns);
    }
    // Then reset by querying all the servers
    for (const servername in servers) {
        let server = servers[servername];
        // Query the server to see what attack threads it is running.
        let procs = ns.ps(server.name);
        while (procs.length > 0) {
            const proc = procs.pop();
            if (proc.filename.includes('/weak')) {
                let target = targets.find((target) => target.name == proc.args[0]);
                if (target) target.targetedBy.weaken += proc.threads;
                server.running.weaken += proc.threads;
            }
            if (proc.filename.includes('/grow')) {
                let target = targets.find((target) => target.name == proc.args[0]);
                if (target) target.targetedBy.grow += proc.threads;
                server.running.grow += proc.threads;
            }
            if (proc.filename.includes('/hack')) {
                let target = targets.find((target) => target.name == proc.args[0]);
                if (target) target.targetedBy.hack += proc.threads;
                server.running.hack += proc.threads;
            }
        }
        servers[servername] = server;
    }
}

/** @param {import(".").NS } ns */
export function rootServers(servers, ns) {
    for (const server in servers) {
        const info = servers[server];
        // Try to root any servers we haven't gotten yet.
        if (!info.rooted) {
            const success = root(server, ns);
            if (success) servers[server].update(ns);
        }
    }
    return servers;
}

function validateScripts(ns) {
    // Make sure the scripts all exist.
    if (!ns.fileExists(script_grow, 'home')) {
        ns.tprint(`Could not find script '${script_grow}`);
        return;
    }
    if (!ns.fileExists(script_weaken, 'home')) {
        ns.tprint(`Could not find script '${script_weaken}`);
        return;
    }
    if (!ns.fileExists(script_hack, 'home')) {
        ns.tprint(`Could not find script '${script_hack}`);
        return;
    }
}

/**
 * Find targets eligible for attack, sorted by score.
 *
 * @export
 * @param {Server[]} servers
 * @param {import('/scripts/bit-lib.js').Player} playerInfo
 * @param {import(".").NS } ns
 * @return {Server[]} sorted Array of targets
 */
export function findTargets(servers, playerInfo, ns) {
    let targets = [];
    // Calculate a theoretical profitiablity score for each server
    for (const server in servers) {
        let info = servers[server];
        info = evaluateTarget(info, playerInfo, ns);
        if (info.score != 0) {
            targets.push(info);
        }
    }
    // sort the target array by score
    targets.sort((a, b) => a.score - b.score);
    targets.reverse();
    return targets;
}

/**
 * Add a score and assign desired hack/grow/weaken threads.
 * @export
 * @param {Server} server
 * @param {import('./bit-lib.js').Player} playerInfo
 * @param {import(".").NS } ns
 * @return {Server}
 */
export function evaluateTarget(server, playerInfo, ns) {
    // We can only hack servers that are rooted, and that have a level lower than our level.
    if (server.levelRequired <= playerInfo.level && server.rooted) {
        server.score = (server.maxMoney * server.hackFactor) / server.securityBase;
        if (server.score == 0) {
            return server;
        }

        if (server.currentMoney / server.maxMoney > hackThreshold) {
            let desiredHackFactor = hackFactor; // percentage to steal per hacking cycle
            server.desired.hack = Math.ceil(desiredHackFactor / server.hackFactor);
            server.desired.hack = Math.max(server.desired.hack, 0);
        } else {
            server.desired.hack = 0;
        }

        // How much money is going to be stolen before we grow (on average)?
        let hacksPerGrow = server.growTime / server.hackTime;
        let loss = hacksPerGrow * server.desired.hack * server.hackFactor * server.currentMoney;
        // How many growth threads would we like to have?
        let desiredGrowthFactor = server.maxMoney / (server.currentMoney - loss);
        if (desiredGrowthFactor >= 1 && desiredGrowthFactor < Infinity) {
            server.desired.grow = Math.ceil(ns.growthAnalyze(server.name, desiredGrowthFactor));
            server.desired.grow = Math.max(server.desired.grow, 0);
        } else {
            server.desired.grow = 1;
        }
        // Do we need to let the security drop some?
        if (server.securityCurrent - server.securityBase > 5) {
            server.desired.grow = 1;
        }

        // How much will security increase before we weaken?
        let hacksPerWeaken = server.weakenTime / server.hackTime;
        let growsPerWeaken = server.weakenTime / server.growTime;
        let secIncreaseFromHacks = hacksPerWeaken * ns.hackAnalyzeSecurity(server.desired.hack);
        let secIncreaseFromGrowth = growsPerWeaken * ns.growthAnalyzeSecurity(server.desired.grow);
        let secIncreaseFromThreads = secIncreaseFromGrowth + secIncreaseFromHacks;
        let totalSecToWeaken = server.securityCurrent - server.securityBase + secIncreaseFromThreads;

        server.desired.weaken = Math.ceil(totalSecToWeaken / 0.05); // Static 0.05 security per thread used.
        server.desired.weaken = Math.max(server.desired.weaken, 0);
    } else {
        server.score = 0;
    }

    ns.print(
        `EvaluateTarget - S: ${server.name} H: ${server.desired.hack} G: ${server.desired.grow} W: ${server.desired.weaken}`
    );
    return server;
}

/** @param {import(".").NS } ns */
async function processC2(ns) {
    // To start with, we can allow adjusting some of our global parameters via c2:
    // hackThreshold, hackFactor, max_targets
    let commands = await readC2messages('net-hack', ns);

    while (commands.length > 0) {
        // expects {owner:'net-hack', action: 'set', key:'some-key', value:'some-value'}
        // ...at least for now.
        let cmd = commands.pop();
        /** type {C2Message} */
        if (cmd.subtype === 'C2Command') {
            await processC2Command(cmd, ns);
        } else if (cmd.subtype === 'C2Response') {
            await processC2Response(cmd, ns);
        }
    }
}

/**
 * Process C2 Commands from the port
 * @param {C2Command} cmd
 * @param {import('/scripts/index.js').NS} ns
 */
async function processC2Command(cmd, ns) {
    let msg;
    if (cmd.action === 'set') {
        switch (cmd.key) {
            case 'hackThreshold':
                hackThreshold = cmd.value;
                break;
            case 'hackFactor':
                hackFactor = cmd.value;
                break;
            case 'max_targets':
                max_targets = cmd.value;
                break;
            default:
                break;
        }
    } // End set
    else if (cmd.action === 'get') {
        switch (cmd.key) {
            case 'targets':
                // Send the target list back over the port.
                msg = new C2Response(cmd.from, 'net-hack', cmd.action, cmd.key, targets, ns);
                await sendC2message(msg, ns);
                break;
            case 'banned':
                msg = new C2Response(cmd.from, 'net-hack', cmd.action, cmd.key, banned_targets, ns);
                await sendC2message(msg, ns);
                break;
            default:
                break;
        }
    } // end get
    else if (cmd.action === 'add') {
        switch (cmd.key) {
            case 'target': {
                let possibleTargets = findTargets(servers, getPlayerInfo(ns), ns);
                for (const target of possibleTargets) {
                    if (target.name === cmd.value) targets.push(target);
                }
                break;
            }
            default:
                break;
        }
    } // end add
    else if (cmd.action === 'drop') {
        switch (cmd.key) {
            case 'target':
                banned_targets.push(cmd.value);
                targets = targets.filter((t) => t.name !== cmd.value);
                break;
            default:
                break;
        }
    } // end drop
}

/**
 * Process C2 Responses from the port
 * @param {C2Response} cmd
 * @param {import('/scripts/index.js').NS} ns
 */
async function processC2Response(cmd, ns) {
    // pass
}
