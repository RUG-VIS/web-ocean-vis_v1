"use strict";

var isInteractive = true; // true: using plotly.js | false: without plotly.js
var showConsoleLogs = true;

var basicPlot = isInteractive ? null : require("./basic_plot.js");
var interactivePlot = isInteractive ? require("./interactive_plot.js") : null;

var http = require("http");
var grib2class = require("./node_modules/grib2class");
var JpxImage = require("./jpeg2000/jpx.min.js");

var jpeg2000decoder = function (imageBytes) {
    var jpeg2000 = new JpxImage();
    jpeg2000.parse(imageBytes);
    return jpeg2000.tiles[0].items;
};

const { grib2links} = require('./grib2links.js');

// Declare groupedFiles at a higher scope
var groupedFiles = {};

function getLiveMocks() {
    // Call grib2links, expecting it to return synchronously
    var dropboxLinks = grib2links(2022); // No need for await as grib2links is now synchronous

    console.log("hello");
    console.log("Fetched Dropbox Links:", dropboxLinks);
    console.log("hello again");

    // Ensure dropboxLinks is an array before processing
    if (!Array.isArray(dropboxLinks)) {
        console.error("dropboxLinks is not an array:", dropboxLinks);
        return groupedFiles; // Return existing state if not an array
    }

    dropboxLinks.forEach(link => {
        // Match filenames based on the expected pattern
        var match = link.filename.match(/hi(\d{4})(\d{2})(\d{2})_(uo|vo)\.grib2/);
        if (match) {
            var date = `${match[1]}-${match[2]}-${match[3]}`; // Fixed string interpolation

            // Initialize the groupedFiles for the date if not already present
            if (!groupedFiles[date]) {
                groupedFiles[date] = {
                    uo: null,
                    vo: null
                };
            }

            // Assign the generated Dropbox link to the appropriate variable (uo or vo)
            if (match[4] === "uo") {
                groupedFiles[date].uo = link.generatedDropboxLink; // Use generatedDropboxLink
            } else if (match[4] === "vo") {
                groupedFiles[date].vo = link.generatedDropboxLink; // Use generatedDropboxLink
            }
        }
    });

    console.log("table:");
    console.table(groupedFiles); // Pretty print

    return groupedFiles; // Return the grouped files by date and variable
}


// Export the function for use in other modules
module.exports = { getLiveMocks };




// Automatically extract dates from file names
function getLocalMocks() {
    var files = [
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220101_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220101_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220102_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220102_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220103_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220103_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220104_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220104_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220105_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220105_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220106_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220106_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220107_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220107_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220108_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220108_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220109_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220109_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220110_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220110_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220111_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220111_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220112_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220112_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220113_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220113_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220114_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220114_vo.grib2"
        
    ];

    // Group the files by date by extracting the YYYYMMDD part from filenames
    var groupedFiles = {};
    files.forEach(function (file) {
        var match = file.match(/hi(\d{4})(\d{2})(\d{2})_(uo|vo)\.grib2$/);
        if (match) {
            var date = match[1] + "-" + match[2] + "-" + match[3]; // Format as YYYY-MM-DD
            if (!groupedFiles[date]) {
                groupedFiles[date] = {
                    uo: null,
                    vo: null
                };
            }
            if (match[4] === "uo") {
                groupedFiles[date].uo = file;
            } else if (match[4] === "vo") {
                groupedFiles[date].vo = file;
            }
        }
    });

    return groupedFiles; // Object with dates as keys and uo/vo files as values
}

function echo(txt) {
    if (showConsoleLogs) console.log(txt);
}

echo("process.env.NODE_ENV='" + process.env.NODE_ENV + "'");
var mocks;
switch (process.env.NODE_ENV) {
    case "dropbox-data":
        mocks = getLiveMocks();
        echo("Using grib2 data fetched from Dropbox");
        break;
    case "local-data":
        mocks = getLocalMocks();
        echo("Using local (already downloaded) grib2 data");
        break;
    default:
        console.error("BAD BUNDLE");
        break;
}

// Create dropdowns for day and variable selection
var fileSelector = document.getElementById("file-selector");
var variableSelector = document.getElementById("variable-selector");


var createDropDown = function () {
    for (var day in mocks) {
        var opt = document.createElement("option");
        opt.value = day; // Set the date as the option value
        opt.text = day;  // Display the date as the option text
        fileSelector.append(opt);
    }

    fileSelector.addEventListener("change", function (e) {
        updatePlot(); // Update the plot when a new date is selected
    });

    variableSelector.addEventListener("change", function (e) {
        updatePlot(); // Update the plot when a new variable is selected
    });
};

createDropDown();

var loading = document.getElementById("loading");

var enableLoading = function () {
    loading.style.display = "block";
};

var disableLoading = function () {
    loading.style.display = "none";
};

var beforeAfter = {
    before: enableLoading,
    after: disableLoading
};

// Unified function to load and plot data based on selected day and variable
function updatePlot() {
    var selectedDay = fileSelector.value;
    var selectedVariable = variableSelector.value;

    echo("Loading data for day: '" + selectedDay + "' and variable: '" + selectedVariable + "'");
    enableLoading();

    //var file = mocks[selectedDay] && mocks[selectedDay][selectedVariable]; // Get the selected file


    if (mocks[selectedDay]) {
        var file = mocks[selectedDay][selectedVariable];
    } else{
        window.alert("selected date and variable is not available.");
        disableLoading();
        return;
    }


    if (!file) {
        window.alert("File for the selected date and variable is not available.");
        disableLoading();
        return;
    }

//here

    var myGrid = new grib2class({
        numMembers: 1, // Assuming deterministic models, otherwise adjust for ensembles
        log: false,
        jpeg2000decoder: jpeg2000decoder
    });

    http.get(file, function (res, err) {
        if (err) {
            disableLoading();
            console.error("Error loading file:", err);
        }
        var allChunks = [];
        res.on("data", function (chunk) {
            allChunks.push(chunk);
        });
        res.on("end", function () {
            myGrid.parse(Buffer.concat(allChunks));
            echo(myGrid);

            if (isInteractive) {
                interactivePlot(myGrid, document.getElementById("interactivePlot"), beforeAfter);
            } else {
                basicPlot(myGrid, document.getElementById("basicPlot"), beforeAfter);
            }

            disableLoading(); // Hide the loading spinner when done
        });
    }).on("error", function (err) {
        disableLoading();
        window.alert("Error loading data: " + err);
    });
}

window.updatePlot = updatePlot;

// Load data for the first available day and variable by default
updatePlot(); // Automatically select the first available day and variable

// Continuous update logic
var selectedDays = Object.keys(mocks);
var currentIndex = 0;
var updateInterval = 5000; // 5 seconds

function continuousUpdate() {
    setInterval(function () {
        // Update to the next day
        currentIndex = (currentIndex + 1) % selectedDays.length; // Cycle through days
        var newDay = selectedDays[currentIndex]; // Get the new day

        // Update the dropdown value
        fileSelector.value = newDay; 
        updatePlot(); // Call updatePlot to refresh the plot
    }, updateInterval);
}

continuousUpdate(); // Start continuous updates
