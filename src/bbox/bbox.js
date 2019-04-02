var overlayTypeIdMap = {};

/**
 * Create an overlay object suitable for sending to the image viewer.
 * @param type - Type of overlay. (null => default)
 * @param rectangle - Rectangle object with {x1,y1,x2,y2} in fractional coordinates.
 * @param id - (Optional) id string to use.
 * @returns {{id: *, type: *, selectable: boolean, x: (*|number|SVGAnimatedLength), y: (*|SVGAnimatedLength|number), width: number, height: number}}
 */
function createOverlay(type, rectangle, id) {
  var typeName = type ? type : "?";
  if (!id) {
    // If no ID is specified, use a separate 1-based counter for each type to give each box an id, e.g., "name-1" or "date-13".
    var lastId = overlayTypeIdMap[typeName];
    id = (lastId ? lastId + 1 : 1);
    overlayTypeIdMap[typeName] = id;
  }
  id = typeName + "-" + id;
  
  return {
    id: id,
    type: type,
    selectable: true,
    x: rectangle.x1,
    y: rectangle.y1,
    width: rectangle.x2 - rectangle.x1,
    height: rectangle.y2 - rectangle.y1
  };
}

function overlayBoxes(viewer, doc) {

  /**
   * Look in the value to see if it has any source references with rectangle qualifiers.
   * If so, create an overlay box for each rectangle (of the given 'boxType') and
   * add it to boxes[].
   * (Note that this assume that all sources with rectangles are referring to the same image.
   *  If this is not the case, then modify boxes[] to be a map of source ID -> boxes[] for that source.)
   * @param boxes - Array of boxes to add the overlay box to.
   * @param value - Thing that may have an array of sources for it.
   * @param boxType - Class to use as the overlay type ("name", "date", "place" or null/undefined for default).
   */
  function addSourceBoxes(boxes, value, boxType) {
    if (value && !isEmpty(value.sources)) {
      for (var s = 0; s < value.sources.length; s++) {
        var sourceReference = value.sources[s];
        if (!isEmpty(sourceReference.qualifiers)) {
          for (var q = 0; q < sourceReference.qualifiers.length; q++) {
            var qualifier = sourceReference.qualifiers[q];
            if (qualifier.name === "http://gedcomx.org/RectangleRegion") {
              var rectangle = new Rectangle(qualifier.value);
              var overlay = createOverlay(boxType, rectangle);
              boxes.push(overlay);
            }
          }
        }
      }
    }
  }

  /**
   * Look in the list of fields for the given fieldContainer (person, name, namePart, etc.).
   * If there are any fields with rectangle qualifiers, create overlay boxes for each one and add those to boxes[].
   * @param boxes - Array of overlay boxes to add any boxes to.
   * @param fieldContainer - Object that may have a list of fields.
   * @param boxType - Type of overlay.
   */
  function addFieldBoxes(boxes, fieldContainer, boxType) {
    if (!isEmpty(fieldContainer.fields)) {
      for (var f = 0; f < fieldContainer.fields.length; f++) {
        var field = fieldContainer.fields[f];
        addSourceBoxes(boxes, field, boxType);
        if (field.values) {
          for (var v = 0; v < field.values.length; v++) {
            var fieldValue = field.values[v];
            addSourceBoxes(boxes, fieldValue, boxType);
          }
        }
      }
    }
  }

  /**
   * Add overlay boxes found in any of the names in the given array.
   * @param boxes - Array of overlay boxes to add to.
   * @param names - Array of names to look in for name boxes.
   */
  function addNameBoxes(boxes, names) {
    if (names) {
      for (var n = 0; n < names.length; n++) {
        var name = person.names[n];
        addFieldBoxes(boxes, name, "name");
        if (name.nameForms) {
          for (var f = 0; f < name.nameForms.length; f++) {
            var nameForm = name.nameForms[f];
            addFieldBoxes(boxes, nameForm, "name");
            if (nameForm.parts) {
              for (var np = 0; np < nameForm.parts.length; np++) {
                var namePart = nameForm.parts[np];
                addFieldBoxes(boxes, namePart, "name");
              }
            }
          }
        }
      }
    }
  }

  function addFactBoxes(boxes, facts) {
    if (!isEmpty(facts)) {
      for (var f = 0; f < facts.length; f++) {
        var fact = facts[f];
        addFieldBoxes(boxes, fact, "fact");
        if (fact.date) {
          addFieldBoxes(boxes, fact.date, "date");
        }
        if (fact.place) {
          addFieldBoxes(boxes, fact.place, "place");
        }
      }
    }
  }

  function imageArkToApid(imageArk) {
    /**
     * Compute the checksum of the given string as a 2-digit decimal number.
     * @param inString - StringBuilder containing the string to checksum.
     * @return 2-digit checksum.
     */
    function computeChecksum(inString) {
      var MOD_ADLER = 65521;
      var a = 1;
      var b = 0;
      for (var i = 0; i < inString.length; i++) {
        a = (a + inString.charAt(i).charCodeAt()) % MOD_ADLER;
        b = (b + a) % MOD_ADLER;
      }
      return (b ^ a) % 100;
    }

    /**
     * Decode a J-Encoded String
     * @param encodedString - J-Encoded string (XXXX-YYYY-XZ)
     * @returns Number.
     */
    function decode(encodedString) {
      var result = 0;
      var alphabet = "M9S3Q7W4HCZ8D6XFNJVK2LGP5RTYB1";
      var numberBase = alphabet.length;

      for (var i = 0; i < encodedString.length; i++) {
        var ch = encodedString.charAt(i);
        var nextVal = alphabet.indexOf(ch);
        if (-1 !== nextVal) { // ignore dashes.
          result *= numberBase;
          result += nextVal;
        }
      }
      return result;
    }

    function removeDashes(s) {
      return s.replace(/-/g, "");
    }

    /**
     * Decode a J-ENCODED value into a TH- style APID.
     * @param encodedThApid
     * @returns {string}
     */
    function decodeThApid(encodedThApid) {
      // Remove dashes
      encodedThApid = removeDashes(encodedThApid);

      if (encodedThApid.startsWith("939K8X3")) {
        // Special cases: Apids that are in production but do not have the proper checksum.  These 2 are missing the last digit
        if (encodedThApid === "939K8X3P6N") {
          return "TH-1-17444-102106-8";   // Algorithm returns TH-1-17444-102106-86
        }
        if (encodedThApid === "939K8X3P6J") {
          return "TH-1-17444-102107-8";   // Algorithm returns TH-1-17444-102107-89
        }
        if (encodedThApid === "939K8X3GFV") {
          return "TH-1-17444-101268-6";
        }
        if (encodedThApid === "939K8X3LZY") {
          return "TH-1-17444-100227-9";
        }
        if (encodedThApid === "939K8X3L5K") {
          return "TH-1-17444-100639-7";
        }
        if (encodedThApid === "939K8X3GDD") {
          return "TH-1-17444-101172-9";
        }
        if (encodedThApid === "939K8X3GDX") {
          return "TH-1-17444-101174-7";
        }
        if (encodedThApid === "939K8X3GDN") {
          return "TH-1-17444-101176-6";
        }
        if (encodedThApid === "939K8X3P6T") {
          return "TH-1-17444-102116-8";
        }
        if (encodedThApid === "939K8X3P5Z") {
          return "TH-1-17444-102430-9";
        }
        if (encodedThApid === "939K8X3P5B") {
          return "TH-1-17444-102448-5";
        }
      }

      // Get the length of the first two numbers (the third number is whatever is left after those)
      var len1 = decode(encodedThApid.substring(0, 1));
      var len2 = decode(encodedThApid.substring(1, 2));
      // Get the three JEncoded trigit ranges, and decode each into a number.
      var v1 = decode(encodedThApid.substring(2, 2 + len1));
      var v2 = decode(encodedThApid.substring(2 + len1, 2 + len1 + len2));
      var v3 = decode(encodedThApid.substring(2 + len1 + len2));
      var s = "TH-" + v1 + "-" + v2 + "-" + v3 + "-";
      var checksum = computeChecksum(s);
      return s + checksum;
    }

    /**
     * Decode a DGS-style APID that has been encoded via 'encodeDgsApid'.
     * The encoded string (after dashes are removed) has one JEncoded 'trigit' that indicates how many
     * characters are used by the DGS#.
     * This is followed by that many characters for the DGS# and the rest are the image number.
     * @param encodedDgsApid - Encoded "DGS-" style APID.
     * @return DGS-style APID, of the form "DGS-999999999_55555"
     */
    function decodeDgsApid(encodedDgsApid) {
      encodedDgsApid = removeDashes(encodedDgsApid);
      var len1 = decode(encodedDgsApid.substring(0, 1));
      var dgs = decode(encodedDgsApid.substring(1, 1 + len1));
      var img = decode(encodedDgsApid.substring(1 + len1));
      return "DGS-" + dgs.toString().padStart(9, '0') + "_" + img.toString().padStart(5, '0');
    }

    var noParams = imageArk.replace(/\?.*/, ""); // Remove any query parameters
    var name = noParams.replace(/.*\//, ""); // Strip off everything before the "3:..."
    var jEncodedValue = name.replace(/.*:/, "");
    if (name.startsWith("3:1:")) {
      return decodeThApid(jEncodedValue);
    }
    else if (name.startsWith("3:2:")) {
      return decodeDgsApid(jEncodedValue);
    }
    return null; // unrecognized Image Ark format.
  }

  // NBX bounding box [x,y,w,h] parsing...

  function findNbxDocumentText(doc) {
    if (doc.documents) {
      for (var d = 0; d < doc.documents.length; d++) {
        var document = doc.documents[d];
        if (document.id === "nbx") {
          return document.text;
        }
      }
    }
    return null;
  }

  // Find the metadata string in the given array of {tag:, content:} with the given tag.
  function findMetadata(metadata, tag) {
    for (var m = 0; m < metadata.length; m++) {
      var meta = metadata[m];
      if (meta.tag === tag) {
        return meta.content;
      }
    }
    return null;
  }

  // Parse "[10,20:30,40] " (using pixel coordinates) into {x1,y1,x2,y2}, using fractional coordinates.
  function parseRect(rectString, imgWidth, imgHeight) {
    var parts = rectString.match(/\[(\d+),(\d+):(\d+),(\d+)] */);
    return {
      x1: parts[1] / imgWidth,
      y1: parts[2] / imgHeight,
      x2: parts[3] / imgWidth,
      y2: parts[4] / imgHeight
    };
  }

  function addNbxBoxes(boxes, nbxText) {
    if (!nbxText) {
      return;
    }
    /* Get an object that represents the contents of the NBX file with:
       metadata:
        array of objects with
          tag : tag
          content: array of text-object
      sbody:
        array of text-object
      relex: (doesn't matter here)

      where text-object has:
         text : <text to display>
         offset : <offset in original NBX w/o ENAMX>
         rectangles: Array of rectangles with {x1,y1,x2,y2} (in pixels)
         timex/enamex :
           tag: <timex/enamex...>
           type : <typeOfEntity>
           text : <text of entity> (may include rectangles "[x1,y1:x2,y2] " followed by text for that rectangle).
     */
    var nbx = parseNbx(nbxText);

    var imgSizeArr = findMetadata(nbx.metadata, "IMGSIZE");
    var imgSize = imgSizeArr[0].text.split(",");
    var imgWidth = imgSize[0];
    var imgHeight = imgSize[1];

    for (var t = 0; t < nbx.sbody.length; t++) {
      var tag = nbx.sbody[t];
      if (tag.rectangles) {
        //todo. So far there won't be any here.
      }
      if (tag.text) {
        var rectStrings = tag.text.match(/\[\d+,\d+:\d+,\d+] /g);
        if (!isEmpty(rectStrings)) {
          for (var r = 0; r < rectStrings.length; r++) {
            boxes.push(createOverlay(null, parseRect(rectStrings[r], imgWidth, imgHeight)));
          }
        }
      }
    }
  }

  // overlayBoxes(doc) ============================

  // Get an array of objects with {image: <imageArk>, rectangles: [array of Rectangle object with x1,y1,x2,y2]}
  var imageArksAndRects = getImageArks(doc);

  if (!isEmpty(imageArksAndRects)) {
    var imageArk = imageArksAndRects[0].image;
    var imageApid = imageArkToApid(imageArk);
    viewer.src = "https://www.familysearch.org/dz/v1/apid:" + imageApid + "/";

    var boxes = [];

    if (doc.persons) {
      for (var p = 0; p < doc.persons.length; p++) {
        var person = doc.persons[p];
        addFieldBoxes(boxes, person, "person");
        addNameBoxes(boxes, person.names);
        addFactBoxes(boxes, person.facts);
        if (person.gender) {
          addFieldBoxes(boxes, person, "gender");
        }
      }
    }
    if (doc.relationships) {
      for (var r = 0; r < doc.relationships.length; r++) {
        var relationship = doc.relationships[r];
        addFieldBoxes(boxes, relationship, "relationship");
        addFactBoxes(boxes, relationship.facts);
      }
    }

    addNbxBoxes(boxes, findNbxDocumentText(doc));

    viewer.overlays.setAll(boxes);
  }
}