export async function main(ns) {
    await backdoor(ns);
}

async function backdoor(ns) {
    for (let host of ns.scan('home')) {
        await _backdoor('home', host, ns);
    }
}

async function _backdoor(root, target, ns) {
    ns.connect(target);
    let serverInfo = ns.getServer();
    if (!serverInfo.backdoorInstalled && serverInfo.hasAdminRights) {
        await ns.installBackdoor();
        ns.toast('Backdoor Installed at' + serverInfo.hostname);
    }
    for (let host of ns.scan(target)) {
        await _backdoor(target, host, ns);
    }
    ns.connect(root);
}
