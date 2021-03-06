'use strict';

const FilePathBuilderService = require('../services/FilePathBuilderService.js');
const FileLoaderService = require('../services/FileLoaderService.js');
const Toolbox = require('../utils/Toolbox.js');

/**
 * This controller is for processing the requests and building the response
 */
class MockCtrl {
  /**
   * Constructor.
   */
  constructor({Configuration, Logger}) {
    this.Configuration = Configuration;
    this.Logger = Logger;

    this.pathBuilder = new FilePathBuilderService({Configuration, Logger});
    this.fileLoader = new FileLoaderService({Configuration, Logger});
  }

  /**
   * Build a response based on the user request.
   * @param request
   * @param response
   */
  buildResponse(request, response) {
    let method = request.method;
    let httpCode = 201;
    let responseHeaders = {};
    let rawContent = null;
    let extension = 'json';
    let location = null;
    let delay = 1;

    // Get the URL
    const url = Toolbox.removeTrailingSlash(request.url);
    responseHeaders['X-Mockiji-Url'] = url;
    this.Logger.info({
      'type': 'request',
      'method': method,
      'url': url
    }, `Received a request: "${method} ${url}"`);

    // Retreive authorization token if needed
    this._handleToken(request);

    // replace dynamic markers
    let customUrl = this._handleDynamicMarkers(url);

    // List every possible paths
    let paths = this.pathBuilder.generatePaths(method.toLowerCase(), customUrl);

    // Find the file to load and extract the content
    let fileToLoad = this.fileLoader.find(paths.mocks);

    if (fileToLoad !== null) {
      let fileData = this.fileLoader.load(fileToLoad, request, paths);
      rawContent = fileData.rawContent;
      httpCode = fileData.httpCode;
      extension = fileData.extension;
      location = fileData.location;
      delay = fileData.delay;
      responseHeaders['X-Mockiji-File'] = fileToLoad;
      responseHeaders['X-Mockiji-Notices'] = fileData.notices;
      responseHeaders['Cache-Control'] = 'no-cache';
      if (location) {
        responseHeaders['Location'] = location;
      }
    } else {
      httpCode = this.Configuration.get('http_codes.mock_file_not_found');

      responseHeaders['X-Mockiji-Not-Found'] = true;
      rawContent = {
        'errorCode': httpCode,
        'errorDescription': 'No mock file was found',
        'evaluatedMockFilePaths': paths.mocks,
      };

      this.Logger.warn({
        'method': request.method,
        'url': url,
        'httpCode': httpCode,
        'evaluatedMockFilePaths': paths.mocks,
      }, `Could not find a mock file for "${request.method} ${url}"`);
    }

    // Set Response Headers
    response.set(responseHeaders);

    // Send Response
    setTimeout(() => {
      if (rawContent !== null && extension === 'html') {
        response.status(httpCode).send(rawContent);
      } else if (rawContent !== null) {
        response.status(httpCode).json(rawContent);
      } else {
        response.set('X-Mockiji-Empty-Response-Body', true);
        response.status(httpCode).send('');
      }

      this.Logger.info({
        'type': 'response',
        'method': method,
        'url': url,
        'httpCode': httpCode,
        'mockPath': fileToLoad,
      }, `Response sent for "${method} ${url}" (${httpCode})`);
    }, delay);
  }

  /**
   * Decode token if needed.
   * @param request
   */
  _handleToken(request) {
    let tokenType = this.Configuration.get('authorization_token');
    if (tokenType && tokenType !== '' && request.headers.authorization) {
      if (tokenType === 'base64') {
        let encoded = request.headers.authorization.split(' ')[1];
        let decoded = new Buffer(encoded, 'base64').toString('utf8');
        this.token = JSON.parse(decoded);
      }
    }
  }

  /**
   * Replace dynamic markers from raw url
   * @param url
   */
  _handleDynamicMarkers(url) {
    if(typeof(this.Configuration.get('dynamic_markers')) === 'object') {
      let markerConfigs = this.Configuration.get('dynamic_markers');
      if (markerConfigs) {
        // We browse the token configs array
        for(let i in markerConfigs) {
          // We test the config regexp
          let newUrl = this._testAndReplaceUrl(markerConfigs[i], url);
          if (newUrl !== null) {
            return newUrl;
          }
        }
      }
    }
    return url;
  }

  /**
   * Test regex on url and apply it
   * @param config
   * @param url
   */
  _testAndReplaceUrl(config, url) {
    let rawRegexp = config.regexp;
    let regexp = new RegExp(rawRegexp, 'i');

    if(regexp.test(url)) {
      // If matched, we invert the replacing group to replace the good ones
      let invertedRegExp = this._invertRegexpGroups(rawRegexp);
      let iRegExp = new RegExp(invertedRegExp,'i');

      // We fetch the replacement data to replace the group
      let replacementKey = config.replacement_key;
      let replacement = null;
      if (config.type === 'token' && this.token && this.token.hasOwnProperty(replacementKey)) {
        replacement = this.token[replacementKey];
      }

      if (replacement !== null) {
        // We recompose the url with the replacement
        return url.replace(iRegExp, ['$1',replacement,'$2'].join(''));
      }
    }
    return null;
  }

  /**
   * invert the replacing group to replace the good ones
   * @param regexp
   */
  _invertRegexpGroups(regexp) {
    let startGroup = regexp.indexOf('(');
    let stopGroup = regexp.indexOf(')');
    let invertedRegExp = [
      '(',
      regexp.substring(0, startGroup),
      ')',
      regexp.substring(startGroup+1, stopGroup),
      '(',
      regexp.substring(stopGroup+1),
      ')'].join('');
    return invertedRegExp;
  }
}

module.exports = MockCtrl;
