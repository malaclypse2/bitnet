const worker_size = 1.75;

/**
 * @export
 * @class Server
 */
const PurchasedServerNames = [
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
    'Aleph(א)',
    'daemon',
];

export class Server {
    /**
     * Creates an instance of Server.
     * @param {string} servername
     * @param {import(".").NS } ns
     * @memberof Server
     */
    constructor(servername, ns) {
        this.name = servername;
        this.update(ns);
        this.running = { hack: 0, grow: 0, weaken: 0 };
        this.targetedBy = { hack: 0, grow: 0, weaken: 0 };
        this.desired = { hack: 0, grow: 0, weaken: 0 };
        this.isPurchasedServer = false;
        // Let's not actually call ns.getPurchasedServers. That's expensive! Just check for our common server names.
        let basename = this.name.split('-')[0];
        if (PurchasedServerNames.includes(basename)) {
            this.isPurchasedServer = true;
        }
        this.symbol = this.name[0];

        let left=this.name.indexOf('(');
        let right=this.name.lastIndexOf(')');
        if (left !== -1 && right !== -1) {
            this.symbol = this.name.substring(left+1, right)
        }
    }
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
