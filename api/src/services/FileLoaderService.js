'use strict';

let util = require('util');
let fs = require('fs');
let glob = require('glob-all');
let bunyan = require('bunyan');
let log = bunyan.createLogger({name: 'helloapi'});

/**
 * This Controller is for building the response
 */
let FileLoaderService = function() {

    /**
     *
     */
    function _findTheFileToLoad(paths) {

        let files = [];

        let fileMatch = false;
        paths.forEach(function(element) {
            if(fileMatch) {
                return;
            }

            let rootPath = 'data' + element;
            files = glob.sync(rootPath);
            if(files.length > 0) {
                log.info("FILE MATCH! : " + rootPath + " - " + util.inspect(files));
                fileMatch = true;
            }
        });

        if(files.length > 0) {
            log.error(files);
            let file = files[0];
            return file;
        }

        return null;
    }

    /**
     *
     */
    function _load(path) {

        var contents = fs.readFileSync(path, 'utf8');
        let jsonContent = null;
        let httpCode = 404;
        let notices = [];

        httpCode = _extractHttpCodeFromFileName(path);

        try {
            if(contents.length > 0) {
                jsonContent = JSON.parse(contents);
            } else {
                notices.push('The mock file is empty');
            }
        } catch(e) {
            // Log (not valid JSON)
            notices.push('The mock file is not empty but contains invalid JSON');
        }

        let data = {
            rawContent: jsonContent,
            httpCode: httpCode,
            notices: notices
        }
        return data;
    }

    function _extractHttpCodeFromFileName(filename) {
        let httpCode = 200;

        let matches = filename.match(/\.([0-9]{3})\.[a-z0-9]+$/i);
        console.log(matches);
        if(matches != null) {
            httpCode = matches[1];
        }

        return httpCode;
    }

    return {
        find: _findTheFileToLoad,
        load: _load
    }

}

module.exports = FileLoaderService;
