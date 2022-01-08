export class C2Message {
    /**
     * @param {string} from
     * @param {string} to
     * @param {string} action
     * @param {string} key
     * @param {*} value
     * @param {import("/scripts/index.js").NS} ns
     */
    constructor(to, from, action, key, value, ns) {
        this.type = 'C2Message';
        this.subtype = '';
        this.to = to;
        this.from = from;
        this.action = action;
        this.key = key;
        this.value = value;
        this.createtime = ns.getTimeSinceLastAug();
    }
}

export class C2Command extends C2Message {
    constructor(to, from, action, key, value, ns) {
        super(to, from, action, key, value, ns);

        this.subtype = 'C2Command';
    }
}

export class C2Response extends C2Message {
    constructor(to, from, action, key, value, ns) {
        super(to, from, action, key, value, ns);

        this.subtype = 'C2Response';
    }
}
