"use strict";

const https = require("https");
const http = require("http");
var Plotly = require("plotly.js-dist");

var kml2links = require("./kml2links");

var grib2class = require("./node_modules/grib2class");
var JpxImage = require("./jpeg2000/jpx.min.js");
const { grib2links} = require('./grib2links.js');


// Declare variables for local and Dropbox data modes
var isInteractive = true; // true: using Plotly.js | false: without Plotly.js
var showConsoleLogs = true;


var basicPlot = isInteractive ? null : require("./basic_plot.js");
var interactivePlot = isInteractive ? require("./interactive_plot.js") : null;

var jpeg2000decoder = function (imageBytes) {
    var jpeg2000 = new JpxImage();
    jpeg2000.parse(imageBytes);
    return jpeg2000.tiles[0].items;
};

// Declare groupedFiles for Dropbox or local files
var kmlFilePaths = []; // Array to store Dropbox or local KML paths with ages
var dropboxKmlFiles = [];
let dataMode;
// Declare groupedFiles at a higher scope
var groupedFiles = {};



// Utility function to log messages
function echo(txt) {
    if (showConsoleLogs) console.log(txt);
}

// Fetch KML files from Dropbox and extract the age from the filename
function getDropboxKmlFiles() {
    console.log("Fetching KML files from Dropbox...");
    
    kml2links((err, dropboxLinks) => {
        if (err) {
            console.error("Error fetching Dropbox KML links:", err);
            return; // Exit the function if there's an error
        }

        dropboxLinks.forEach(link => {
            const { filename, generatedDropboxLink } = link;
            const ageMatch = filename.match(/age_(\d+)/); // Extract age from filename (e.g., age_123)
            if (ageMatch) {
                console.log("Found ageMatch:", ageMatch);
                const ageNum = ageMatch[1]; // Get the age number as a string
                kmlFilePaths.push({ age: ageNum, url: generatedDropboxLink });
            }
        });

        populateAgeSelector(); // Populate the age selector after processing the links
        echo("Using KML data fetched from Dropbox");
        dataMode = "dropbox"; // Set the data mode to Dropbox
    });
}

// Fetch KML files from local storage and extract the age
function getLocalKmlFiles() {
    const localFiles = [
        "./kml/benchmark_doublegyre_noMPI_p_n3660_365d_fwd_add_age_0.kml",
        "./kml/benchmark_doublegyre_noMPI_p_n3660_365d_fwd_add_age_1.kml",
        "./kml/benchmark_doublegyre_noMPI_p_n3660_365d_fwd_add_age_2.kml",
        "./kml/benchmark_doublegyre_noMPI_p_n3660_365d_fwd_add_age_5.kml",
        "./kml/benchmark_doublegyre_noMPI_p_n3660_365d_fwd_add_age_6.kml",
        "./kml/benchmark_doublegyre_noMPI_p_n3660_365d_fwd_add_age_7.kml"
    ];

    localFiles.forEach(filePath => {
        const ageMatch = filePath.match(/age_(\d+)/); // Extract age from filename (e.g., age_123)
        if (ageMatch) {
            const ageNum = ageMatch[1];
            kmlFilePaths.push({ age: ageNum, url: filePath });
        }
    });

    return kmlFilePaths;
}

// Determine which data mode to use (local or Dropbox)
function loadKmlFilePaths() {
    switch (process.env.NODE_ENV) {
        case "dropbox-data":
            getDropboxKmlFiles(); // Call the modified function
            dataMode = "dropbox"; // Set dataMode for Dropbox
            break;
        case "local-data":
            getLocalKmlFiles(); // Assume this function does not change
            echo("Using local KML data");
            dataMode = "local";
            populateAgeSelector(); // Populate age selector directly
            break;
        default:
            console.error("BAD BUNDLE");
            break;
    }
}

