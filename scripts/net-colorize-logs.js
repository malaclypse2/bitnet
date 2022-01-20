// Install our custom stylesheet. Then find all of the open log windows, and tag their content with
// color codes.

/** @typedef {import('/scripts/index.js').NS} NS */

// Patterns to modify.
const patterns = [
    // RegExp, classname
    // Find numbers.
    [new RegExp(/(\b\${1}\d+\w*\b)/g), 'log__money'],
    [new RegExp(/(\b\${0}\d+\w*\b)/g), 'log__numeral'],
];

/**@param {NS} ns */
export async function main(ns) {
    const self = globalThis;
    const doc = self['document'];
	/**@type{ReactDOM} */
	const ReactDOM = self['ReactDOM'];
	/**@type{React} */
	const React = self['React'];

    // If we're already running, quit.
    // if (self[`Observing ${theTitle}`]){
    // 	ns.tprint('We appear to already be running. Quitting early.')
    // 	return;
    // }

    // Inject our CSS Styles into the document.
    injectStyles();
    ns.atExit(removeStyles);
    ns.tprint('CSS Styles injected.');

    // self[`Observing ${theTitle}`] = true;

    //Get all the top level windows
    const windowNodes = doc.querySelectorAll('#root > div > div');

    /**@type{Element[]}*/
    let logwindows = [];

    // See if we can find a log window by title.
    /**@type{Element}*/
    for (const winNode of windowNodes) {
        let title = winNode.querySelector('div > div > div > h6');
        if (title != null) {
            ns.tprint('Monitoring ' + title.title);
            logwindows.push(winNode);
        }
    }

    if (logwindows.length === 0) {
        ns.tprint('Could not find a log window to attach to!');
        return;
    }


    //okay, we have the outer level div of the log windows. Now what?
    while (true) {
        for (const win of logwindows) {
            if (win) {
                const loglines = win.querySelectorAll('div > div > div > p');
                // Color all of the existing paragraph nodes
                for (const line of loglines) {
                    //let color = self.getComputedStyle(p).getPropertyValue('color');
                    colourServerOutput(line);
                }
            }
        }
        await ns.sleep(500);
    }





	// An Observer to grab new records as they hit the log window and color them.
    // const observer = new MutationObserver((records) =>
    //     records.forEach(({ addedNodes }) => Array.from(addedNodes).forEach(colourServerOutput))
    // );

    // // Attach the observer to the log window, and color any existing lines.
    // setInterval(() => {
    //     if (!lognode.dataset.observing) {
    //         lognode.dataset.observing = true;
    //         observer.observe(lognode, { subtree: true });
    //         [].slice.call(lognode.querySelectorAll('p:not([hasBeenColoured])')).forEach(colourServerOutput);
    //     }
    // }, 2000);

    /** @param {Element} element */
    function colourServerOutput(element) {
        // Find the thing we want to color, then replace it with <span class="whatever">match</span>
        // Where "whatever" matches something in our stylesheet.
		let content = element.textContent;
        for (const pattern of patterns) {
			content = content.replaceAll(pattern[0], `<span class="${pattern[1]}">$1</span>`);
        }
		element.innerHTML = content;
    }
}

const injectStyles = () => {
    const id = 'colourful-log';
    const doc = globalThis['document'];

    let stylesheet = doc.getElementById(id);
    if (stylesheet) {
        stylesheet.remove();
    }

    stylesheet = doc.createElement('style');
    stylesheet.id = id;
    stylesheet.innerHTML = `
	.log__numeral {
		color: #E0E060;
	}

	.log__money {
		color: #C0E0A0;
	}

	`;
    doc.head.insertAdjacentElement('beforeend', stylesheet);
};

const removeStyles = () => {
    const id = 'colourful-log';
    const doc = globalThis['document'];

    let stylesheet = doc.getElementById(id);
    if (stylesheet) {
        stylesheet.remove();
    }
};
