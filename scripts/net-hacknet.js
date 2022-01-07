// Reinvest hacknet profits to the profit of the hacknet
/** @param {import(".").NS } ns */
export async function main(ns) {
    let p = ns.getPlayer();
    p.hacknet_node_core_cost_mult;
    let nodes = [];
    let numNodes = ns.hacknet.numNodes();
    for (let i = 0; i < numNodes; i++) {
        nodes[i] = ns.hacknet.getNodeStats(i);
    }
    let totalEarned = nodes.reduce((sum, node) => sum + node.totalProduction, 0);
    let totalRate = nodes.reduce((sum, node) => sum + node.production, 0);
    let totalSpent = 0;
    if (ns.ls('home', 'Formulas.exe')) {
        let i = 0;
        for (const node of nodes) {
            i++;
            let base = ns.formulas.hacknetNodes.hacknetNodeCost(i, p.hacknet_node_purchase_cost_mult);
            let core = ns.formulas.hacknetNodes.coreUpgradeCost(1, node.cores - 1, p.hacknet_node_core_cost_mult);
            let level = ns.formulas.hacknetNodes.levelUpgradeCost(1, node.level - 1, p.hacknet_node_level_cost_mult);
            let ram = ns.formulas.hacknetNodes.ramUpgradeCost(1, Math.log2(node.ram), p.hacknet_node_ram_cost_mult);
            totalSpent += core + level + ram + base;
        }
    }
    ns.tprint(`Hacknet Nodes: ${numNodes}`);
    ns.tprint(`Total Income: ${ns.nFormat(totalEarned, '$0.0a')}`);
    ns.tprint(`Total Spent: ${ns.nFormat(totalSpent, '$0.0a')}`);
    ns.tprint(`Total production: ${ns.nFormat(totalRate, '$0.1a')}/s`);
}
