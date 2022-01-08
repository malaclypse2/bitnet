//125,193,78,90,75,157,11,17,56,101,67,17

//17,67,101,56,17,11,157,75,90,78,193,125

//0,0,0,1,0,0,0,0

/**
 * Algorithmic stock trader I
 *
 * start with one pointer on the left and one on the right.
 * Assume the left pointer buys on day 0, then advances one day.
 * 	If he had a loss, assume he bought on day 1. Repeat.
 *  If he had a profit, then let the pointer on the right move backwards, looking for a higher peak.
 * Repeat, recording the best buy/sell pair as we go. When the pointers meet in the middle, we should be done.
 *
 * @param {import('/scripts/index.js').NS} ns
 */
export async function main(ns) {
    let prices = args[0].split(',');
    let left = 0;
    let right = prices.length - 1;
    let max = { buy: left, sell: right, profit: 0 };

    let buyprice, sellprice, profit;
    let buytime, selltime;
    buytime = selltime = 0;
    buyprice = sellprice = profit = 0;

	// Start by buying on day 0
    buyprice = prices[left];
    buytime = left;

	let done = false;
    while (!done) {
		// Move the left side, looking for a profit.
        while (profit <= 0) {
            left++;
            sellprice = prices[left];
            selltime = left;

            profit = sellprice - buyprice;
            if (profit < 0) {
                buyprice = prices[left];
                buytime = left;
            }
        } //end moving left side to the right
        // We found something profitable! Let's see if we should record it.
    }
}
