// Try to assess where we are in the game.
// Suggest things to do next
// Suggest things to do before we augment

/** @typedef {import('/scripts/index.js').NS} NS*/

const argspec = [
	['start', false],
	['stop', false],
	['next', true],
	['aug', true],
	['help', false],
]

/**@param {NS} ns  */
export async function main (ns) {
	let args = ns.flags(argspec);
	if (args.help) {
		// Print some help stuff
	}
	if(args.next) {
		// Figure out what we've done and what we can do next.
		// What augments can we buy now?
		// Which ones could we buy if we worked on reputation?
		// What factions are we in? Could we join any new ones?
		// How's our corporation doing?
		// Could we purchase any new servers?
		// Stock exchange access/upgrades?
	}
	if (args.aug) {
		// Figure out some of the stuff we might want to do before augmenting.
		// Buy augments.
		// Repurchase stock
		// Upgrade the home server in ram or cores
	}

}