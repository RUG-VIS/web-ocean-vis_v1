const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch'); // Ensure fetch is available

const dbx = new Dropbox({
    accessToken: 'sl.B-lhznPA9aiszzrFqB8pzcWMhEXJVrV8WXiQTp87QynbzOUubU3_3l60Ms-I7G6UJnYwLGgi--Ag6AQe09AmWwEBZP8X50jftKhDH4OiFDhpf5y-S_-LWWhh2aW7svc4p4egtL0irKEPKlMDMw9-yVg', // Replace with your real token
    fetch: fetch,
});

// Generate filenames based on the specific format
function generateKmlFilePath(age) {
    return `/trajectories/Google/benchmark_doublegyre_noMPI_p_n3660_365d_fwd_add_age_${age}.kml`; // Adjust the path accordingly
}

// Function to get a Dropbox link for a given file path
async function getDropboxLink(filePath) {
    try {
        const response = await dbx.filesGetTemporaryLink({ path: filePath });
        return response.result.link; // Return the actual Dropbox link
    } catch (error) {
        if (error.status === 409) {
            console.warn(`File not found for path: ${filePath}`); // Gracefully handle the 409 error
        } else {
            console.error(`Error fetching link for ${filePath}:`, error);
        }
        return null; // Return null to indicate the file doesn't exist or an error occurred
    }
}

// Function to generate links for KML files
function kml2links(callback) {
    const results = []; // Array to hold the result objects

    // Loop through each age value from 0 to 5532
    let age = 0;

    function processNextAge() {
        if (age > 55) {
            // Print the entire array of results and call the callback with the results
            console.log("All Dropbox Links for KML files:", JSON.stringify(results, null, 2)); // Pretty print
            return callback(null, results); // Call the callback with the results
        }

        const filePath = generateKmlFilePath(age); // Generate the file path for the current age

        // Log generated file path for debugging
        console.log(`Checking file path for age ${age}:`, filePath);

        // Get the Dropbox link asynchronously, then move to the next age
        getDropboxLink(filePath).then(linkResult => {
            // Log the link obtained for this age
            console.log(`Link obtained for age ${age}:`, linkResult);

            // Add the link and filename to results if valid
            if (linkResult) {
                results.push({
                    generatedDropboxLink: linkResult, // Dropbox link
                    filename: filePath // Corresponding filename
                });
            } else {
                console.warn(`Skipping invalid link for ${filePath}`); // Log the issue
            }

            // Move to the next age
            age++;
            processNextAge();
        }).catch(err => {
            console.error(`Error fetching Dropbox link for age ${age}:`, err);
            age++;
            processNextAge();
        });
    }

    // Start processing from age 0
    processNextAge();
}

// Usage: Call the kml2links function with a callback
kml2links((err, links) => {
    if (err) {
        console.error("Error fetching KML links:", err);
    } else {
        console.log("Fetched KML links:", links);
        return links;
    }
});


module.exports = kml2links; // Ensure you export the function
