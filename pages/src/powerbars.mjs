import * as sauce from '/pages/src/../../shared/sauce/index.mjs';
import * as common from '/pages/src/common.mjs';
const [echarts, theme] = await Promise.all([
	import('/pages/deps/src/echarts.mjs'),
	import('/pages/src/echarts-sauce-theme.mjs'),
]);

const doc = document.documentElement;
const dividedPower = num => (showWKG == false ? num : num/athleteWt);

let selfAthleteData = null; 
do {
	await delay(1000);
	selfAthleteData = await common.rpc.getAthleteData('self');
} while (selfAthleteData == null);

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
	show1m: true,
	show5m:  true,
	show20m: true,
	showAve: true,
	showBest: true,
	best1: 0,
	best5: 0,
	best15: 0,
	best60: 0,
	best300: 0,
	best1200: 0,
	maxy: 0,
});

let showWKG = common.settingsStore.get('showWKG');
const powerDurations = ['5','15','60','300','1200'];
const powerLabels = ['1 s','5 s','15 s','1 m','5 m','20 m','ave'];
const showDurations = [];
const bestPowerTesting = false;
let bestPower = [common.settingsStore.get('best1'),common.settingsStore.get('best5'),common.settingsStore.get('best15'),common.settingsStore.get('best60'),common.settingsStore.get('best300'),common.settingsStore.get('best1200')];
//if (bestPowerTesting == true) {	bestPower = [0,0,0,0,0,0] }

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
		max: Number(common.settingsStore.get('maxy')) == 0 ? null : Number(dividedPower(common.settingsStore.get('maxy'))),
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
			},
			z: 20
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
			},
			z: 30
		},
		{
			name: 'Best',
			type: 'bar',
			data: [],
			barGap: '-100%',
			barCategoryGap: '10%',
			label: {
				color: 'white',
				show: false,
				formatter: (value) => (value.data != 0 ? value.data.toFixed((showWKG == false ? 0 : 2)) : ``),
				position: 'top',				
			},
			z: 10
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
		if (changed.has('show1s') || changed.has('show5s') || changed.has('show15s') || changed.has('show1m') || changed.has('show5m') || changed.has('show20m') || changed.has('showAve') ) {
			chart.setOption({
				textStyle: {
					fontSize: font_base_size * common.settingsStore.get('fontScale')
				},
				xAxis: {
					data: getxAxisValues(),
				}
			})
		}
		if (changed.has('best1') || changed.has('best5') || changed.has('best15') || changed.has('best60') || changed.has('best300') || changed.has('best1200') ) {
			bestPower =  [common.settingsStore.get('best1'),common.settingsStore.get('best5'),common.settingsStore.get('best15'),common.settingsStore.get('best60'),common.settingsStore.get('best300'),common.settingsStore.get('best1200')];
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
		if (changed.has('maxy')) {
			chart.setOption({
				yAxis: {
					max: Number(common.settingsStore.get('maxy')) == 0 ? null : Number(dividedPower(common.settingsStore.get('maxy')))
				},
			
			});
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
		if (params.targetType === 'axisName') {
			togglePowerUnit();
			chart.setOption({
				yAxis: {
					name: (showWKG == false ? "W" : "WKG"),
					axisLabel: {
						formatter: (value) => value.toFixed((showWKG == false ? 0 : 1))
					},
					max: Number(common.settingsStore.get('maxy')) == 0 ? null : dividedPower(Number(common.settingsStore.get('maxy'))),
				},
			});
		}
		if (params.targetType === 'axisLabel') {
			chart.setOption({
				yAxis: {
					max: (params.value == 0 ? null : params.value)
				},
			});
			common.settingsStore.set('maxy',params.value * (showWKG == false ? 1 : athleteWt) );
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

		if ((selfAthleteData.athleteId == watching.athleteId) || (bestPowerTesting == true)) {
			if (watching.stats.power.max > bestPower[0]) {
				bestPower[0] = parseInt(watching.stats.power.max);
				common.settingsStore.set('best1',bestPower[0]);
			}
			for (let index = 0; index < powerDurations.length; ++index) {
				if (watching.stats.power.peaks[(powerDurations[index])].avg > bestPower[index+1]) {
					bestPower[index+1] = parseInt(watching.stats.power.peaks[powerDurations[index]].avg);
					common.settingsStore.set('best'+powerDurations[index],bestPower[index+1]); 
				}
			}
		}
		
		let curPow =[];
		let peakPow=[];
		let shownBestPow=[];

		if (watching.state.time >= maxtime + refreshInterval ) {
			if (typeof firsttime === "undefined") {
				let firsttime = watching.state.time;
			}
			maxtime = watching.state.time;

			curPow =  [watching.state.power,     watching.stats.power.smooth[5],    watching.stats.power.smooth[15],    watching.stats.power.smooth[60],    watching.stats.power.smooth[300],    watching.stats.power.smooth[1200],   watching.stats.power.avg];
			peakPow = [watching.stats.power.max, watching.stats.power.peaks[5].avg, watching.stats.power.peaks[15].avg, watching.stats.power.peaks[60].avg, watching.stats.power.peaks[300].avg, watching.stats.power.peaks[1200].avg];
			const powValues = peakPow.filter(Boolean).length; // find where peakPow is undefined
			for (let i = powValues; i < peakPow.length; i++) {
				curPow[i] = null; // zero current Power values where there's no peakPow (where elapsed time is < pow duration)
			}

			let showSeries = [{data: (peakPow.filter((x,i) => showDurations.includes(i))).map(dividedPower)},{data: (curPow.filter((x,i) => showDurations.includes(i))).map(dividedPower)}];
			if ((common.settingsStore.get('showBest') == true) && ( (selfAthleteData.athleteId == watching.athleteId) || (bestPowerTesting == true) ) ) {
				showSeries.push({data: (bestPower.filter((x,i) => showDurations.includes(i))).map(dividedPower)});
			} else {
				showSeries.push({data: []})
			}
			chart.setOption({series: showSeries});
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
	showDurations.length = 0;
	let values  = [];
	if (common.settingsStore.get('show1s') == true) {
		values.push('1 s');
		showDurations.push(0);
	};
	if (common.settingsStore.get('show5s') == true) {
		values.push('5 s');
		showDurations.push(1);
	};
	if (common.settingsStore.get('show15s') == true) {
		values.push('15 s');
		showDurations.push(2);
	};
	if (common.settingsStore.get('show1m') == true) {
		values.push('1 m');
		showDurations.push(3);
	};
	if (common.settingsStore.get('show5m') == true) {
		values.push('5 m');
		showDurations.push(4);
	};
	if (common.settingsStore.get('show20m') == true) {
		values.push('20 m');
		showDurations.push(5);
	};
	if (common.settingsStore.get('showAve') == true) {
		values.push('ave');
		showDurations.push(6);
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

function delay(milliseconds){
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}