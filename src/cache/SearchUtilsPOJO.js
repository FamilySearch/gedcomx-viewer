/**
 * Utility methods used in various parts of the Search projects.
 */
(function defineSearchUtilsPOJO(global) {
  var Uri, strong;

  var nodejs = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV);

  // package.json says 'jsuri' while bower.json says 'jsUri'
  if (nodejs) {
    var srequire = require;
    Uri = srequire('jsuri');

    // for nodejs-only functions
    strong = srequire('strong');
  }
  else {
    Uri = window.Uri;
  }

  var SearchUtilsPOJO = function SearchUtilsPOJO() {
    var that = this;

    // regex to see if a date is simply a 4-digit year
    var yearMatcher = new RegExp("^\\s*(\\d{4})\\s*$");

    /**
     * Add commas to a numeric string
     * @param {String} nStr - numeric string that needs commas
     * @returns {String} New string with commas
     */
    this.addCommas = function addCommas(nStr) {
      nStr += '';
      var x = nStr.split('.');
      var x1 = x[0];
      var x2 = x.length > 1 ? '.' + x[1] : '';
      var rgx = /(\d+)(\d{3})/;
      while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
      }
      return x1 + x2;
    };

    /**
     * Copies an object - works better than JSON.parse(JSON.stringify(obj)) because it doesn't clobber models
     * @param {*} obj - thing to copy
     * @returns {*} new copied object
     */
    this.copy = function copy(obj) {
      if (typeof obj !== 'object') {
        // plain JSON copy works with these data types
        return JSON.parse(JSON.stringify(obj));
      }

      if (obj.clone && (typeof obj.clone === 'function')) {
        return obj.clone();
      }

      var newObj = (Array.isArray(obj)) ? [] : {};

      return copyNewObj(newObj);

      function copyNewObj(newObj) {
        // copy array or object manually
        for (var key in obj) {
          if (obj.hasOwnProperty(key) && obj.hasOwnProperty(key)) {
            newObj[key] = that.copy(obj[key]);
          }
        }

        return newObj;
      }
    };

    /**
     * Builds a custom/standard error message
     *
     * @param {string} errorMsg - the custom error message
     * @param {String} error - the error received from the response
     * @param {Object} response - the response object {error, statusCode, status}
     * @param {Object|String} body - the body of the response
     * @param {String} [reqUrl] - optional request URL for the failing URL
     * @returns {string} The new custom/standard error message
     */
    this.customizeErrorMsg = function customizeErrorMsg(errorMsg, error, response, body, reqUrl) {
      if (error) {
        errorMsg += error + ". ";
      }
      else if (response && response.error) {
        errorMsg += response.error + ". ";
      }

      errorMsg += addStatus() + addFailedURI() + addBody() + ":: ";

      return errorMsg;

      function addStatus() {
        if (response) {
          return "Status: " + (response.statusCode || response.status) + ". ";
        }
        return '';
      }

      function addFailedURI() {
        if (reqUrl) {
          return "Failed URI: " + reqUrl + " ";
        }
        return '';
      }

      function addBody() {
        if (body) {
          if (that.isObject(body)) {
            body = JSON.stringify(body);
          }
          // We don't want to fire notification events for every internal 'exception'
          // So we change the string so it isn't recognized by Heroku monitoring as an exception
          return "Body: " + body.replace(/exception/gi, "Xception") + ". ";
        }
        return '';
      }
    };

    /**
     * Escapes special characters as HTML
     *
     * @param {String} stringToEscape - the string to escape into HTML
     * @returns {string} - the same string, with special chars escaped as HTML
     */
    this.escapeToHTML = function escapeToHTML(stringToEscape) {
      return String(stringToEscape)
        .replace(/&(?!\w+;)/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    /**
     * This method mimics the jQuery extend method.
     * Usage: var obj = searchUtilsPOJO.extend({}, default, custom).
     * The first element gets altered and returned by this method.
     * obj will contain the combination of default overlayed by values in custom.
     *
     * @returns {*} The object represented by a combination of the argument objects (last one wins).
     */
    this.extend = function extend() {
      for (var i = 1; i < arguments.length; i++)
        for (var key in arguments[i])
          if (arguments[i].hasOwnProperty(key))
            arguments[0][key] = arguments[i][key];
      return arguments[0];
    };

    /**
     * Return the app url/hostname we are running on, whether on the server or the client.
     *
     * @returns {String} - app url/hostname we are running on, whether on the server or the client.
     */
    this.getAppPath = function getAppPath() {
      if (nodejs) {
        return process.env.APP_BASE_URL;
      }

      var fullAppPath = new Uri(FS.appPath);
      return fullAppPath.origin();
    };

    /**
     * Get the pal or ark identifier
     *
     * @param {String} url - URL to get the ark ID from
     * @return {String} ark ID
     */
    this.getArkId = function getArkId(url) {

      // if url doesn't have a domain name, add one so uriPOJO parses it properly
      if (url && url.match(/^(ark|pal)/)) {
        url = 'http://fake.domain/' + url;
      }

      var parsedURL = new Uri(url);
      var parts = null;

      if (/ark/.test(parsedURL.path())) {
        parts = parsedURL.path().match(/61903\/\d:\d:(?:\d:)?([^\/#?]*)[\/#?]?/);
        return parts[1];
      }
      else if (/pal/.test(parsedURL.path())) {
        parts = parsedURL.path().match(/MM9\.\d.\d(?:.\d)?\/([^\/#?]*)[\/#?]?/);
        return parts[1];
      }
    };

    /**
     * Get the pal or ark type (3:1, 3:2, etc.) regardless of whether it was a Pal or an ARK
     *
     * @param {String} arkOrPalURL - URL to check type for
     * @returns {String} type string
     */
    this.getArkType = function getArkType(arkOrPalURL) {
      var parsedURL = new Uri(arkOrPalURL);
      var type = "";
      var parts = null;

      if (/ark/.test(parsedURL.path())) {
        parts = parsedURL.path().match(/61903\/(\d):(\d):(?:(\d):)?/);
        type += parts[1] + ":" + parts[2] + ":";
        if (parts[3]) {
          type += parts[3] + ":";
        }
      }
      else if (/pal/.test(parsedURL.path())) {
        parts = parsedURL.path().match(/MM9\.(\d)\.(\d)(?:\.(\d))?/);
        type += parts[1] + ":" + parts[2] + ":";
        if (parts[3]) {
          type += parts[3] + ":";
        }
      }
      return type;
    };

    /**
     * Transforms an image URL into an image thumbnail URL
     *
     * @param {String} imageURL - image URL to transform
     * @returns {String} - image thumbnail URL
     */
    this.getImageThumbnail = function getImageThumbnail(imageURL) {
      if (!imageURL || imageURL.length === 0) {
        return '';
      }
      return this.relativizeUrl(removeParameters(imageURL) + "/thumb_p200.jpg");
    };

    /**
     * Transforms an image URL into an image XML URL
     *
     * @param {String} imageURL - image URL to transform
     * @returns {String} - image XML URL
     */
    this.getImageXML = function getImageXML(imageURL) {
      if (!imageURL || imageURL.length === 0) {
        return '';
      }

      return removeParameters(imageURL) + "/image.xml";
    };

    /**
     * Transforms an image URL into an image XML URL
     *
     * @param {String} imageURL - image URL to transform
     * @returns {String} - image XML URL
     */
    this.getImageXML = function getImageXML(imageURL) {
      if (!imageURL || imageURL.length === 0) {
        return '';
      }

      return removeParameters(imageURL) + "/image.xml";
    };

    /**
     * Get the window origin (with an IE fix)
     *
     * @returns {*} window origin string
     */
    this.getWindowOrigin = function getWindowOrigin() {
      var origin = window.location.origin;
      if (!origin) { // fix for IE
        origin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '');
      }
      return origin;
    };

    /**
     * Merges two objects deeply (recursively)
     * Used when merging additions and modifications during person update
     *
     * @param {Object} obj - object to merge
     * @param {Object} src - second object to merge
     * @returns {{}} New object with all of obj and src contents
     */
    this.merge = function merge(obj, src) {
      if (typeof obj !== 'object' && typeof src !== 'object') {
        return obj || src;
      }

      // copy objects to ensure we don't edit the original objects
      var obj1 = this.copy(obj);
      var src1 = this.copy(src);
      var that = this;

      mergeKeys();

      function mergeKeys() {
        // merge object properties into obj1
        for (var key in src1) {
          if (src1.hasOwnProperty(key) && obj1.hasOwnProperty(key)) {
            mergeProperty(key);
          }
          else if (src.hasOwnProperty(key)) {
            obj1[key] = src1[key];
          }
        }
      }

      function mergeProperty(key) {
        if (Array.isArray(src1[key]) && Array.isArray(obj1[key])) {
          obj1[key].push.apply(obj1[key], src1[key]);
        }
        // force mixes of arrays and non-arrays into arrays
        else if (Array.isArray(src1[key])) {
          var val = obj1[key];
          obj1[key] = [val];
          obj1[key].push.apply(obj1[key], src1[key]);
        }
        else if (Array.isArray(obj1[key])) {
          obj1[key].push.apply(obj1[key], [src1[key]]);
        }
        // merge objects
        else {
          obj1[key] = that.merge(obj1[key], src1[key]);
        }
      }

      return obj1;
    };


    /**
     * Truncate the string with an ellipses in the middle
     * Credit goes an answer here: to http://stackoverflow.com/questions/831552/string-truncation-in-the-middle-mac-style-css-and-jquery
     *
     * @param {String} string - string to truncate
     * @param {Number} maxChars - maximum number of characters to allow
     * @returns {*} - truncated string with ellipses
     */
    this.middleEllipses = function middleEllipses(string, maxChars) {
      if (!string) return string;
      if (maxChars < 1) return string;
      if (string.length <= maxChars) return string;
      if (maxChars === 1) return string.substring(0, 1) + '...';

      var midpoint = Math.ceil(string.length / 2);
      var toremove = string.length - maxChars;
      var lstrip = Math.ceil(toremove / 2);
      var rstrip = toremove - lstrip;
      return string.substring(0, midpoint - lstrip) + '...' + string.substring(midpoint + rstrip);
    };

    /**
     * Normalizes a URL string
     * Turns an ark into a pal
     * This function relies on FS.showEx despite being a POJO function to avoid making potentially buggy changes to the many calls
     * ato it in source-linker. This function is only used in source linker. Remove this comment with experiment slGedxData.
     *
     * @param {String} url - URL to normalize
     * @returns {*} - normalized version of URL
     */
    this.normalizeUrl = function normalizeUrl(url) {
      if (!url) {
        return url;
      }
      var index = url.indexOf("pal:/");
      if (index !== -1) {
        var palName = removeParameters(url.slice(index + 'pal:/MM9.1.1/'.length));
        var palType = url.slice(url.indexOf("MM9.") + "MM9.".length, url.indexOf("MM9.") + "MM9.1.1".length);
        var parts = palType.split('.');
        if (parts[0] === '2') {
          return '/ark:/61903/2:1:' + palName;
        }
        return '/ark:/61903/' + parts[0] + ':' + parts[1] + ':' + palName;
      }
      if (index === -1) {
        return this.relativizeUrl(url);
      }
      return removeParameters(url.slice(index));
    };


    /**
     * peel off the domain, if present
     * Turns a fully-qualified domain name into an absolute URL
     *
     * @param {String} theUrl - URL to make relative
     * @returns {*} - relative version of URL
     */
    this.relativizeUrl = function relativizeUrl(theUrl) {
      if (!theUrl) {
        return theUrl;
      }
      var index = theUrl.indexOf("://");
      if (index === -1) {
        return theUrl;
      }
      var slashIndex = theUrl.indexOf("/", index + "://".length);
      return theUrl.substring(slashIndex);
    };

    /**
     * Strips - and _ from tag names and lowercases them to standardize for translation
     * @param {String} tag The string to standardize.
     * @returns {String} Standardized string.
     */
    this.standardizeTag = function standardizeTag(tag) {
      if (tag) {
        tag = tag.replace(/_/g, '').replace(/-/g, '').toLowerCase();
      }
      return tag;
    };

    /**
     * Convenience method for assembling strings from multiple parts.  You can pass in a set of strings as arguments
     * that will replace tokens in the source strings based on argument index, OR you can pass in an object
     * of name value pairs that will replace tokens in the string based on key values.
     * ex: stringFormat('{0} {0} {1} {2}', 3.14, 'abc', 'foo'); //outputs: 3.14 3.14 abc foo
     * ex: stringFormat('{key1} {name} {key1}', {"key1" : 123, "name" : "Bob"}); //outputs: 123 Bob 123
     * ex: stringFormat('{key1.key2}', {"key1": {"key2": "Grant"}}); // outputs: Grant
     *
     * arguments[0] The string with the format parameters
     * arguments[1...n] The replacement strings
     * OR
     * arguments[1] The replacement object
     * @returns {String} formatted string
     */
    this.stringFormat = function stringFormat() {
      var txt = null;

      // If we have a string, grab it
      if (arguments.length > 0) {
        txt = arguments[0];
      }

      // If we have parameters, process them
      if (arguments.length > 1) {

        // Search for placeholders in the string and replace them with their value(s)
        var replaceTokens = function replaceTokens(str, key, value) {
          return str.replace(new RegExp('\\{' + key + '\\}', 'gm'), value);
        };

        // Process elements of an object
        var iterateTokens = function iterateTokens(obj, prefix) {
          for (var p in obj) {
            if (obj.hasOwnProperty(p)) {
              if (typeof (obj[p]) === 'object') {
                iterateTokens(obj[p], prefix + p + '.');
              }
              else {
                txt = replaceTokens(txt, prefix + p, obj[p]);
              }
            }
          }
        };

        if (this.isObject(arguments[1])) { // process an object's parts as parameters
          iterateTokens(arguments[1], '');
        }
        else { // replacement by argument indexes
          var i = arguments.length;
          while (i-- > 0) {
            txt = replaceTokens(txt, i - 1, arguments[i]);
          }
        }
      }

      return txt;
    };

    /**
     * Parse a loosely formatted (possibly bad) date string
     * Return an ISO 8601 formatted date
     *
     * @param {Array|String} dateOrDates The string to parse (or an array of possible strings, used in GedxPersona)
     * @returns {String|Boolean} The ISO 8601 formatted date string (or empty string)
     */
    SearchUtilsPOJO.prototype.toISODateString = function toISODateString(dateOrDates) {

      var year = null;
      var month = null;
      // pre-process parameters
      var dateStrings;
      if (dateOrDates instanceof Array) {
        dateStrings = dateOrDates;
      }
      else {
        dateStrings = [dateOrDates];
      }

      // loop through dates, attempting to parse
      var yearFallback = false;
      var monthYearFallback = false;
      function parseYearInt(date) {
        return parseInt(date, 10);
      }

      for (var i = 0; i < dateStrings.length; i++) {
        var dateString = processDateString(dateStrings[i]);
        if (typeof dateString === 'string') {
          return dateString;
        }
      }

      return getFallback();

      // if we get here, no valid complete dates were found, return a partial
      function getFallback() {

        if (monthYearFallback) {
          return monthYearFallback;
        }
        if (yearFallback) {
          return yearFallback;
        }
        return '';
      }

      function processDateString(dateString) {
        // Date.parse will get most standard date formats, so try that first (unless we're dealing with a year).
        var timestamp = Date.parse(dateString);
        var isYearOnly = yearMatcher.exec(dateString);
        if (isNaN(timestamp) === false && !isYearOnly) {
          var retval = processTimestamp(timestamp, dateString);
          if (retval) {
            return retval;
          }
        }

        fixMonthFallback(dateString);
        fixYearFallback(dateString);
      }

      function processTimestamp(timestamp, dateString) {
        // parse out date elements - carefully - if month and/or day is bad it may be '1'
        var date = new Date(timestamp);
        year = date.getFullYear();
        month = ((date.getMonth() + 1) < 10) ? '0' + (date.getMonth() + 1) : (date.getMonth() + 1);
        var day = ((date.getDate() > 0) && (date.getDate() < 10)) ? '0' + date.getDate() : date.getDate();
        // console.log("orig: " + dateString + "; timestamp: " + timestamp + "; year: " + year + "; month: " + month + "; day: " + day);
        // Google Chrome has a bug where Date.parse returns a date, even for poor date strings
        // It automatically sets the year to 2001
        // check to see if the date is 2001, then check it against the dates
        if (year === 2001) {
          // Split the dateString by space and see if the part is a four digit integer (a year)
          var dateArray = dateString.split(' ').map(parseYearInt);
          if (dateArray.indexOf(2001) === -1) {
            // No year is found in the date; skip this date.
            return;
          }
        }
        return formDate();

        function formDate() {

          // if we have day & year granularity (3 tokens minimum, 2 digit tokens minimum), include the day in the final string
          // add leading zeroes to month and day spots (or it's not valid ISO 8601)
          var dayMonthMatchA = (/\S+[\s(?:-|\/)]+\S+[\s(?:-|\/)]+\S+/).exec(dateString);
          var dayMonthMatchB = (/\d+\D+\d+/).exec(dateString);
          if (dayMonthMatchA && dayMonthMatchB && (date.getDate() > 0)) {
            return year + '-' + month + '-' + day;
          }
          else if (month && (month !== '00')) {
            return year + '-' + month;
          }
        }
      }

      function fixMonthFallback(dateString) {
        // Numeric Month & Year Fallback, like "2 1711" - which Date.parse can't parse.
        // add leading zeroes to month and day spots (or it's not valid ISO 8601)
        var monthYearMatchB = (/^\s*(\d{1,2})[\s-]+(\d{4})\s*$/).exec(dateString);
        if (monthYearMatchB && parseInt(monthYearMatchB[1], 10) && parseInt(monthYearMatchB[2], 10) && (monthYearMatchB[1] < 13)) {
          year = monthYearMatchB[2];
          month = ((monthYearMatchB[1] > 0) && (monthYearMatchB[1] < 10)) ? '0' + monthYearMatchB[1] : monthYearMatchB[1];
          monthYearFallback = year + '-' + month;
        }
      }

      function fixYearFallback(dateString) {
        if (yearFallback === false) {
          var yearMatch = (/\b(\d{4})\b/).exec(dateString);
          if (yearMatch && yearMatch[1]) {
            yearFallback = yearMatch[1];
          }
        }
      }
    };

    /**
     * Checks to see if two URLs (without their query strings) match
     *
     * @param {String} one - URL
     * @param {String} two - URL
     * @returns {Boolean} - true if the two URLs (without their query strings) match
     */
    this.urlsMatch = function urlsMatch(one, two) {
      return (one === two) || (removeParameters(one) === removeParameters(two));
    };

    // =============================================================================
    // SERVER ONLY METHODS
    // =============================================================================

    if (nodejs) {

      /**
       * Return the locale from the request set by the Strong library.
       * @param {Object} req The request object
       * @returns {String} The locale string. Defaults to 'en' if none found.
       */
      this.getStrongLocale = function getStrongLocale(req) {
        var strongLocale = req.locales;
        if (strongLocale && Array.isArray(strongLocale) && !this.isEmpty(strongLocale)) {
          strongLocale = strongLocale[0];
        }
        else {
          strongLocale = "en";
        }
        return strongLocale;
      };

      /**
       * Get an array of locales to check for this request, in priority order
       * @param {Object} req - The request object
       * @param {Object} res - The response object
       * @returns {[string]} The list of the user's acceptable locales
       */
      this.getStrongLocales = function getStrongLocales(req, res) {
        var strongLocales = strong.localeHelper(req, res);
        if (strongLocales && Array.isArray(strongLocales) && !this.isEmpty(strongLocales)) {
          return strongLocales;
        }
        return ["en"];
      };

    } // if (nodejs) - SERVER ONLY METHODS

    // =============================================================================
    // Methods from underscore library.
    // =============================================================================

    /**
     * @param {*} obj The object in question
     * @returns {Boolean} True if the object is null or an empty array
     */
    this.isEmpty = function isEmpty(obj) {
      if (obj == null) {
        return true;
      }
      if (this.isString(obj) || Array.isArray(obj)) {
        return obj.length === 0;
      }
      throw new Error("Unsupported type passed to isEmpty:" + typeof obj);
    };

    /**
     * @param {*} obj The object in question
     * @returns {boolean} True if the object is an 'object' or 'function'
     */
    this.isObject = function isObject(obj) {
      var type = typeof obj;
      return type === 'function' || type === 'object' && !!obj;
    };

    /**
     * @param {*} obj The object in question
     * @returns {Boolean} True if the object is a 'string'
     */
    this.isString = function isString(obj) {
      return Object.prototype.toString.call(obj) === '[object String]';
    };

    /**
     * Private functions
     */

    /**
     * Remove query string params from a URL, if present
     *
     * @param {String} theUrl - URL to remove
     * @returns {*} - theUrl without a query string
     */
    function removeParameters(theUrl) {
      if (!theUrl) {
        return theUrl;
      }
      var index = theUrl.indexOf("?");
      if (index === -1) {
        return theUrl;
      }
      return theUrl.substring(0, index);
    }

  }; // function SearchUtilsPOJO

  /**
   * If we are in a system that uses CommonJS use it.  Otherwise
   * global Allows you to instantiate this service like var SearchUtilsPOJO = new SearchUtilsPOJO();
   */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = new SearchUtilsPOJO();
  }
  else {
    global.SearchUtilsPOJO = new SearchUtilsPOJO();
  }

}(this));
