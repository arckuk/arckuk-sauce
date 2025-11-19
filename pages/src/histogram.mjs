import * as sauce from '/pages/src/../../shared/sauce/index.mjs';
import * as common from '/pages/src/common.mjs';
const [echarts, theme] = await Promise.all([
	import('/pages/deps/src/echarts.mjs'),
	import('/pages/src/echarts-sauce-theme.mjs'),
]);

const doc = document.documentElement;
const chartRefs = new Set();

let font_base_size = 12;

let MIN_HIST;
let MAX_HIST;
// array for  0–MAX_HIST, will be resized as required
let histoData;

let ftp;
let powerZones;
let colors;

let gameConnection;
let chart;
let pending = false;
let maxtime = 0;
let lastUpdate = 0;

common.settingsStore.setDefault({
    refreshInterval: 1,
    overlayMode: false,
    solidBackground: false,
    backgroundColor: '#00ff00',
    fontScale: 1,
    overlayMode: false,
    showWKG: false,
    showYAxis: true,
    showXAxis: true,
    showYAxisLabels: true,
    showXAxisLabels: true,
    measure: 'hr'
});


let measure = common.settingsStore.get('measure')
let refreshInterval = common.settingsStore.get('refreshInterval')

// Expand resolution as sample count grows
// e.g. first coarse (10 bpm), later finer (2–5 bpm)
function dynamicBinSize(histoRange) {
    if (histoRange > 250) return 10;
    if (histoRange > 100) return 5;
    if (histoRange > 50) return 2;
    return 1;            // highest resolution once enough data exists
}

// =====================================================================
// BUILD ADAPTIVE BINS FROM SINGLE-BPM DATA
// =====================================================================
function computeHistogram() {
    const totalSamples = histoData.reduce((a, b) => a + b, 0);
    if (totalSamples === 0) return { labels: [], counts: [] };

    let histoLow = Math.floor(MIN_HIST/10)*10;
    let histoHigh = Math.ceil(MAX_HIST/10)*10;


    const binSize = dynamicBinSize(histoHigh-histoLow);
    const binCount = Math.ceil((histoHigh - histoLow + 1) / binSize);

    const counts = new Array(binCount).fill(0);
    const labels = [];

    for (let i = 0; i < binCount; i++) {
        const low = histoLow + i * binSize;
        const high = Math.min(low + binSize - 1, MAX_HIST);

        // sum the 1-BPM bins that fall into this larger bin
        let sum = 0;
        for (let bpm = low; bpm <= high; bpm++) {
            sum += histoData[bpm];
        }
        counts[i] = sum;

        //labels.push(`${low}-${high}`);
        labels.push(`${low}`);
    }

    return { labels, counts };
}

function scheduleUpdate() {
    if (!pending) {
        pending = true;
        //requestAnimationFrame(() => {
            updateChart();
            pending = false;
        //});

    }
}

function initHisto(current) {
        MIN_HIST = 10000;
        MAX_HIST = 0;
        histoData = Array(MAX_HIST+1).fill(0);
        maxtime = 0;
        lastUpdate = 0;
}

// -------------------------------------------------------------
// Chart Initialization
// -------------------------------------------------------------
function initChart(dom) {
    const chart = echarts.init(dom,'sauce', {renderer: 'svg'});
    const option = {
        textStyle: {
                fontSize: font_base_size * common.settingsStore.get('fontScale')
        },
        grid: {
		    left: '10%',
		    top: '5%',
		    right: '10%',
		    bottom: '35'
	    },
        animation: false,
        tooltip: {},
        xAxis: {
            show: common.settingsStore.get("showXAxis"),
            name: common.settingsStore.get("measure").substring(0,3),
            nameGap: 5,
            nameRotate: 90,
            type: "category",
            data: [],
            axisLabel: { color: "#fff", rotate: 90, show: common.settingsStore.get("showXAxisLabels") }
        },
        yAxis: {
            show: common.settingsStore.get("showYAxis"),
            type: "value",
            minInterval: 1,
            splitLine: { show: false }, 
            axisLabel: { color: "#fff", show: common.settingsStore.get("showYAxisLabels")}
        },
        series: [{
            type: "bar",
            barWidth: '100%',
            data: [],
            itemStyle: { color: "#d11515ff" }
        }]
    };

    chart.setOption(option);
    chartRefs.add(new WeakRef(chart));
    return chart;
}

