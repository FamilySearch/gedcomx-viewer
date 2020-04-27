var overlayTypeIdMap = {};

/**
 * Get the next available id to use for the given type of element.
 * Updates "overlayTypeIdMap". If a GedcomX object is provided, then the GedcomX object is updated with an id
 *   (if it does not already have one), and the mapping from the new element to that GedcomX object's id
 *   is added to the elementToGxMap
 * @param typeName - Name of element type.
 * @param elementToGxMap (Optional) - Map of (new) local HTML element ID to GedcomX object ID.
 * @param gxObject (Optional) - GedcomX object whose ID is to be used (and added if not there), and included in the map.
 * @returns {string}
 */
function nextId(typeName, elementToGxMap, gxObject) {
  if (!typeName) {
    typeName="?";
  }
  let lastIdNumber = overlayTypeIdMap[typeName];
  let nextIdNumber = (lastIdNumber ? lastIdNumber + 1 : 1);
  overlayTypeIdMap[typeName] = nextIdNumber;
  let overlayId = typeName + "-" + nextIdNumber;

  if (elementToGxMap && gxObject) {
    if (!gxObject.id) {
      gxObject.id = nextId("gx");
    }
    elementToGxMap[overlayId] = gxObject.id;
  }

  return overlayId;
}

/**
 * Create an overlay object suitable for sending to the image viewer. Update the given GedcomX object with an "id" element (starting with "gx-")
 *   if none is present.
 * @param type - Type of overlay. ("name", "date", "place". null => default)
 * @param rectangle - Rectangle object with {x1,y1,x2,y2} in fractional coordinates.
 * @param elementMap - Map of overlay object id to GedcomX object id that the overlay text came from.
 * @param gxObject - GedcomX object to get an id from (set to "gx" + the next available id, if no id exists).
 * @returns {{id: *, type: *, selectable: boolean, x: (*|number|SVGAnimatedLength), y: (*|SVGAnimatedLength|number), width: number, height: number}}
 *          Overlay object to use in image viewer.
 */
function createOverlay(type, rectangle, elementMap, gxObject) {
  var overlayId = nextId(type, elementMap, gxObject);

  return {
    id: overlayId,
    type: type,
    selectable: true,
    x: rectangle.x1,
    y: rectangle.y1,
    width: rectangle.x2 - rectangle.x1,
    height: rectangle.y2 - rectangle.y1
  };
}


/**
 * Convert an image Ark into an APID.
 * @param imageArk
 * @returns Image APID
 */
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

function findNbxDocumentText(doc, docId) {
  if (doc.documents) {
    if (!docId) {
      docId = "nbx";
    }
    for (var d = 0; d < doc.documents.length; d++) {
      var document = doc.documents[d];
      if (document.id === docId) {
        return document.text;
      }
    }
  }
  return null;
}

/**
 * Add highlight boxes and corresponding text markers to the image viewer, as found in the given GedcomX document.
 *   A map is returned with key = local HTML element "id" for each highlight created; and value = "id" of the GedcomX object it came from.
 *   The GedcomX object is adorned with such ids if it did not already have them.
 * elements are added to that map
 * @param viewer - Javascript object for the image viewer element.
 * @param doc - GedcomX document
 * @return map of id of highlight in HTML document to corresponding element in GedcomX document.
 */
