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

// Declare groupedFiles at a higher scope
var groupedFiles = {};

var plotDiv = document.getElementById('interactivePlot');
// Create dropdowns for day and variable selection
var fileSelector = document.getElementById("file-selector");
var variableSelector = document.getElementById("variable-selector");
var age_selector = document.getElementById("age-selector");


// Fetch KML files from Dropbox and extract the age from the filename
function getDropboxKmlFiles(callback) {
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

        populateAgeSelector(callback); // Populate the age selector after processing the links
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
function loadKmlFilePaths(callback) {
    switch (process.env.NODE_ENV) {
        case "dropbox-data":
            getDropboxKmlFiles(callback); // Call the modified function
            break;
        case "local-data":
            getLocalKmlFiles(); // Assume this function does not change
            populateAgeSelector(callback); // Populate age selector directly
            break;
        default:
            console.error("BAD BUNDLE");
            break;
    }
    //callback();
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
function populateAgeSelector(callback) {
    const ageSelector = document.getElementById("age-selector");
    ageSelector.innerHTML = ''; // Clear existing options

    kmlFilePaths.forEach(({ age }) => {
        const option = document.createElement("option");
        option.value = age;
        option.textContent = `Particle ${age}`;
        ageSelector.appendChild(option);
    });
    callback();
}

// Parse KML file content
function parseKML(kmlText) {
    console.log("Raw KML text:", kmlText);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, "text/xml");

    const coordinates = [];
    const trackNamespace = "http://www.google.com/kml/ext/2.2";
    const gxNamespace = "http://www.google.com/kml/ext/2.2";
    const tracks = xmlDoc.getElementsByTagNameNS(trackNamespace, "Track");

    // Assuming there is always one Track element
    const track = xmlDoc.getElementsByTagNameNS(trackNamespace, "Track")[0];

    if (track) {
        const coordElements = track.getElementsByTagNameNS(gxNamespace, "coord");
        const timeStamps = track.getElementsByTagName("datetime");
        var selectedDay = fileSelector.value;
        console.log("selected day:",selectedDay);

        for (let j = 0; j < coordElements.length; j++) {
            console.log("coordElements.length:",coordElements.length);
            console.log("myElement:", timeStamps[j]);
            var currentTimestamp = timeStamps[j].textContent.trim();
            if (currentTimestamp.includes(selectedDay)) {
                console.log("particle data found for selected date");
                const coords = coordElements[j].textContent.trim();
                const [lon, lat] = coords.split(" ").map(Number);
                coordinates.push({ lon, lat });
            }
        }
    } else {
        console.warn("No Track element found in the KML file.");
    }

    return coordinates;
}



function updateScatter(callback) {
    var selectedAge = age_selector.value;
    const kmlFile = kmlFilePaths.find(({ age }) => age === selectedAge);
    if (kmlFile) {
        loadKMLFile(kmlFile.url)
            .then(kmlText => {
                const coordinates = parseKML(kmlText);
                console.log("try updatescatter");
                visualizeScatterPlot(coordinates);
                if (typeof callback === 'function') {
                    callback();
                }
            })
            .catch(error => {
                console.error("Error loading or parsing KML file:", error);
            });
    } else {
        console.error("Selected KML file not found.");
    }
}


// Visualize the KML data as a scatter plot
function visualizeScatterPlot(coordinates) {
    const lon = coordinates.map(coord => coord.lon);
    const lat = coordinates.map(coord => coord.lat);
    console.log("try visualize scatter");
    console.log("lon:",lon);
    console.log("lat:",lat);

    const data = [{
        x: lon,
        y: lat,
        mode: 'markers',
        type: 'scatter',
        marker: {
            size: 7,
            color: 'green',
            opacity: 0.7,
        }
    }];

    setTimeout(() => { // Delay plotting
        console.log("plotDiv scatter:", plotDiv);

        if (plotDiv.data && plotDiv.data.length > 1) {
            console.log("we deleted something");
            Plotly.deleteTraces(plotDiv, 1); // Delete the scatter trace
        }

        Plotly.addTraces(plotDiv, data); // Add new scatter plot data
    }, 1); // 200ms delay

}

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


var createDropDown = function () {
    for (var day in mocks) {
        var opt = document.createElement("option");
        opt.value = day; // Set the date as the option value
        opt.text = day;  // Display the date as the option text
        fileSelector.append(opt);
    }

    fileSelector.addEventListener("change", function (e) {
        clearInterval(updateIntervalId); // Clear the interval
        updatePlot(updateScatter); // Update the plot when a new date is selected
    });

    variableSelector.addEventListener("change", function (e) {
        clearInterval(updateIntervalId); // Clear the interval
        updatePlot(updateScatter); // Update the plot when a new variable is selected
    });

    // Load and visualize KML file based on selected age
    age_selector.addEventListener("change", function (e) {
        updateScatter();
    });

};


module.exports = { createDropDown };



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
function updatePlot(callback) {
    var selectedDay = fileSelector.value;
    var selectedVariable = variableSelector.value;


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
                    // console.log("Received chunk of size:", chunk.length);
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

                    //console.log("check mygrid:",myGrid); // Make sure myGrid is populated correctly before this callf

                    //-----------------------------------------------------try to separate

                    console.log("plotDiv heat:",plotDiv);

                    if (isInteractive) {
                        interactivePlot(myGrid, plotDiv, beforeAfter);
                    } else {
                        basicPlot(myGrid, document.getElementById("basicPlot"), beforeAfter);
                    }

                    disableLoading(); // Hide the loading spinner when done
                    if (typeof callback === 'function') {
                        callback();
                    }
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
               
    
                if (isInteractive) {
                    interactivePlot(myGrid, plotDiv, beforeAfter);
                } else {
                    basicPlot(myGrid, document.getElementById("basicPlot"),beforeAfter);
                }

                disableLoading(); // Hide the loading spinner when done
                callback();
            });
        }).on("error", function (err) {
            disableLoading();
            window.alert(err);
        }); 
    }
}


// Continuous update logic
var currentIndex = 0;

let updateIntervalId; // Variable to store the interval ID

function continuousUpdate() {
    currentIndex = (currentIndex + 1) % selectedDays.length; // Cycle through days
    var newDay = selectedDays[currentIndex]; // Get the new day
    console.log("Updating to new day:", newDay);  // Log the day being updated

    fileSelector.value = newDay; // Update the dropdown value
    updatePlot(function () {
        console.log("Calling updateScatter after plot update");
        updateScatter(function () {
            console.log("Calling continuousUpdate again");
            continuousUpdate(); // Call continuousUpdate again after both are done
        });
    });
}

// Calls ------

var mocks;

switch (process.env.NODE_ENV) {
    case "dropbox-data":
        mocks = getLiveMocksGrib();
        break;
    case "local-data":
        mocks = getLocalMocksGrib();
        break;
    default:
        console.error("BAD BUNDLE");
        break;
}

var selectedDays = Object.keys(mocks);

//window.createDropDown = createDropDown;
createDropDown();


//window.updatePlot = updatePlot;
//updatePlot(); // Automatically select the first available day and variable

// Load KML file paths first, then start continuous updates
window.onload = function () {
    console.log("1--");
    loadKmlFilePaths(function () {
        continuousUpdate(); // Start continuous updates only after KML paths are loaded
        console.log("2--");
    });
};
