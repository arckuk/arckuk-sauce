import * as sauce from '/pages/src/../../shared/sauce/index.mjs';
import * as common from '/pages/src/common.mjs';
const [echarts, theme] = await Promise.all([
	import('/pages/deps/src/echarts.mjs'),
	import('/pages/src/echarts-sauce-theme.mjs'),
]);

const doc = document.documentElement;
const dividedPower = num => (showWKG == false ? num : num/athleteWt);

const L = sauce.locale;
let imperial = common.storage.get('/imperialUnits');
L.setImperial(imperial);

let athleteWt;
let gameConnection;

common.settingsStore.setDefault({
	fontScale: 1,
	refreshInterval: 1,
	overlayMode: false,
	solidBackground: false,
	backgroundColor: '#00ff00',
	showWKG: false,
	show1s: true,
	showAve: true,
});

let showWKG = common.settingsStore.get('showWKG')

let font_base_size = 12
let chart_options = {
	grid: {
		left: '12%',
		top: '15%',
		right: '10%',
		bottom: '15%'
	},
	textStyle: {
		fontSize: font_base_size * common.settingsStore.get('fontScale')
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
		data: getxAxisValues(),
		axisLabel: {
			color: 'white',
			show: true,
		},
	},
	yAxis: {
		axisLabel: {
			color: 'white',
			show: true,
		},
		min: 0,
		name: (showWKG == false ? "W" : "WKG"),
		triggerEvent: true,
	},
	series: [
		{
			name: 'Peak',
			type: 'bar',
			data: [],
			barGap: '-100%',
			barCategoryGap: '10%',
			label: {
				color: 'white',
				show: true,
				formatter: (value) => (value.data != 0 ? value.data.toFixed((showWKG == false ? 0 : 2)) : ``),
				position: 'top',				
			}
		},
		{
			name: 'Current',
			type: 'bar',
			data: [],
			label: {
				color: 'black',
				show: true,
				formatter: (value) => (value.data != 0 ? value.data.toFixed((showWKG == false ? 0 : 2)) : ``),
				position: 'insideTop',				
			}
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

const chartRefs = new Set();

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
		if (changed.has('show1s') || changed.has('showAve')) {
			chart.setOption({
				xAxis: {
					data: getxAxisValues(),
				}
			})
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
	
	common.subscribe('athlete/watching', watching => {
		if (watching.athleteId !== athleteId) {
			athleteId = watching.athleteId;
			console.log(watching);
			athleteWt = watching.athlete.weight;
			firsttime = watching.state.time;
			maxtime = 0;
		}
		
		if (watching.state.time >= maxtime + refreshInterval ) {
			if (typeof firsttime === "undefined") {
				let firsttime = watching.state.time;
			}
			maxtime = watching.state.time;
			let curPow = [watching.stats.power.smooth[5],watching.stats.power.smooth[15],watching.stats.power.smooth[60],watching.stats.power.smooth[300],watching.stats.power.smooth[1200]];
			let peakPow = [watching.stats.power.peaks[5].avg,watching.stats.power.peaks[15].avg,watching.stats.power.peaks[60].avg,watching.stats.power.peaks[300].avg,watching.stats.power.peaks[1200].avg];
			if (common.settingsStore.get('show1s') == true) {
				curPow.unshift(watching.state.power);
				peakPow.unshift(watching.stats.power.max);
			};
			if (common.settingsStore.get('showAve') == true) {
				curPow.push(watching.stats.power.avg);
			};
			const powValues = peakPow.filter(Boolean).length; // find where peakPow is undefined
			for (let i = powValues; i < peakPow.length; i++) {
				curPow[i] = 0; // zero current Power values where there's no peakPow (where elapsed time is < pow duration)
			}

			chart.setOption({
				series: [
					{
						data: peakPow.map(dividedPower)
					},
					{
						data: curPow.map(dividedPower)
					}
				]
			});
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

function getxAxisValues() {
	let values  = ['5 s', '15 s', '60 s', '5 m', '20 m'];
	if (common.settingsStore.get('show1s') == true) {
		values.unshift('1s');
	};
	if (common.settingsStore.get('showAve') == true) {
		values.push('ave');
	};
return(values);
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