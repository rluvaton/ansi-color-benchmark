"use strict";


const fs = require("fs");
const {join} = require("path");

function getTextToColor() {
    // Change this for each file
    return fs.readFileSync(join(__dirname, "../generated/small.html")).toString();
}

const prettyBytes = require("pretty-bytes");
const {parseAnsi: parseAnsiOld} = require("./old");
const {parseAnsi: parseAnsiOldUpdated} = require("./old-updated");


function printMemory() {
    console.log(
        Object.fromEntries(
            Object.entries(process.memoryUsage())
                .map(([key, value]) => [key, prettyBytes(value)])
        )
    )

}

function runOld(getTextToColor) {
    console.time("colorizePre Old");
    const spans = parseAnsiOld(getTextToColor());
    printMemory();
    console.timeEnd("colorizePre Old");

    console.log(spans.length);
}


function runOldUpdated(getTextToColor) {
    console.time("colorizePre old updated");

    const spansIterator = parseAnsiOldUpdated(getTextToColor);
    let i = 0;
    for (const span of spansIterator) {
        // avoid dead code elimination
        if (span) {
            i++;
        }

        if (i % 10000 === 0) {
            printMemory();
        }
    }
    console.timeEnd("colorizePre old updated");

    console.log(i);
}

// runOld(getTextToColor);
runOldUpdated(getTextToColor);
