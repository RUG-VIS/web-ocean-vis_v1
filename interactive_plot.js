"use strict";

var Plotly = require("plotly.js-dist");

module.exports = function interactivePlot (grid, div, call) {
    call.before();

    var nx = grid.Nx;
    var ny = grid.Ny;

    // let"s start with deterministic data i.e. member 0
    var values = grid.DataValues[0];

    if (!values || values.length < nx * ny) {
        console.error("Invalid data values or insufficient length");
        return;
    }
    

    var k = 0;
    var x = new Array(nx);
    var y = new Array(ny);
    var z = new Array(ny);
    for (var j = 0; j < ny; j++) {
        z[j] = new Array(nx);
        for (var i = 0; i < nx; i++) {
            if (grid.TypeOfProjection === 0) { // Latitude/longitude
                var lonLat = grid.getLonLat(i, j);
                x[i] = lonLat[0];
                y[j] = lonLat[1];
            }
            z[j][i] = values[k++];
        }
    }

    var data = [{
        type: "heatmap",
        z: z,
        hovertemplate: "%{z:.1f}K<extra>(%{x}, %{y})</extra>",
        colorscale: [
            [0.0, "rgb(0, 0, 127)"],
            [0.2, "rgb(0, 0, 255)"],
            [0.5, "rgb(255, 255, 255)"],
            [0.8, "rgb(255, 0, 0)"],
            [1.0, "rgb(127, 0, 0)"]
        ],
        colorbar: {
            len: 0.5
        }
    }];

    if (grid.TypeOfProjection === 0) { // Latitude/longitude
        data[0].x = x;
        data[0].y = y;

        data.push({
            type: "scattergeo"
        });
    }

    var title = [
        "TypeOfData: " + grid.meta.TypeOfData,
        "Variable: " + grid.meta.CategoryOfParametersByProductDiscipline
    ].join("<br>");

    
    var layout = {
        xaxis: {
            visible: false,
            constrain: "domain",  // Constrain to maintain aspect ratio
            scaleanchor: "y",     // Anchor x-axis scaling to y-axis
            fixedrange: true      // Disable zoom/pan on x-axis
        },
        yaxis: {
            visible: false,
            constrain: "domain",  // Constrain to maintain aspect ratio
            scaleratio: (grid.La2 - grid.La1) / (grid.Lo2 - grid.Lo1),  // Set y-axis to match heatmap aspect ratio
            fixedrange: true      // Disable zoom/pan on y-axis
        },
        geo: {
            projection: { 
                type: 'mercator',  
                rotation: { 
                    lon: grid.Lo1 + (grid.Lo2 - grid.Lo1) / 2,  // Center longitude
                    lat: grid.La1 + (grid.La2 - grid.La1) / 2   // Center latitude
                },
                scale: 1.05  // Adjust scale as needed
            },
            lonaxis: {
                showgrid: false,
                range: [grid.Lo1, grid.Lo2],  
                dtick: (grid.Lo2 - grid.Lo1) / 5  // Longitude tick interval (adjust as needed)
            },
            lataxis: {
                showgrid: false,
                range: [grid.La1, grid.La2],  
                dtick: (grid.La2 - grid.La1) / 5  // Latitude tick interval (adjust as needed)
            },
            fitbounds: "locations",  // Ensure the heatmap fits within bounds
            showland: false,         // No land features
            showcountries: false,    // No country borders
            showcoastlines: false,   // No coastlines
            bgcolor: "rgba(0,0,0,0)",  // Transparent background
            dragmode: false            // Disable dragging
        },
        annotations: [{
            text: title,
            showarrow: false,
            xref: "paper",
            yref: "paper",
            xanchor: "left",
            yanchor: "top",
            x: 0,
            y: 0.9
        }],
        margin: {
            t: 0,
            b: 0,
            l: 0,
            r: 0
        },
        height: 800,  // Adjust height based on aspect ratio
        width: 800    // Adjust width based on aspect ratio
    };
    
    
    var config = {
        scrollZoom: false,
        responsive: true,
        modeBarButtons: [["toggleHover"]]
    };

    Plotly.newPlot(div, data, layout, config).then(function (gd) {
        Plotly.d3.select(gd).select("g.geo > .bg > rect").style("pointer-events", null);
    
        call.after();
    });
    
};
