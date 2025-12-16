import * as sauce from '/pages/src/../../shared/sauce/index.mjs';
import * as common from '/pages/src/common.mjs';
const [echarts, theme] = await Promise.all([
	import('/pages/deps/src/echarts.mjs'),
	import('/pages/src/echarts-sauce-theme.mjs'),
]);

const doc = document.documentElement;
const chartRefs = new Set();

let font_base_size = 12;

let MIN_HIST; // actual minimum histogram value
let histoLow; // displayed histogram low value
let MAX_HIST;
let histoHigh;
// array for  0–MAX_HIST, will be resized as required
let histoData;

let binSize;
let binCount;

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
    measure: 'hr',
    setMin0: false,
    showZones: true,
    setMaxftp: false,
    showKey: false,
});

let measure = common.settingsStore.get('measure')
let refreshInterval = common.settingsStore.get('refreshInterval')
let updateHisto = false

let min0 = common.settingsStore.get('setMin0')
let maxftp = common.settingsStore.get('setMaxftp')
let showZones = common.settingsStore.get('showZones')

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

    // check if we need to re-size the x-axis of the graph - histoLow or histoHigh will be different, or min or max FTP setting has changed
    let prevhistoLow = histoLow;
    let prevhistoHigh = histoHigh;
    histoLow = Math.floor(MIN_HIST/10)*10;
    histoHigh = Math.ceil(MAX_HIST/10)*10;
    if (min0) {histoLow = 0};
    if (maxftp && measure == 'power') {histoHigh = Math.max(ftp,Math.ceil(MAX_HIST/10)*10)};

    if ( (prevhistoLow != histoLow) || (prevhistoHigh != histoHigh) || updateHisto ){   
        updateHisto = false;
        binSize = dynamicBinSize(histoHigh-histoLow);
        binCount = Math.ceil((histoHigh - histoLow + 1) / binSize);

        // if we have powerZones, then colour code bars appropriately
        if ((powerZones !== undefined) && (measure == 'power') && (showZones == true)) {

            let chartPieces = [];
            for (let i = 0; i < powerZones.length; i++) {
                chartPieces.push({
                    min: ((powerZones[i].from * ftp)-histoLow)/binSize ,
                    max: ((powerZones[i].to   * ftp)-histoLow)/binSize , 
                    color: colors["Z"+(i+1)],
                    label: 'Z'+(i+1) + ': ' + Math.round(powerZones[i].from * ftp)
                })
            }
            if ((chartPieces.length != 0) && (chartPieces !== undefined)) {
                chartPieces[0].min = 0;
                chartPieces[chartPieces.length-1].max = 5000;
                chart.setOption({visualMap: {type: 'piecewise', dimension: 0, pieces: chartPieces}});
            }
        } else {
            chart.setOption({visualMap: {type: 'piecewise', dimension:0 , pieces:[{ 'gte': 0, 'color': '#d11515ff' }]}});
        }
    }
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
        labels.push(low);
    }

    return { labels, counts };
}

function scheduleUpdate() {
    if (!pending) {
        pending = true;
            updateChart();
            pending = false;
    }
}

function initHisto(current) {
        MIN_HIST = 10000;
        MAX_HIST = 0;
        histoHigh = 0;
        histoLow = 10000;
        histoData = Array(MAX_HIST+1).fill(0);
        maxtime = 0;
        lastUpdate = 0;
        powerZones = [];
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
        series: {
            type: "bar",
            barWidth: '100%',
            data: [],
            itemStyle: { color: "#d11515ff" },
        }
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
        //console.log(ev.data.changed)
        if (changed.has('measure')) {
            measure = common.settingsStore.get('measure');
            console.log("Measuring:",measure);
            MIN_HIST = 10000;
            MAX_HIST = 0;
            histoData = Array(MAX_HIST+1).fill(0);
            maxtime = 0;;
            updateHisto = true;
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
        if (changed.has('showZones')) {
            showZones = common.settingsStore.get('showZones')
            updateHisto = true;
        }
        if (changed.has('showKey')) {
            chart.setOption({
                visualMap: { show: common.settingsStore.get('showKey') }
            })
        }
        if (changed.has('setMin0')) {
            min0 = common.settingsStore.get('setMin0')
        }
        if (changed.has('setMaxftp')) {
            maxftp = common.settingsStore.get('setMaxftp')
        }
        if (window.isElectron && changed.has('overlayMode')) {
            await common.rpc.updateWindow(window.electron.context.id,
                {overlay: changed.get('overlayMode')});
            await common.rpc.reopenWindow(window.electron.context.id);
        }
        if (changed.has('refreshInterval')) {
            refreshInterval = common.settingsStore.get('refreshInterval');
        }  
        render();
    });

    let athleteId=0;
    let current;


    common.subscribe('athlete/watching', watching => {
        updateHisto = true;
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
            initHisto()
            MIN_HIST = current;
            MAX_HIST = current;
            histoData = Array(MAX_HIST+1).fill(0);
            maxtime = 0;
            console.log("Athlete:\n",watching);
            ftp = watching.athlete.ftp;
            //console.log("ftp",ftp);
            getZones();
            //console.log(powerZones);
            scheduleUpdate();
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
            //console.log(measure, MIN_HIST, MAX_HIST, current,histoData[current]);
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

async function getZones() {
    await common.rpc.getPowerZones(1).then(zones =>{ powerZones = zones; colors = common.getPowerZoneColors(powerZones)});
    console.log("PowerZones and Colors:\n",powerZones, colors);
    chart.setOption({
        visualMap: {
            type: 'piecewise',
            dimension: 0,
            textStyle: {color: 'white'},
            pieces: {min:0 , max:1000,  color: 'white'},
            showLabel: true,
            right: 10,
            top: 'top',
            show: false,
        }
    });
}

export async function settingsMain() {
    common.initInteractionListeners();
    await common.initSettingsForm('form')();
}