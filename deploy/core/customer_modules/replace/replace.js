var fs = require("fs"),
    path = require("path"),
    Buffer = require('buffer').Buffer;


var binarytypes = /\.tar\.gz|\.zip|\.pyc|\.jar|\.class|\.DS_Store|\.dll|\.png|\.gif|\.jpg|\.mp4|\.mp3|\.avi|\.wmv|\.file/;
var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
};
var emRegex = /__em__/g;
var endEmRegex = /__\|em__/g;

function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
        return entityMap[s];
    });
}

function canSearch(file, isFile) {
    return true;
}

function openBytes(file, stats) {
    var cur = fs.openSync(file, "r");
    var size = 1000;
    if(!stats.size) return;
    if(stats.size < size) {
        size = stats.size;
    }
    var buffer = new Buffer(size);
    fs.readSync(cur, buffer, 0, size, 0);
    fs.closeSync(cur);
    return buffer.toString().indexOf("\0\0") > -1;
}

function binaryFile(file, stats) {
    return file.match(binarytypes) || openBytes(file, stats);
}

function replacizeFileSync(file, options) {
    if(!fs.existsSync(file)) return;

    options.totalFiles++;
    var stats = fs.lstatSync(file);
    if (stats.isSymbolicLink()) {
        // don't follow symbolic links for now
        return;
    }
    var isFile = stats.isFile();
    if (isFile) {
        if(!binaryFile(file, stats)) {
            var text = fs.readFileSync(file, "utf-8");
            text = replacizeText(text, file, options);
            if (options.canReplace && text !== null) {
                fs.writeFileSync(file, text);
            }
        } else {
            //console.log("Ignoring binary file: " + file);
        }
    }
    else if (stats.isDirectory() && options.recursive) {
        var files = fs.readdirSync(file);
        for (var i = 0; i < files.length; i++) {
            if(!options.exclude || !files[i].match(options.exclude)) {
                replacizeFileSync(path.join(file, files[i]), options);
            }
        }
    }
}

function replacizeText(text, file, options) {
    if (!text.match(options.regex)) {
        return null;
    }
    var results = [];
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.match(options.regex)) {
            line = line.replace(options.regex, "__em__$&__|em__");
            line = escapeHtml(line);
            line = line.replace(endEmRegex, "</em>");
            line = line.replace(emRegex, "<em>");
            results.push({line: i+1, text: line.slice(0,options.limit)});
        }
    }
    options.result({file: file, results: results});
    if (options.canReplace) {
        return text.replace(options.regex, options.replacement);
    }
}

var regexEscape = function(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = function(options) {

    options.limit = 400;
    options.totalFiles = 0;
    options.time = (new Date()).getTime();

    var flags = "gm"; // global multiline
    if (options.ignoreCase) {
        flags += "i";
    }

    if (options.regex instanceof RegExp) {
        options.regex = new RegExp(options.regex.source, flags);
    } else {
        options.regex = new RegExp(regexEscape(options.regex), flags);
    }

    options.canReplace = options.replacement !== null && options.replacement !== undefined;

    for (var i = 0; i < options.paths.length; i++) {
        replacizeFileSync(options.paths[i], options);
    }

    options.time = (new Date()).getTime() - options.time;
    return options;

};