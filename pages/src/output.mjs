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
let evsubID;
let evsub;
let showTenthskph = common.settingsStore.get('showTenthskph');

const unit = x => `<span class="unit"> ${x}</span>`;
const spd = (v, entry) => H.pace(v, {precision: (showTenthskph == 1 ? 1 : 0), suffix: false, html: true, sport: entry.state.sport}); //+ unit('kph');
const dist = v => v ? ((v/1000).toFixed(1))+ unit('km') : '-';
const dist2 = v => {
	let dist = '0'
	if (v != null) {
		if (v > 999) {
			dist = (v/1000).toPrecision(3);
		} else {
			dist = (v).toFixed(0); 
		}
	}
	return dist
}
const disttogo = v => v ? '&nbsp; ' + dist2(v) + '<span class="material-symbols-outlined togo">sports_score</span>' : '';
const ele = v => v ? num(v) : '0';  //+ unit('m') : '-';
const time = v => v ? (secondsToHms(v)) : '00:00';
const timetogo = v => v ?  time(v) + '<span class="material-symbols-outlined togo">sports_score</span>' : '';

function secondsToHms(d) {
	d = Number(d);
	var h = Math.floor(d / 3600);
	var m = Math.floor(d % 3600 / 60);
	var s = Math.floor(d % 3600 % 60);
	var hDisplay = h > 0 ? h + ":" : "";
	var mDisplay = m < 10 ? "0" + m + ":" : m + ":";
	var sDisplay = s < 10 ? "0" + s : "" + s ;
	return hDisplay + mDisplay + sDisplay; 
}

common.settingsStore.setDefault({
	showTenthskph: false,
	solidBackground: false,
	backgroundColor: '#00ff00',
	overlayMode: false,
	fontScale: 1,
	showRoute: true,
	showDistance: true,
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
	setBackground();
	common.initInteractionListeners();
	let settings = common.settingsStore.get();
	
	common.settingsStore.addEventListener('changed', async ev => {	
		const changed = ev.data.changed;
		if (changed.has('solidBackground') || changed.has('backgroundColor')) {
			setBackground();
		}
		if (changed.has('showTenthskph')) {
			showTenthskph = common.settingsStore.get('showTenthskph');
		}
		if (window.isElectron && changed.has('overlayMode')) {
			await common.rpc.updateWindow(window.electron.context.id,
				{overlay: changed.get('overlayMode')});
			await common.rpc.reopenWindow(window.electron.context.id);
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
		if (evsubID == null || watching.state.eventSubgroupId != evsubID) {
			if (watching.state.eventSubgroupId == 0) {
				evsubID = null;
			} else {
				evsubID = watching.state.eventSubgroupId;
				evsub = await common.rpc.getEventSubgroup(evsubID);
			}
		}
		const worldtime_new = watching.state.worldTime;
		if (!worldtime_old) {
			worldtime_old = worldtime_new;
		}
		if ((worldtime_new - worldtime_old) != 0)  {
			worldtime_old = watching.state.worldTime;
			document.getElementById('speed').innerHTML = spd(watching.state.speed,watching);
			document.getElementById('speedunit').innerHTML = ' kph';
			document.getElementById('dist').innerHTML = dist2(watching.state.distance);
			document.getElementById('distunit').innerHTML = (watching.state.distance > 999) ? ' km' : ' m';
			document.getElementById('climbed').innerHTML = (ele(watching.state.climbing));
			document.getElementById('climbedunit').innerHTML = ' m';
			document.getElementById('time').innerHTML = (time(watching.state.time));
			if (evsubID != null) {
				if (watching.remainingMetric == "distance") {
					document.getElementById('disttogo').innerHTML = (disttogo(watching.remaining));
					document.getElementById('timetogo').innerHTML = "";
				}
				if (watching.remainingMetric == "time") {
					document.getElementById('timetogo').innerHTML = (timetogo(evsub.durationInSeconds-watching.state.time));
					document.getElementById('disttogo').innerHTML = "";
				}
			}
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
}


export async function settingsMain() {
	common.initInteractionListeners();
	await common.initSettingsForm('form#general')();
}