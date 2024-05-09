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
	show5s: true,
	show15s: true,
	show60s: true,
	show5m:  true,
	show20m: true,
	showAve: true,
});

let showWKG = common.settingsStore.get('showWKG')

let font_base_size = 12
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
		if (changed.has('show1s') || changed.has('show5s') || changed.has('show15s') || changed.has('show60s') || changed.has('show5m') || changed.has('show20m') || changed.has('showAve') ) {
			chart.setOption({
				textStyle: {
					fontSize: font_base_size * common.settingsStore.get('fontScale')
				},
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
		
		let curPow =[];
		let peakPow=[];

		if (watching.state.time >= maxtime + refreshInterval ) {
			if (typeof firsttime === "undefined") {
				let firsttime = watching.state.time;
			}
			maxtime = watching.state.time;
			curPow.length = 0;
			peakPow.length = 0;
			if (common.settingsStore.get('show1s') == true) {
				curPow.push(watching.state.power);
				peakPow.push(watching.stats.power.max);
			};
			if (common.settingsStore.get('show5s') == true) {
				curPow.push(watching.stats.power.smooth[5]);
				peakPow.push(watching.stats.power.peaks[5].avg);
			};
			if (common.settingsStore.get('show15s') == true) {
				curPow.push(watching.stats.power.smooth[15]);
				peakPow.push(watching.stats.power.peaks[15].avg);
			};
			if (common.settingsStore.get('show60s') == true) {
				curPow.push(watching.stats.power.smooth[60]);
				peakPow.push(watching.stats.power.peaks[60].avg);
			};
			if (common.settingsStore.get('show5m') == true) {
				curPow.push(watching.stats.power.smooth[300]);
				peakPow.push(watching.stats.power.peaks[300].avg);
			};
			if (common.settingsStore.get('show20m') == true) {
				curPow.push(watching.stats.power.smooth[1200]);
				peakPow.push(watching.stats.power.peaks[1200].avg);
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
}

function togglePowerUnit() {
	showWKG = !showWKG;
	if (common.settingsStore.get('showWKG') !== showWKG) {
		common.settingsStore.set('showWKG', showWKG);
	}
}

function getxAxisValues() {
	let values  = [];
	if (common.settingsStore.get('show1s') == true) {
		values.push('1 s');
	};
	if (common.settingsStore.get('show5s') == true) {
		values.push('5 s');
	};
	if (common.settingsStore.get('show15s') == true) {
		values.push('15 s');
	};
	if (common.settingsStore.get('show60s') == true) {
		values.push('60 s');
	};
	if (common.settingsStore.get('show5m') == true) {
		values.push('5 m');
	};
	if (common.settingsStore.get('show20m') == true) {
		values.push('20 m');
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