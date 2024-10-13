"use strict";

var isInteractive = true; // true: using plotly.js | false: without plotly.js
var showConsoleLogs = true;


var basicPlot = isInteractive ? null : require("./basic_plot.js");
var interactivePlot = isInteractive ? require("./interactive_plot.js") : null;

var https = require("https");
var grib2class = require("./node_modules/grib2class");
var JpxImage = require("./jpeg2000/jpx.min.js");

var jpeg2000decoder = function (imageBytes) {
    var jpeg2000 = new JpxImage();
    jpeg2000.parse(imageBytes);
    return jpeg2000.tiles[0].items;
};

const { grib2links } = require('./grib2links.js');

// Declare groupedFiles at a higher scope
var groupedFiles = {};

function getLiveMocks() {
    // Call grib2links, expecting it to return synchronously
    var dropboxLinks = grib2links(2021); // No need for await as grib2links is now synchronous

    console.log("Fetched Dropbox Links:", dropboxLinks);

    // Ensure dropboxLinks is an array before processing
    if (!Array.isArray(dropboxLinks)) {
        console.error("dropboxLinks is not an array:", dropboxLinks);
        return groupedFiles; // Return existing state if not an array
    }

    dropboxLinks.forEach(link => {
        // Match filenames based on the expected pattern
        console.log(link.filename);
        var match = link.filename.match(/(\d{4})(\d{2})(\d{2}).*?_(uo|vo).grib2$/);
        console.log(match); // Log to see what is captured
        if (match) {
            var date = `${match[1]}-${match[2]}-${match[3]}`; // Formatted as YYYY-MM-DD

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
        "./grib2/20210101_h-CMCC--RFVL-MFSe3r1-MED-b20220901_re-sv01.00_uo.grib2",
        "./grib2/20210101_h-CMCC--RFVL-MFSe3r1-MED-b20220901_re-sv01.00_vo.grib2",
        "./grib2/20210102_h-CMCC--RFVL-MFSe3r1-MED-b20220901_re-sv01.00_uo.grib2",
        "./grib2/20210102_h-CMCC--RFVL-MFSe3r1-MED-b20220901_re-sv01.00_vo.grib2"
    ];

    // Group the files by date by extracting the YYYYMMDD part from filenames
    var groupedFiles = {};
    files.forEach(function (file) {
        var match = file.match(/(\d{4})(\d{2})(\d{2}).*?_(uo|vo).grib2$/);
        console.log("match:",match);
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


var mocks;
switch (process.env.NODE_ENV) {
    case "dropbox-data":
        mocks = getLiveMocks();
        break;
    case "local-data":
        mocks = getLocalMocks();
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



// Function to fetch data from a given URL
function fetchData(fileUrl, callback) {
    const https = require('https');

    console.log("Fetching data from:", fileUrl);
    https.get(fileUrl, function (res) {
        console.log("HTTP response status code:", res.statusCode);

        if (res.statusCode !== 200) {
            disableLoading();
            console.error("Failed to load file, status code:", res.statusCode);
            return callback(new Error("Failed to load file"), null);
        }

        var allChunks = [];
        var chunkCounter = 0; // Counter to track the order of chunks

        // Collect data in chunks
        res.on("data", function (chunk) {
            allChunks.push(chunk);
            console.log("CHECK ORDER: Received chunk #" + chunkCounter + " of size: " + chunk.length);
            chunkCounter++;
        });

        // On response end, call the parsing function
        res.on("end", function () {
            callback(null, Buffer.concat(allChunks)); // Return the combined buffer
            disableLoading(); // Hide loading indicator
        });

    }).on("error", function (err) {
        disableLoading();
        console.error("Error during HTTPS request:", err);
        callback(err, null); // Return error in callback
    });
}

// Function to parse the fetched data
function parseData(fullData, callback) {
    console.log("Total length of data for parsing:", fullData.length);
    console.log("First 100 bytes of data:", fullData.slice(0, 100));
    console.log("Last 100 bytes of data:", fullData.slice(fullData.length - 100));

    // Attempt to parse the GRIB data
    var myGrid = new grib2class({
        numMembers: 1,
        log: false,
        jpeg2000decoder: jpeg2000decoder
    });

    try {
        myGrid.parse(fullData); // Parse the buffer
        console.log("Parsed GRIB data object:", myGrid); // Log parsed object for debugging
        callback(null, myGrid); // Pass parsed data to callback
    } catch (error) {
        console.error("Error parsing GRIB data:", error);
        callback(error, null); // Handle error in callback
    }
}

// Unified function to load and parse data
function fetchAndParseData(filePromise, callback) {
    // filePromise is expected to return a resolved file URL
    filePromise.then((fileUrl) => {
        fetchData(fileUrl, function (err, fullData) {
            if (err) {
                return callback(err, null); // Handle fetch error
            }
            // Call parseData with the fetched data
            parseData(fullData, callback);
        });
    }).catch((err) => {
        console.error("Error resolving file promise:", err);
        disableLoading();
        callback(err, null); // Handle file resolution error
    });
}




// Plotting function
function plotData(myGrid, isInteractive) {
    if (isInteractive) {
        interactivePlot(myGrid, document.getElementById("interactivePlot"), beforeAfter);
    } else {
        basicPlot(myGrid, document.getElementById("basicPlot"), beforeAfter);
    }
}

// Unified function to load and plot data based on selected day and variable
function updatePlot() {
    var selectedDay = fileSelector.value;
    var selectedVariable = variableSelector.value;

    enableLoading();

    var file = mocks[selectedDay] && mocks[selectedDay][selectedVariable];
    if (!file) {
        window.alert("File for the selected date and variable is not available.");
        disableLoading();
        return;
    }

    // Fetch and parse the data
    fetchAndParseData(file, function (err, myGrid) {
        if (err) {
            window.alert("Error loading data: " + err.message);
            return;
        }

        // Plot the data after successful fetch and parse
        plotData(myGrid, isInteractive);
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

        // Update the dropdown selection
        fileSelector.value = newDay; // Update the file selector
        variableSelector.value = "uo"; // Set to a default variable

        // Trigger the update plot function
        updatePlot();
    }, updateInterval);
}

// Start the continuous update
//continuousUpdate();
