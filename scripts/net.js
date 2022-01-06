/** @param {import(".").NS } ns */
export async function main(ns) {
	// arg parsing
	let args = ns.flags([
		['help', false]
	])
	
	if (args.help) {
		let msg = `	This is the command and control program. Try one of the following:
		net hack start
		net hack stop
		net mon 
		`
		ns.tprint(msg);
	}

	if(args._.length > 0) {
		let command = args._.shift()
		switch (command) {
			case 'net':
				await runNetCommand(args, ns)
				break;
			case 'mon':
				await runMonCommand(args, ns)
				break;
			default:
				ns.tprint(`I don't know how to handle the command '${command}'`)
				
		}
	}
}

async function runNetCommand(args, ns) {
	
}

async function runMonCommand(args, ns) {
	
}