function overlayBoxes(viewer, doc) {

  /**
   * Create a "span" element to serve as a tooltip "marker", so that when you hover over a box, you can see what text is associated with that box.
   * @param text - Text to use
   * @param markerId - Unique ID to use for the span (e.g., "m_" + id of the overlay box it goes with).
   * @param boxType - Type of box: "name", "date", "place" or null/undefined for default.
   * @returns JQuery object for the new span element.
   */
  function makeMarkerSpan(text, markerId, boxType) {
    var html = "<span class='marker-" + (boxType ? boxType : "default") + "' id='" + markerId + "'>" + encode(text) + "</span>";
    return $.parseHTML(html);
  }

  function addMarker(markers, overlayId, text, boxType) {
    var $markers = $("#markers");

    var markerId = "m_" + overlayId;
    $markers.append(makeMarkerSpan(text, markerId, boxType));
    var markerNode = document.getElementById(markerId); //$("#" + markerId)[0];
    var marker = {
      id : markerId,
      followOverlayId: overlayId,
      hideWhenInactive: true,
      followOverlayPosition: "bottom-left",
      node: markerNode
    };
    markers.push(marker);
  }

  /**
   * Look in the value to see if it has any source references with rectangle qualifiers.
   * If so, create an overlay box for each rectangle (of the given 'boxType') and
   * add it to boxes[].
   * (Note that this assume that all sources with rectangles are referring to the same image.
   *  If this is not the case, then modify boxes[] to be a map of source ID -> boxes[] for that source.)
   * @param boxes - Array of boxes to add the overlay box to.
   * @param gxValue - GedcomX object that may have an array of sources for it.
   * @param boxType - Class to use as the overlay type ("name", "date", "place" or null/undefined for default).
   * @param text - (Optional). Text to display as a popup for the given box.
   * @param markers - Array of markers to add text to.
   */
  function addSourceBoxes(boxes, gxValue, boxType, text, markers, elementMap) {
    if (gxValue && !isEmpty(gxValue.sources)) {
      for (var s = 0; s < gxValue.sources.length; s++) {
        var sourceReference = gxValue.sources[s];
        if (!isEmpty(sourceReference.qualifiers)) {
          for (var q = 0; q < sourceReference.qualifiers.length; q++) {
            var qualifier = sourceReference.qualifiers[q];
            if (qualifier.name === "http://gedcomx.org/RectangleRegion") {
              var rectangle = new Rectangle(qualifier.value);
              var overlay = createOverlay(boxType, rectangle, elementMap, gxValue);
              boxes.push(overlay);
              if (text && markers) {
                addMarker(markers, overlay.id, text, boxType);
              }
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
   * @param markers - Array of markers (tooltip text that pop up below boxes) to add to.
   * @param fieldContainer - Object that may have a list of fields.
   * @param boxType - Type of overlay.
   * @param elementMap - Map of overlay object id to GedcomX object id that the overlay text came from.
   */
  function addFieldBoxes(boxes, markers, fieldContainer, boxType, elementMap) {
    if (!isEmpty(fieldContainer.fields)) {
      for (var f = 0; f < fieldContainer.fields.length; f++) {
        var field = fieldContainer.fields[f];
        if (field.values) {
          var text = null;
          for (var v = 0; v < field.values.length; v++) {
            var fieldValue = field.values[v];
            if (fieldValue.text) {
              text = fieldValue.text;
            }
            addSourceBoxes(boxes, fieldValue, boxType, text, markers, elementMap);
          }
          addSourceBoxes(boxes, field, boxType, text, markers, elementMap);
        }
      }
    }
  }

  /**
   * Add overlay boxes found in any of the names in the given array.
   * @param boxes - Array of overlay boxes to add to.
   * @param markers - Array of tooltip markers with the text that goes with each box.
   * @param names - Array of names to look in for name boxes.
   * @param elementMap - Map of overlay object id to GedcomX object id that the overlay text came from.
   */
  function addNameBoxes(boxes, markers, names, elementMap) {
    if (names) {
      for (var n = 0; n < names.length; n++) {
        var name = person.names[n];
        addFieldBoxes(boxes, markers, name, "name", elementMap);
        if (name.nameForms) {
          for (var f = 0; f < name.nameForms.length; f++) {
            var nameForm = name.nameForms[f];
            addFieldBoxes(boxes, markers, nameForm, "name", elementMap);
            if (nameForm.parts) {
              for (var np = 0; np < nameForm.parts.length; np++) {
                var namePart = nameForm.parts[np];
                addFieldBoxes(boxes, markers, namePart, "name", elementMap);
              }
            }
          }
        }
      }
    }
  }

  function addFactBoxes(boxes, markers, facts, elementMap) {
    if (!isEmpty(facts)) {
      for (var f = 0; f < facts.length; f++) {
        var fact = facts[f];
        addFieldBoxes(boxes, markers, fact, "fact", elementMap);
        if (fact.date) {
          addFieldBoxes(boxes, markers, fact.date, "date", elementMap);
        }
        if (fact.place) {
          addFieldBoxes(boxes, markers, fact.place, "place", elementMap);
        }
      }
    }
  }

  // NBX bounding box [x,y,w,h] parsing...
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

  /**
   * Given the array of rectangle strings that were found in the given text,
   * find the text that follows each rectangle (up until the next rectangle).
   * So "Prefix [rect1] text 1[rect2] text 2" with rectangles=["[rect1] ", "[rect2] "] returns ["text 1", "text 2"].
   * @param text - Text that includes "[x1,y1:x2,y2] " followed by the text for that rectangle, repeatedly.
   * @param rectangles - Array of "[x1,y1:x2,y2] " found in the text.
   */
  function findTextForEachRectangle(text, rectangles) {
    var textStrings = [];
    var rectText;
    if (!isEmpty(rectangles)) {
      var len = text.length;
      var r = 0;
      // Start at the text that is just past the next rectangle.
      var textPos = text.indexOf(rectangles[r]) + rectangles[r].length;
      var nextRectPos;

      while (textPos >= 0 && textPos < len) {
        r++;
        nextRectPos = r < rectangles.length ? text.indexOf(rectangles[r], textPos) : len;
        if (nextRectPos < 0) {
          throw "Could not find expected rectangle " + r + ": " + rectangles[r];
        }
        rectText = text.substring(textPos, nextRectPos).trim();
        // If we want newlines to break strings, we can remove everything up until the first newline in the middle of this string.
        textStrings.push(rectText);
        textPos = r < rectangles.length ? nextRectPos + rectangles[r].length : len;
      }
    }
    return textStrings;
  }

  function addNbxBoxes(boxes, markers, nbxText) {
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
        var textStrings = findTextForEachRectangle(tag.text, rectStrings);
        if (!isEmpty(rectStrings)) {
          for (var r = 0; r < rectStrings.length; r++) {
            var overlay = createOverlay(null, parseRect(rectStrings[r], imgWidth, imgHeight));
            boxes.push(overlay);
            if (textStrings[r] && textStrings[r].length > 0) {
              addMarker(markers, overlay.id, textStrings[r], null);
            }
          }
        }
      }
    }
  }

  function addArticleRectangles(imageArksAndRects, boxes, elementMap, doc) {
    // Assume single image for now.
    var rects = imageArksAndRects[0].rectangles;
    if (rects) {
      for (var r = 0; r < rects.length; r++) {
        var overlay = createOverlay("article", rects[r], elementMap, doc);
        boxes.push(overlay);
      }
    }
  }
  
  // overlayBoxes(doc) ============================
  var boxes = [];
  var markers = [];
  var elementMap = {}; // Map of highlight HTML element id -> GedcomX object ID that the element is associated with.

  // Get an array of objects with {image: <imageArk>, rectangles: [array of Rectangle object with x1,y1,x2,y2]}
  var imageArksAndRects = getImageArks(doc);
  if (!isEmpty(imageArksAndRects)) {
    var imageArk = imageArksAndRects[0].image;
    var imageApid = imageArkToApid(imageArk);
    viewer.src = "https://www.familysearch.org/dz/v1/apid:" + imageApid + "/";

    // Add record/article-level bounding boxes.
    addArticleRectangles(imageArksAndRects, boxes, elementMap, doc);
  }

  // Add bounding boxes for all words. (Do this before names, dates and places, so that those will be on top)
  addNbxBoxes(boxes, markers, findNbxDocumentText(doc));

  if (doc.persons) {
    for (var p = 0; p < doc.persons.length; p++) {
      var person = doc.persons[p];
      addFieldBoxes(boxes, markers, person, "person", elementMap);
      addNameBoxes(boxes, markers, person.names, elementMap);
      addFactBoxes(boxes, markers, person.facts, elementMap);
      if (person.gender) {
        addFieldBoxes(boxes, markers, person, "gender", elementMap);
      }
    }
  }
  if (doc.relationships) {
    for (var r = 0; r < doc.relationships.length; r++) {
      var relationship = doc.relationships[r];
      addFieldBoxes(boxes, markers, relationship, "relationship", elementMap);
      addFactBoxes(boxes, markers, relationship.facts, elementMap);
    }
  }
  if (boxes.length > 0 || markers.length > 0) {
    viewer.overlays.setAll(boxes);
    viewer.markers.setAll(markers);
  }
  return elementMap;
}