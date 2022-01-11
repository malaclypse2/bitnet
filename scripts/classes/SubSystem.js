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
                this.process = process;
                this.scriptInfo = ns.getRunningScript(this.filename, this.host, ...process.args);
                break;
            }
        }
    } // end refreshStatus()
}
