import * as sauce from '/pages/src/../../shared/sauce/index.mjs';
import * as common from '/pages/src/common.mjs';

const doc = document.documentElement;

let gameConnection;
let athleteId;

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
    render();

    let worldtime_old;
    let thisInterval;
    let icon;
    let pup;

    pup = "none"
    
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
        if ((worldtime_new - worldtime_old) >1000) {
            worldtime_old = worldtime_new;

            if (watching.state.activePowerUp !== pup) {
                pup = watching.state.activePowerUp
                if (pup == "LIGHTNESS") icon = "feather.png";
                if (pup == "POWERUP_CNT") icon = "coffee.png";
                if (pup == "AERO") icon = "aero.png";
                if (pup == "DRAFTBOOST") icon = "draft.png";
                if (pup == "UNDRAFTABLE") icon = "burrito.png";
                if (pup == "STEAMROLLER") icon = "steamroller.png";
                if (pup == "ANVIL") icon = "anvil.png";
                let iconpath = "images/"+icon
                if (pup == null) {
                    document.getElementById('activepup').innerHTML = '';
                    //document.getElementById('activepup').innerHTML = '<img src="images/composite.png">';
                } else {
                    document.getElementById('activepup').innerHTML = '<img src="'+iconpath+'">';
                }                
            }
        }
    });
}



function render() {

}