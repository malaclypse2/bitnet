/** @typedef{import('/scripts/index.js').NS} NS*/

import {} from '/scripts/bit-lib.js';

export const corporateServerName = 'Corp(©)';

const argspec = [
    ['help', false],
    ['copy', false],
    ['purchase', false],
];

/** @param {NS} ns */
export async function main(ns) {
    let args = ns.flags(argspec);
    // We should ignore any --copy and --purchase args. Those were passed to the proxy.

    // Not sure what we're going to do with command lilne args yet. Process them here.

    // Get some info about the corporation.
    let corp = ns.corporation.getCorporation();
    //ns.tprint(corp);
    let corpReport = [];
    let nf = (n) => ns.nFormat(n, '0.0a');
    let mf = (n) => ns.nFormat(n, '$0.0a');
    let mpsf = (n) => ns.nFormat(n, '-$0.0a');

	let income = mpsf(corp.revenue - corp.expenses);
    corpReport.push(`Corporate Data for ${corp.name}`);
    corpReport.push(`Money: ${mf(corp.funds)} (${income})`);
    corpReport.push(``);

	for (const line of corpReport) {
		ns.tprint(line);
	}

	// Based on the industry type, we'll need to kno wwhat's imported and exported.
	const industry = {
		"Agriculture": {
			imports: ['Water', 'Energy'],
			exports: ['Food', 'Plants']
		},
		"Tobacco": {
			imports: ['Water', 'Plants'],
			exports: ['Leaf v4', 'Leaf v5', 'Leaf v6', 'Leaf v7']
		}, 
	}
    // Let's go through the stuff we're selling, and see what's what.
    // How do we get division names??
    const division_names = ['Orchards', 'Golden Leaf'];
    for (const division_name of division_names) {
        let div = ns.corporation.getDivision(division_name);
		let divisionReport = [];
		divisionReport.push(`   ${div.name} Division.`)


		// Let's look at each city.
		for (const city of div.cities) {
			let wh = ns.corporation.getWarehouse(division_name, city);
			let imports = industry[div.type].imports;
			let exports = industry[div.type].exports;
			// divisionReport.push(`      Importing:`)
			// for (const importing of imports) {
			// 	let imp = ns.corporation.getMaterial(division_name, city, importing);
			// 	divisionReport.push(`      ${importing}`)
			// }
			divisionReport.push(`      Exporting:`)
			for (const exporting of exports) {
				let prod = ns.corporation.getProduct(division_name, exporting);
				
				divisionReport.push(`      ${exporting}`)
			}
		}

		ns.tprint(div);
		for (const line of divisionReport) {
			ns.tprint(line);
		}

    }
}
