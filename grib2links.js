const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch'); // Ensure fetch is available

const dbx = new Dropbox({
    accessToken: 'sl.B91LUsLLfGqMsKAvSJE115zwMAnVsdXzUpHut-T8AdsFouYHQX6R9bhVOKUR5RlAPjuFYGeXQIPgtCj0Id9np8zPCZw2_K4ZhzdliDclssDI2_NYsgXatp04b8Whi0tvR68Cf3MW2l1pnv3OfndCXxY', // Use your real token here
    fetch: fetch,
});

// Function to generate file paths for a single date
function generateFilePaths(year, month, day) {
    const YYYY = String("0000" + year).slice(-4);
    const MM = String("00" + month).slice(-2);
    const DD = String("00" + day).slice(-2);
    
    // Generate filenames for u-velocity and v-velocity
    return [
        `/gribnewdata/metoffice_foam1_amm7_NWS_SSC_hi${YYYY}${MM}${DD}_uo.grib2`,
        `/gribnewdata/metoffice_foam1_amm7_NWS_SSC_hi${YYYY}${MM}${DD}_vo.grib2`
    ];
}

// Function to get a Dropbox link for a given file path
async function getDropboxLink(filePath) {
    try {
        const response = await dbx.filesGetTemporaryLink({ path: filePath });
        return response.result.link; // Return the actual Dropbox link
    } catch (error) {
        console.error(`Error fetching link for ${filePath}:`, error);
        return null;
    }
}

// Function to generate links for GRIB files
function grib2links(year) {
    const results = []; // Array to hold the result objects

    // Loop through each month and day of the year
    for (let month = 1; month <= 2; month++) {
        const daysInMonth = new Date(year, month, 0).getDate(); // Get the number of days in the month
        for (let day = 1; day <= daysInMonth; day++) {
            const filePaths = generateFilePaths(year, month, day);
            
            // Log generated file paths for debugging
            console.log(`Checking file paths for ${year}-${month}-${day}:`, filePaths);

            // Loop through each file path synchronously
            const dropboxLinks = filePaths.map(filePath => getDropboxLink(filePath)); // Get links directly

            // Log the links obtained for this date
            console.log(`Links obtained for ${year}-${month}-${day}:`, dropboxLinks);

            // Combine links and filenames into objects and push them into results
            dropboxLinks.forEach((linkResult, index) => {
                if (linkResult) { // Only add valid links
                    results.push({
                        generatedDropboxLink: linkResult, // Dropbox link
                        filename: filePaths[index] // Corresponding filename
                    });
                } else {
                    console.warn(`Skipping invalid link for ${filePaths[index]}`); // Log the issue
                }
            });
        }
    }

    // Print the entire array of results
    console.log("All Dropbox Links for the year:", JSON.stringify(results, null, 2)); // Pretty print
    return results; // Return the array of objects
}


// Export the grib2links function for use in other files
module.exports = { grib2links };

