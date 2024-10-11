import * as common from '/pages/src/common.mjs';

const doc = document.documentElement;

let evsubID;
let evsub;
let routeID;
let route;
let evbanner;
let showRoute;
let showDistance;

common.settingsStore.setDefault({
	solidBackground: false,
	backgroundColor: '#00ff00',
	overlayMode: false,
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
	
	showRoute = common.settingsStore.get('showRoute');
	showDistance = common.settingsStore.get('showDistance');
	
	document.getElementById('eventInfo').classList.add("hidden");
	
	common.settingsStore.addEventListener('changed', async ev => {	
		if (ev.data.changed.has('solidBackground') || ev.data.changed.has('backgroundColor')) {
			setBackground();
		} else if (ev.data.changed.has('showRoute')) {
			showRoute = common.settingsStore.get('showRoute');
		} else if (ev.data.changed.has('showDistance')) {
			showDistance = common.settingsStore.get('showDistance');
		} else if (window.isElectron && ev.data.changed.has('overlayMode')) {
			await common.rpc.updateWindow(window.electron.context.id,
				{overlay: changed.get('overlayMode')});
			await common.rpc.reopenWindow(window.electron.context.id);
		}
		fillBanner();
	});
	
	common.subscribe('athlete/watching', async ad => {		
		if (evsubID == null || ad.state.eventSubgroupId != evsubID) {
			if (ad.state.eventSubgroupId == 0) {
				evsubID = null;
			} else {
				evsubID = ad.state.eventSubgroupId;
			}
			//console.log(ad);
			//console.log(evsubID);
			fillBanner();
		}		
	});

}

async function fillBanner() {
	evbanner = null;
	if ((evsubID != 0) && (evsubID !== null)) {
		console.log(evsubID);
		evsub = await common.rpc.getEventSubgroup(evsubID);
		evbanner = evsub.name;
		if (showRoute) {
			if (route == null || evsub.routeId != routeID) {
				routeID = evsub.routeId
				route = await common.rpc.getRoute(routeID);
			}
			evbanner = evbanner + "&nbsp;&nbsp;:&nbsp;&nbsp;" + route.name;
			console.log(route);
		}
		if (showDistance) {
			let duration
			if (evsub.durationInSeconds != 0) {
				duration = ((evsub.durationInSeconds)/60).toFixed(0) + " mins";
			} else {
				if (evsub.laps != 0) {
					duration = ((evsub.routeDistance)/1000.).toFixed(1) + " km, ";
				} else {
				duration = ((evsub.routeDistance)/1000.).toFixed(1) + " km, ";
				}
			}
			evbanner = evbanner + "&nbsp;&nbsp;:&nbsp;&nbsp;" + duration
			console.log(duration);
			if (evsub.durationInSeconds == 0) {
				evbanner = evbanner + "&nbsp;&nbsp;" + (evsub.routeClimbing).toFixed(0) + " m";
			}
		}
	}
	if (evbanner === null) {
		document.getElementById('eventInfo').classList.add("hidden");
	} else {
		document.getElementById('eventInfo').classList.remove("hidden");
		document.getElementById('eventInfo').innerHTML = evbanner;
	}
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


export async function settingsMain() {
	common.initInteractionListeners();
	await common.initSettingsForm('form')();
}
