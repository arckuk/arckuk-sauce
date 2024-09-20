# Arckuk mods for Sauce for Zwift

Contains a number of mods for the excellent [Sauce for Zwift](https://github.com/SauceLLC/sauce4zwift) which might enhance your [Zwift](https://zwift.com) experience by replacing and enhancing the standard HUD. See the screenshot below which has the standard Zwift HUD hidden (press H key in-game) and shows arckuk mods:

![Zwift screenshot with Arckuk mods](https://github.com/user-attachments/assets/4b267e27-d1c9-407a-ae07-27b9d551d370)

The following screenshot uses the Input and Output mods, rather than Top Bar and Power Cadence HR, to bring the rider's input (power, cadence heart rate, as well as draft and road gradient) to the system to the centre of the screen, and output values (speed, distance, time, elevation to the side). 
![Zwift screenshot with Arckuk Input and Output mods](https://github.com/user-attachments/assets/4edb2f89-7872-418f-93fe-6a88793506c8)

## Mods

### Event Title:
Shows the name of the event subgroup and brief details (course name, distance and elevation) of any event that the current watched athlete is participating in. Otherwise, shows nothing - mousing over the window will show the ouline and allows right click for settings/minimise/close/resize. Useful for showing the race/event details in a stream (very top middle of screenshot)

### Top Bar:
A replacement for the default Zwift speed / distance / elevation / time bar that appearas on the centre top of the Zwift window, with a more Sauce like look. Shows remaining distance or time for an event, and can optionally show speed in 10ths of kph (top middle of screenshot)

### Power Cadence HR:
A replacement for the default Zwift Power, Cadence and HR box normally in the top left of the screen, can optionally also show the current draft (top left of screenshot)

### Power Bars:
A bar chart display of the current and best 1 s, 5 s, 15 s, 60 s, 5 min, 20 min and average power for the current user session. All time best power averages can also be shown (in blue). All power durations are optional in mod settings. Values can be shown in Watts, or W/KG - click on the 'W' in the y-axis title or tick the mod setting. Y-axis can be scaled to any value - click number on the y-axis or zero for auto scale to max value. (mid left of screenshot)

### Power Graph:
A graph of the current and best power as a function of time for the currently watched athlete - a continuously updated and evolving power curve. Values can be shown in Watts, or W/KG (lower left of screenshot)

### Input:
Shows parameters that reflect the rider's input to the Zwift system (power, cadence and heart rate) as well as draft and gradient, designed to go in the top centre of the screen rather than top left which is the Zwift default

### Output:
Show parameters which are the output of the Zwift session: speed, distance, time, elevation, as well as distance or time remaining in an event

## Installation
Download the zip of this repository (Click the green !['<> Code ▾' button](https://github.com/arckuk/arckuk-sauce/assets/169094745/c67d7860-7401-4fd1-8b0c-b882763ccca4)
 button near the top of this screen, then 'Download ZIP'). Extract the arckuk-sauce-main folder into your SauceMods folder (the result should be Documents\SauceMods\arckuk-sauce-main\...). Restart Sauce, and enable the arckuk mods.
```
Documents
├── ...
├── SauceMods
│   ├── arckuk-sauce-main
│   │   ├ LICENSE
│   │   ├ README.md
│   │   ├ manifest.json
│   │   └── pages
│   │       └ ...
│   └ ...
└ ...
```
## Configuration
Add arckuk windows from from the Sauce settings window, each window can be right-clicked to bring up the settings/minimise/close buttons. Windows can be resized, and will generally resize their text based upon the window width. If the text is too large or small, there is a text size scale factor in each settings window. Left-click on Event Title, Top Bar and Power Cadence HR to reload them.

