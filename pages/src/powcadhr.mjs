import * as sauce from '/pages/src/../../shared/sauce/index.mjs';
import * as common from '/pages/src/common.mjs';

const doc = document.documentElement;
let imperial = common.storage.get('/imperialUnits');
const L = sauce.locale;
const H = L.human;
const num = H.number;
L.setImperial(imperial);
let gameConnection;
let athleteId;

common.settingsStore.setDefault({
    showDraft: true,
    solidBackground: false,
    backgroundColor: '#00ff00',
	overlayMode: false,
	fontScale: 1,
});

let overlayMode;
if (window.isElectron) {
    overlayMode = !!window.electron.context.spec.overlay;
    doc.classList.toggle('overlay-mode', overlayMode);
    document.querySelector('#titlebar').classList.toggle('always-visible', overlayMode !== true);
    if (common.settingsStore.get('overlayMode') !== overlayMode) {
        common.settingsStore.set('overlayMode', overlayMode);
    }
}

export async function main() {

	common.initInteractionListeners();
	let settings = common.settingsStore.get();
	
	common.settingsStore.addEventListener('changed', async ev => {	
		const changed = ev.data.changed;
        if (changed.has('solidBackground') || changed.has('backgroundColor')) {
            setBackground();
		}
		if (window.isElectron && changed.has('overlayMode')) {
            await common.rpc.updateWindow(window.electron.context.id,
                {overlay: changed.get('overlayMode')});
            await common.rpc.reopenWindow(window.electron.context.id);
        }
        if (changed.has('showDraft')) {

		} 
		console.log(changed);		
		render();
    });
	
	common.storage.addEventListener('globalupdate', ev => {
        if (ev.data.key === '/imperialUnits') {
            L.setImperial(imperial = ev.data.value);
        }
    });
	
	render();
	let worldtime_old;

	common.subscribe('athlete/watching', async watching => {
        if (watching.athleteId !== athleteId) {
            athleteId = watching.athleteId;
            worldtime_old = 0;
			console.log(watching);
        }

		const worldtime_new = watching.state.worldTime;
		if (!worldtime_old) {
            worldtime_old = worldtime_new;
        }
		if ((worldtime_new - worldtime_old) >250) {
		    worldtime_old = worldtime_new;
		    document.getElementById('power').innerHTML = watching.state.power;
            document.getElementById('draft').innerHTML = watching.state.draft;
		    document.getElementById('cad').innerHTML = watching.state.cadence;
		    document.getElementById('hr').innerHTML = watching.state.heartrate;
		}
	});
}

function setBackground() {
    const {solidBackground, backgroundColor} = common.settingsStore.get();
    doc.classList.toggle('solid-background', !!solidBackground);
    if (solidBackground) {
        doc.style.setProperty('--background-color', backgroundColor);
    } else {
        doc.style.removeProperty('--background-color');
    }
}

function render() {
    doc.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
    let draftData =  document.getElementById('draftData')
    draftData.style.display = (common.settingsStore.get('showDraft') === true) ? '' : 'none';
}


export async function settingsMain() {
    common.initInteractionListeners();
    await common.initSettingsForm('form#general')();
}