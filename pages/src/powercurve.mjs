import * as sauce from '/pages/src/../../shared/sauce/index.mjs';
import * as common from '/pages/src/common.mjs';
const [echarts, theme] = await Promise.all([
	import('/pages/deps/src/echarts.mjs'),
	import('/pages/src/echarts-sauce-theme.mjs'),
]);

const doc = document.documentElement;
const dividedPower = num => (showWKG == false ? num : num/athleteWt);

const time = [];
const power = [];
const meanpower = [];
const bestpower = [];

const L = sauce.locale;
let imperial = common.storage.get('/imperialUnits');
L.setImperial(imperial);

let athleteWt;
let gameConnection;

common.settingsStore.setDefault({
	refreshInterval: 1,
	overlayMode: false,
	solidBackground: false,
	backgroundColor: '#00ff00',
	fontScale: 1,
	overlayMode: false,
	ShowWKG: false,
});

let showWKG = common.settingsStore.get('showWKG')

const chartRefs = new Set();

let font_base_size = 12;
let x_max = 60;

let chart_options = {
	grid: {
		left: '14%',
		top: '15%',
		right: '10%',
		bottom: '15%'
	},
	textStyle: {
		fontSize: font_base_size * common.settingsStore.get('fontScale')
	},
	title: {
		show: false,
	},
	animation: false,
	tooltip: {
		trigger: 'axis',
		axisPointer: {
			type: 'line' // 'shadow' as default; can also be 'line' or 'shadow'
		},
		valueFormatter: (value) => (typeof value === "undefined" ? '' : value.toFixed((showWKG == false ? 0 : 2)))
	},
	xAxis: {
		data: [],
		axisLabel: {
			color: 'white',
			show: true,
		},
		max: x_max,
	},
	yAxis: {
		axisLabel: {
			color: 'white',
			show: true,
		},
		name: (showWKG == false ? "W" : "WKG"),
		triggerEvent: true,
	},
	series: [
		{
			name: 'Peak',
			type: 'line',
			symbol: 'none',
			data: [],
		},
		{
			name: 'Current',
			type: 'line',
			symbol: 'none',
			data: [],
		}
	]
  };

let overlayMode;
if (window.isElectron) {
	overlayMode = !!window.electron.context.spec.overlay;
	doc.classList.toggle('overlay-mode', overlayMode);
	document.querySelector('#titlebar').classList.toggle('always-visible', overlayMode !== true);
	if (common.settingsStore.get('overlayMode') !== overlayMode) {
		common.settingsStore.set('overlayMode', overlayMode);
	}
}

function resizeCharts() {
	for (const r of chartRefs) {
		const c = r.deref();
		if (!c) {
			chartRefs.delete(r);
		} else {
			c.resize();
		}
	}
}

export async function main() {
	common.initInteractionListeners();
	
	addEventListener('resize', resizeCharts);
	
	const gcs = await common.rpc.getGameConnectionStatus();
	gameConnection = !!(gcs && gcs.connected);
	doc.classList.toggle('game-connection', gameConnection);
	common.subscribe('status', gcs => {
		gameConnection = gcs.connected;
		doc.classList.toggle('game-connection', gameConnection);
	}, {source: 'gameConnection'});

	common.settingsStore.addEventListener('changed', async ev => {
		const changed = ev.data.changed;
		if (changed.has('fontScale')) {
			chart.setOption({
				textStyle: {
					fontSize: font_base_size * common.settingsStore.get('fontScale')
				}
			})
		}
		if (changed.has('solidBackground') || changed.has('backgroundColor')) {
			setBackground();
		}
		if (window.isElectron && changed.has('overlayMode')) {
			await common.rpc.updateWindow(window.electron.context.id,
				{overlay: changed.get('overlayMode')});
			await common.rpc.reopenWindow(window.electron.context.id);
		}
		if (changed.has('showWKG')) {
			togglePowerUnit();
			chart.setOption({
				yAxis: {
					name: (showWKG == false ? "W" : "WKG"),
					axisLabel: {
						formatter: (value) => value.toFixed((showWKG == false ? 0 : 1))
					}
				}
			})
		}
		if (changed.has('refreshInterval')) {
			refreshInterval = common.settingsStore.get('refreshInterval');
		}  
		render();
	});

	let athleteId;
	
	echarts.registerTheme('sauce', theme.getTheme('dynamic'));

	const chart = echarts.init(document.getElementById('chart-container'),'sauce', {renderer: 'svg'});
	chartRefs.add(new WeakRef(chart));
	chart.setOption(chart_options);
	chart.on('click', params => { 
		if ((params.targetType === 'axisName') || (params.targetType === 'axisLabel')) {
			togglePowerUnit();
			chart.setOption({
				yAxis: {
					name: (showWKG == false ? "W" : "WKG"),
					axisLabel: {
						formatter: (value) => value.toFixed((showWKG == false ? 0 : 1))
					}
				},
			});
		}
	})

	let maxtime = 0;
	let firsttime = 0;
	let refreshInterval = common.settingsStore.get('refreshInterval');
	let lastRefresh = 0;
	let powerNow;
	common.subscribe('athlete/watching', watching => {
		if (watching.athleteId !== athleteId) {
			athleteId = watching.athleteId;
			console.log(watching);
			athleteWt = watching.athlete.weight;
			x_max = 60;
			power.length = 0;
			time.length = 0;
			meanpower.length = 0;
			bestpower.length = 0;
			firsttime = watching.state.time;
			maxtime = 0;
			lastRefresh = 0;
		}	
		
		powerNow = watching.state.power;
		if (watching.state.time > maxtime) {
			if (typeof firsttime === "undefined") {
				let firsttime = watching.state.time;
			}
			maxtime = watching.state.time;
			time.push(maxtime - firsttime);
			power.unshift(powerNow);
			let sum = 0;
			meanpower.length = 0;
			bestpower.push(0);
			for (let i=0; i < power.length; i++) {
				sum += power[i];
				meanpower.push(sum/(i+1));
				if (meanpower[i] > bestpower[i]) {
					bestpower[i] = meanpower[i];
				}
			}
			if (power.length > x_max) {
				x_max = x_max+60;
			}
			console.log("watching.state.time" + watching.state.time + "lastRefresh" + lastRefresh)
			if (watching.state.time >= lastRefresh + refreshInterval) {
				chart.setOption({
					xAxis: {
						data: time,
						max: x_max
					},
					series: [
						{
							data: bestpower.map(dividedPower)
						},
						{
							data: meanpower.map(dividedPower)
						}
					]
				});
				lastRefresh = watching.state.time;
			}
			
		}
	});
}

function render() {
	doc.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
}

function togglePowerUnit() {
	showWKG = !showWKG;
	if (common.settingsStore.get('showWKG') !== showWKG) {
		common.settingsStore.set('showWKG', showWKG);
	}
}

function setBackground() {
	const {solidBackground, backgroundColor} = common.settingsStore.get();
	doc.classList.toggle('solid-background', !!solidBackground);
	if (solidBackground) {
		console.log(backgroundColor);
		doc.style.setProperty('--background-color', backgroundColor);
	}else {
		doc.style.removeProperty('--background-color');
	}
}

export async function settingsMain() {
	common.initInteractionListeners();
	await common.initSettingsForm('form')();
}