function updateChart() {
    if (!chart) return;

    const { labels, counts } = computeHistogram();
    chart.setOption({
        xAxis: { data: labels },
        series: [{ data: counts }]
    });
}

function resizeChart() {
	for (const r of chartRefs) {
		const c = r.deref();
		if (!c) {
			chartRefs.delete(r);
		} else {
			c.resize();
		}
	}
}

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
    
    setBackground();
    
    addEventListener('resize', resizeChart);

    const gcs = await common.rpc.getGameConnectionStatus();
    gameConnection = !!(gcs && gcs.connected);
    doc.classList.toggle('game-connection', gameConnection);
    common.subscribe('status', gcs => {
        gameConnection = gcs.connected;
        doc.classList.toggle('game-connection', gameConnection);
    }, {source: 'gameConnection'});

    
	echarts.registerTheme('sauce', theme.getTheme('dynamic'));
    const root = document.getElementById('chart-container');
    chart = initChart(root);

    common.settingsStore.addEventListener('changed', async ev => {
        const changed = ev.data.changed;
        console.log(ev.data.changed)
        if (changed.has('measure')) {
            measure = common.settingsStore.get('measure');
            console.log("measuring:",measure);
            MIN_HIST = 10000;
            MAX_HIST = 0;
            histoData = Array(MAX_HIST+1).fill(0);
            maxtime = 0;;
            scheduleUpdate();
            chart.setOption({ xAxis: {name: common.settingsStore.get("measure").substring(0,3) } })
        }

        if (changed.has('showXAxisLabels')) { chart.setOption({ xAxis: {axisLabel: {show: common.settingsStore.get("showXAxisLabels")} } }) } 
        if (changed.has('showXAxis')) { chart.setOption({ xAxis: {show: common.settingsStore.get("showXAxis")}   }) } 
        if (changed.has('showYAxisLabels')) { chart.setOption({ yAxis: {axisLabel: {show: common.settingsStore.get("showYAxisLabels")} } }) }
        if (changed.has('showYAxis')) { chart.setOption({ yAxis: {show: common.settingsStore.get("showYAxis")}   }) }

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
        // if (changed.has('showWKG')) {
        //     togglePowerUnit();
        //     chart.setOption({
        //         yAxis: {
        //             name: (showWKG == false ? "W" : "WKG"),
        //             axisLabel: {
        //                 formatter: (value) => value.toFixed((showWKG == false ? 0 : 1))
        //             }
        //         }
        //     })
        //}
        if (changed.has('refreshInterval')) {
            refreshInterval = common.settingsStore.get('refreshInterval');
        }  
        render();
    });

    let athleteId=0;
    let current;


    common.subscribe('athlete/watching', watching => {

        if(measure == 'hr') {
            current = watching.state.heartrate;
        }
        if(measure == 'power') {
            current = watching.state.power;
        }
        if(measure == 'cadence') {
            current = watching.state.cadence;
        }

        if (watching.athleteId !== athleteId) {
            athleteId = watching.athleteId;     
            MIN_HIST = current;
            MAX_HIST = current;
            histoData = Array(MAX_HIST+1).fill(0);
            maxtime = 0;
            console.log(watching);
            ftp = watching.athlete.ftp
            common.rpc.getPowerZones(1).then(zones =>{ powerZones = zones; colors = common.getPowerZoneColors(powerZones)});
            console.log(powerZones, colors);
        }
        
        if (watching.state.time > maxtime ) {
            maxtime = watching.state.time;

            if (current > MAX_HIST) {
                histoData = histoData.concat(Array(current-MAX_HIST).fill(0));
                MAX_HIST = current;
            }
            if (current < MIN_HIST) {
                MIN_HIST = current;
            }
            if ((current >= MIN_HIST) && (current <= MAX_HIST)  && (current != 0)) {
                histoData[current]++;
                if (maxtime >= lastUpdate + refreshInterval) {
                    lastUpdate = maxtime;
                    scheduleUpdate();
                    
                }
                           
            }
            console.log(measure, MIN_HIST, MAX_HIST, current,histoData[current]);
        }
    });
    
}

function render() {
    doc.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
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