// Function to load KML from either Dropbox or local storage
function loadKMLFile(kmlFilePath) {
    if (process.env.NODE_ENV === "dropbox-data") {
        return new Promise((resolve, reject) => {
            https.get(kmlFilePath, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to fetch file: ${res.statusCode}`));
                    return;
                }
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => { resolve(data); });
            }).on('error', reject);
        });
    } else {
        return fetch(kmlFilePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }
                return response.text();
            });
    }
}

// Populate age selector based on the available KML files
function populateAgeSelector() {
    const ageSelector = document.getElementById("age-selector");
    ageSelector.innerHTML = ''; // Clear existing options

    kmlFilePaths.forEach(({ age }) => {
        const option = document.createElement("option");
        option.value = age;
        option.textContent = `Age ${age}`;
        ageSelector.appendChild(option);
    });
}

// Parse KML file content
function parseKML(kmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, "text/xml");

    const coordinates = [];
    const trackNamespace = "http://www.google.com/kml/ext/2.2";
    const gxNamespace = "http://www.google.com/kml/ext/2.2";
    const tracks = xmlDoc.getElementsByTagNameNS(trackNamespace, "Track");

    for (let i = 0; i < tracks.length; i++) {
        const coordElements = tracks[i].getElementsByTagNameNS(gxNamespace, "coord");
        for (let j = 0; j < coordElements.length; j++) {
            const coords = coordElements[j].textContent.trim();
            const [lon, lat] = coords.split(" ").map(Number);
            coordinates.push({ lon, lat });
        }
    }

    return coordinates;
}

// Load and visualize KML file based on selected age
document.getElementById("age-selector").addEventListener("change", function () {
    const selectedAge = this.value;
    const kmlFile = kmlFilePaths.find(({ age }) => age === selectedAge);

    if (kmlFile) {
        loadKMLFile(kmlFile.url)
            .then(kmlText => {
                const coordinates = parseKML(kmlText);
                visualizeScatterPlot(coordinates);
            })
            .catch(error => {
                console.error("Error loading or parsing KML file:", error);
            });
    } else {
        console.error("Selected KML file not found.");
    }
});

// Visualize the KML data as a scatter plot
function visualizeScatterPlot(coordinates) {
    const lon = coordinates.map(coord => coord.lon);
    const lat = coordinates.map(coord => coord.lat);

    const data = [{
        x: lon,
        y: lat,
        mode: 'markers',
        type: 'scatter',
        marker: {
            size: 8,
            color: 'blue',
            opacity: 0.7,
        }
    }];

    const layout = {
        title: 'Scatter Plot of KML Data',
        xaxis: { title: 'Longitude', showgrid: true, zeroline: false },
        yaxis: { title: 'Latitude', showgrid: true, zeroline: false }
    };

    Plotly.newPlot('interactivePlot', data, layout);
}

// Initialize the age selector on page load
window.onload = function () {
    loadKmlFilePaths(); // Fetch and populate the selector based on the data mode
};

//---------------------------------------------------


function getLiveMocksGrib() {
    // Call grib2links, expecting it to return synchronously
    var dropboxLinks = grib2links(2021); // No need for await as grib2links is now synchronous

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
        var match = link.filename.match(/(\d{4})(\d{2})(\d{2}).*?_(uo|vo).grib2$/);
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
module.exports = { getLiveMocksGrib };




// Automatically extract dates from file names
function getLocalMocksGrib() {
    var files = [
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220101_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220101_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220102_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220102_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220103_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220103_vo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220104_uo.grib2",
        "./grib2/metoffice_foam1_amm7_NWS_SSC_hi20220104_vo.grib2"
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

// Determine which data mode to use (local or Dropbox)
var mocks;

switch (process.env.NODE_ENV) {
    case "dropbox-data":
        mocks = getLiveMocksGrib();
        echo("Using grib2 data fetched from Dropbox");
        break;
    case "local-data":
        mocks = getLocalMocksGrib();
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
    console.log("----mocks:",mocks);
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

module.exports = { createDropDown };
//function available globally
window.createDropDown = createDropDown;


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

    if (mocks[selectedDay]) {
        var file = mocks[selectedDay][selectedVariable];
    } else {
        window.alert("Selected date and variable are not available.");
        disableLoading();
        return;
    }

    if (!file) {
        window.alert("File for the selected date and variable is not available.");
        disableLoading();
        return;
    }

    var myGrid = new grib2class({
        numMembers: 1, // Assuming deterministic models, otherwise adjust for ensembles
        log: false,
        jpeg2000decoder: jpeg2000decoder
    });

    console.log("Starting request for file:", file);

    if (process.env.NODE_ENV === "dropbox-data") {
        // If datamode is dropbox, file is a promise, so we resolve it
        file.then((fileUrl) => {
            // Use https.get for Dropbox
            const https = require('https');
            https.get(fileUrl, function (res) {

                console.log("HTTP response status code:", res.statusCode);

                if (res.statusCode !== 200) {
                    disableLoading();
                    console.error("Failed to load file, status code:", res.statusCode);
                    return;
                }

                var allChunks = [];

                //might be problematic

                res.on("data", function (chunk) {
                    console.log("Received chunk of size:", chunk.length);
                    allChunks.push(chunk);
                });

                res.on("end", function () {
                    // Combine all the chunks into one buffer
                    const fullData = Buffer.concat(allChunks);
                    console.log("Total length of allChunks:", fullData.length);
                    console.log("Sample of data:", fullData.slice(0, 100)); // log first 100 bytes

                    // Attempt to parse
                    try {
                        myGrid.parse(fullData);
                        console.log("Parsed GRIB data object:", myGrid); // Check the parsed object
                    } catch (error) {
                        console.error("Error parsing GRIB data:", error);
                    }

                    console.log("check mygrid:",myGrid); // Make sure myGrid is populated correctly before this callf
//-----------------------------------------------------try to separate
                    if (isInteractive) {
                        interactivePlot(myGrid, document.getElementById("interactivePlot"), beforeAfter);
                    } else {
                        basicPlot(myGrid, document.getElementById("basicPlot"), beforeAfter);
                    }

                    disableLoading(); // Hide the loading spinner when done
                });

            }).on("error", function (err) {
                disableLoading();
                window.alert("Error loading data: " + err.message);
            });

        }).catch(err => {
            disableLoading();
            console.error("Error resolving file URL:", err);
        });

    } else {
        http.get(file, function (res, err) {
            if (err) {
                disableLoading();
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
            window.alert(err);
        }); 
    }
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

// continuousUpdate(); // Start continuous updates
