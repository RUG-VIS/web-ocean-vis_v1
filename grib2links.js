const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch'); // Ensure fetch is available

const dbx = new Dropbox({
    accessToken: 'sl.B_aJ5JbWLEx-UpTRwmwU014wEuSRHKyLc43KtbEpp8VJ13i9WtiRVMVWQFjlkW2AGMbPJI4IvS2jheqlqqLnCJjdVC68lmJfWW6wWP_GX9nAaILfHD0tmUAoXYjMuG7-DIHdBbqsFAaMFJxERorWvGg', // Use your real token here
    fetch: fetch,
});

// Generate filenames for u-velocity and v-velocity
function generateFilePaths(year, month, day) {
    // Ensure month and day are two digits
    const YYYY = year;
    const MM = String(month).padStart(2, '0'); // Ensure month is two digits
    const DD = String(day).padStart(2, '0'); // Ensure day is two digits

    return [
        `/MediterraneanGrib/${YYYY}${MM}${DD}_h-CMCC--RFVL-MFSe3r1-MED-b20220901_re-sv01.00_uo.grib2`,
        `/MediterraneanGrib/${YYYY}${MM}${DD}_h-CMCC--RFVL-MFSe3r1-MED-b20220901_re-sv01.00_vo.grib2`
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

