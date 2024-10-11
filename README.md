# web-ocean-vis_v1
Customizable Web-Visualisation of Oceanic Flow Data (version/prototype 1)

Most of the work here is under ./grib2class.js which is a grib2 reader written in pure JavaScript (i.e. that runs in the browser!)

To decode the MSC grib2 files (which use JPEG2000 for compression) we must include a third-party module called jpx.js. The JavaScript file is located in ./jpeg2000/jpx.min.js, downloaded from @OHIF/image-JPEG2000.

Prequisites
Node.js, npm and a "modern" browser.

Known limitation
We don't draw a basemap (i.e the coastline overlay) on top of "regional" grib2 data
We only draw one ensemble member, even though we decode them all
Can't be exported as PNG, nor uploaded to plot.ly (like other plotly.js graphs)
How to run the "local" demo
run npm i
run npm run build:bundle-local-data
run npm start
How to push the "local" demo to GitHub pages
run npm run build:bundle-local-data
git add build/bundle.js
commit and push to origin/master, or make a PR ;)
view it at: https://archmoj.github.io/opengrib2/
How to run the "all client-side" demo
run npm i
run npm run build:bundle-dropbox-data
run npm run dropbox in one terminal tab
run npm start in another terminal tab
How to dev this thing
run npm i
for "local" demo:

run NODE_ENV='local-data' npm run dev in one terminal tab
run npm start in another terminal tab
for "all-client-side" demo:

run NODE_ENV='dropbox-data' npm run dev in one terminal tab
run npm run proxy in a 2nd terminal tab
run npm start in a 3rd terminal tab
How to make list of JavaScript dependencies licenses
run npm run build:license_list
