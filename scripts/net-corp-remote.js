/** @typedef{import('/scripts/index.js').NS} NS*/

import {} from '/scripts/bit-lib.js';

export const corporateServerName = 'Corp(©)';

const argspec = [
    ['help', false],
    ['copy', false],
    ['purchase', false],
];

const materials = ['Water', 'Energy', 'Food', 'Plants', 'Hardware', 'Robots', 'AI Cores', 'Real Estate'];


/** @param {NS} ns */
export async function main(ns) {
    let args = ns.flags(argspec);
    // We should ignore any --copy and --purchase args. Those were passed to the proxy.

    // Not sure what we're going to do with command line args yet. Process them here.

    // Get some info about the corporation.

	ns.tail();
	let whdata = new Map();
	let lastState = '';

	while(true) {
		let corp = ns.corporation.getCorporation();
		ns.clearLog();


		if (corp.state === 'START' && corp.state !== lastState) {
			whdata = tuneMaterialSales(ns, whdata);
		}

		let report = getDivisionReport(ns);
		for (const line of report) {
			ns.print(line);
		}

		ns.print(corp.state);
		await ns.sleep(1000);

		if (corp.state !== lastState) {
			lastState = corp.state;
		}
	}
}

/** 
 * @param {NS} ns
 * @param {Map} data
*/
function tuneMaterialSales(ns, data) {
	let nf = (n) => ns.nFormat(n, '0.0a');
	let mf = (n) => ns.nFormat(n, '$0.0a');
	let npsf = (n) => (n >= 0 ? '+' + nf(n) : nf(n));
	let mpsf = (n) => (n >= 0 ? '+' + mf(n) : mf(n));

	// If we have < 100 of an item, increase the price. If we have > 200 of an item, decrease the price
	/*
		Try to get the delta to 0, by selling exactly as many items as we produce for the maximum that people will spend.
	 */
	const MIN = 100;
	const MAX = 500;
	const MP_DELTA = 0.005;
    // Let's go through the stuff we're selling, and see what's what.
    const divisions = ns.corporation.getCorporation().divisions;
    for (const div of divisions) {
		if (!data.has(div.name)) data.set(div.name, new Map())
        // Let's look at each city.
        for (const city of div.cities) {
			if (!data.get(div.name).has(city)) data.get(div.name).set(city, new Map())
			for(const mat of materials) {
				let material = ns.corporation.getMaterial(div.name, city, mat);
				if (material.prod > 0) {
					if (!data.get(div.name).get(city).has(material.name)) data.get(div.name).get(city).set(material.name, 1.00)
					let last = data.get(div.name).get(city).get(material.name);
					// This is something we're producing. 
					let delta = material.prod - material.sell;
					ns.tprint(`${div.name}, ${city}, ${material.name}, Qty: ${nf(material.qty)} (${npsf(delta)}) Last price: ${last.toFixed(3)}`);
					if (material.qty === 0) {
						// We're selling everything down to 0. Give the price a boost.
						last += 0.005;
						let n = 'MP * ' + last.toFixed(4);
						ns.corporation.sellMaterial(div.name, city, material.name, 'MAX', n);
						data.get(div.name).get(city).set(material.name, last);
						ns.tprint('New: '+ last.toFixed(4));
					} else if (delta >= 0 && material.qty > MAX) {
						// We're gaining and over our max. Bring the price down a bit.
						last *= 0.995;
						let n = 'MP * ' + last.toFixed(4);
						ns.corporation.sellMaterial(div.name, city, material.name, 'MAX', n);
						data.get(div.name).get(city).set(material.name, last);
						ns.tprint('New: '+ last.toFixed(4));
					} else if (delta <= 0 && material.qty < MIN) {
						// We're declining and below our min. Bring the price up a bit.
						last *= 1.005;
						let n = 'MP * ' + last.toFixed(4);
						ns.corporation.sellMaterial(div.name, city, material.name, 'MAX', n);
						data.get(div.name).get(city).set(material.name, last);
						ns.tprint('New: '+ last.toFixed(4));
					}
				}
			}
        }
	}
	return data;
}

function getDivisionReport(ns) {
	let nf = (n) => ns.nFormat(n, '0.0a');
	let mf = (n) => ns.nFormat(n, '$0.0a');
	let npsf = (n) => (n >= 0 ? '+' + nf(n) : nf(n));
	let mpsf = (n) => (n >= 0 ? '+' + mf(n) : mf(n));

	let corp = ns.corporation.getCorporation();
 
    let corpReport = [];
    let income = mpsf(corp.revenue - corp.expenses);
    corpReport.push(`Corporate Data for ${corp.name}`);
    corpReport.push(`Money: ${mf(corp.funds)} (${income}/s)`);

    // Let's go through the stuff we're selling, and see what's what.
    const divisions = ns.corporation.getCorporation().divisions;
    for (const div of divisions) {
        let divisionReport = [];
		income = mpsf(div.lastCycleRevenue - div.lastCycleExpenses);
        divisionReport.push(`   ${div.name} Division (${income}/s)`);

        // Let's look at each city.
        for (const city of div.cities) {
			let wh = ns.corporation.getWarehouse(div.name, city);
			let used = nf(wh.sizeUsed);
			let size = nf(wh.size);
			divisionReport.push(`      ${city} WH: [${used}/${size}].`)
			for(const mat of materials) {
				let material = ns.corporation.getMaterial(div.name, city, mat);
				if (material.prod > 0) {
					income = npsf(material.prod - material.sell)
					divisionReport.push(`         ${material.name}: ${nf(material.qty)} (${income}/cyc)`)
				}
			}
        }
		corpReport.push(...divisionReport);
	}
	return corpReport;
}