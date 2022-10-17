// General-purpose utility functions
function isEmpty(a) {
  return !a || a.length === 0;
}

function encode(s) {
  if (!s) {
    s="";
  }
  return $('<div/>').text(s).html();
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
    let MOD_ADLER = 65521;
    let a = 1;
    let b = 0;
    for (let i = 0; i < inString.length; i++) {
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
    let result = 0;
    let alphabet = "M9S3Q7W4HCZ8D6XFNJVK2LGP5RTYB1";
    let numberBase = alphabet.length;

    for (let i = 0; i < encodedString.length; i++) {
      let ch = encodedString.charAt(i);
      let nextVal = alphabet.indexOf(ch);
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
    let len1 = decode(encodedThApid.substring(0, 1));
    let len2 = decode(encodedThApid.substring(1, 2));
    // Get the three JEncoded trigit ranges, and decode each into a number.
    let v1 = decode(encodedThApid.substring(2, 2 + len1));
    let v2 = decode(encodedThApid.substring(2 + len1, 2 + len1 + len2));
    let v3 = decode(encodedThApid.substring(2 + len1 + len2));
    let s = "TH-" + v1 + "-" + v2 + "-" + v3 + "-";
    let checksum = computeChecksum(s);
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
    let len1 = decode(encodedDgsApid.substring(0, 1));
    let dgs = decode(encodedDgsApid.substring(1, 1 + len1));
    let img = decode(encodedDgsApid.substring(1 + len1));
    return "DGS-" + dgs.toString().padStart(9, '0') + "_" + img.toString().padStart(5, '0');
  }

  let noParams = imageArk.replace(/\?.*/, ""); // Remove any query parameters
  let name = noParams.replace(/.*\//, ""); // Strip off everything before the "3:..."
  let jEncodedValue = name.replace(/.*:/, "");
  if (name.startsWith("3:1:")) {
    return decodeThApid(jEncodedValue);
  }
  else if (name.startsWith("3:2:")) {
    return decodeDgsApid(jEncodedValue);
  }
  return null; // unrecognized Image Ark format.
}

let overlayTypeIdMap = {};

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
 * Parse a type URI (e.g., "http://gedcomx.org/Male" or "http://familysearch.org/types/relationships/AuntOrUncle")
 *   and return a displayable string from it (e.g., "Male" or "Aunt Or Uncle").
 * Removes the URL path, and separates capitalized letters with a space.
 * @param typeUri - Type URL
 * @returns Displayable string.
 */
function parseType(typeUri) {
  return typeUri === null || typeUri === undefined ? "(No type)" :
      typeUri.
      // Remove everything up to the last "/"
      replace(/.*\//gi, "").
      // Insert spaces before capitals, e.g., "SomeType" -> "Some Type"
      replace(/([A-Z])/g, '$1');
}

/**
 * Find the 'agent' object in the given GedcomX document that has the given ID (with or without the "#").
 * @param doc - GedcomX document to look in.
 * @param ref - Local ID of an agent (with or without the "#").
 * @returns Agent object, or null if not found.
 */
function getAgent(doc, ref) {
  if (ref && ref.startsWith("#")) {
    let id = ref.substr(1);
    if (doc.agents) {
      for (let agent of doc.agents) {
        if (agent.id === id) {
          return agent;
        }
      }
    }
  }
  return null;
}

// Get a date string from the date in the given fact (if any), or return 'undefined' otherwise.
function getFactDate(fact) {
  if (fact && fact.date && fact.date.original) {
    return fact.date.original;
  }
  return undefined;
}

function getFactPlace(fact) {
  if (fact && fact.place && fact.place.original) {
    return fact.place.original;
  }
  return undefined;
}

// Get the first "Persistent" identifier (or "Primary" identifier, or any other identifier) from the given GedcomX object
function getIdentifier(gxObject) {
  let id = null;
  if (gxObject.identifiers) {
    id = getFirst(gxObject.identifiers["http://gedcomx.org/Persistent"]);
    if (id === null) {
      id = getFirst(gxObject.identifiers["http://gedcomx.org/Primary"]);
      if (id === null) {
        for (let idType in gxObject.identifiers) {
          if (gxObject.identifiers.hasOwnProperty(idType)) {
            id = getFirst(gxObject.identifiers[idType]);
            if (id !== null) {
              return id;
            }
          }
        }
      }
    }
  }
  return id;
}

function getFirst(array) {
  if (!isEmpty(array)) {
    return array[0];
  }
  return null;
}

/**
 * Find the SourceDescription object for the given source ID or URL (i.e., from the document's root "description" attribute)
 * @param doc - GedcomX document (e.g., for a persona or record). If null, a null sourceDescription will be returned.
 * @param sourceIdOrUrl - The local ID (with or without "#") or full "about" URL for the SourceDescription being sought.
 *        (If null, then use the document's "description" attribute to find the "main" source description from the doc).
 * @returns SourceDescription object, or null if it could not be found.
 */
function getSourceDescription(doc, sourceIdOrUrl) {
  let source = null;

  if (doc) {
    if (!sourceIdOrUrl) {
      sourceIdOrUrl = doc.description;
    }
    if (sourceIdOrUrl) {
      if (sourceIdOrUrl.charAt(0) === '#') {
        sourceIdOrUrl = sourceIdOrUrl.substring(1);
      }

      if (doc.sourceDescriptions) {
        for (let srcDesc of doc.sourceDescriptions) {
          if (srcDesc.about === sourceIdOrUrl || srcDesc.id === sourceIdOrUrl) {
            source = srcDesc;
            break;
          }
        }
      }
    }
  }
  return source;
}

// Find the source description of the 'source' for the record, i.e., for the 'document' that contains the original text.
function getMainSourceDocumentSourceDescription(doc) {
  let recordSourceDescription = getSourceDescription(doc, doc.description);

  let documentSourceDescription;
  if (recordSourceDescription && recordSourceDescription.sources && recordSourceDescription.sources.length > 0) {
    documentSourceDescription = getSourceDescription(doc, recordSourceDescription.sources[0].description);
  }
  return documentSourceDescription;
}

// Find the source "Document" object within the given GedcomX document, and return it (or null if not found).
function getSourceDocument(doc, mainSourceDescription) {
  if (!mainSourceDescription) {
    mainSourceDescription = getMainSourceDocumentSourceDescription(doc);
  }
  let document;
  if (mainSourceDescription && mainSourceDescription.about) {
    let sourceDocumentId = mainSourceDescription.about.startsWith("#") ? mainSourceDescription.about.substr(1) : "text";
    if (doc.documents) {
      for (let candidate of doc.documents) {
        if (sourceDocumentId === candidate.id) {
          document = candidate;
          break;
        }
      }
    }
  }
  return document;
}

function findDocumentText(doc, docId) {
  if (doc.documents) {
    if (!docId) {
      docId = "nbx";
    }
    for (let document of doc.documents) {
      if (document.id === docId) {
        return document.text;
      }
    }
  }
  return null;
}

/**
 * Create an object with {x, y, width, height}, either from those four values, or four a comma-seprated string containing those four values.
 * @param x1OrRectangle - Either an x coordinate, or a string with "x,y,width,height" all in them.
 * @param y1 - y-coordinate of upper-left corner (if not using rectangle string)
 * @param x2 - x-coordinate of lower-right corner (if not using rectangle string)
 * @param y2 - y-coordinate of lower-right corner (if not using rectangle string)
 * @constructor
 */
function Rectangle(x1OrRectangle, y1, x2, y2) {
  if (!y1) {
    // Parse a string of the form "x1,y1,x2,y2".
    let parts = x1OrRectangle.split(",");
    this.x1 = parts[0];
    this.y1 = parts[1];
    this.x2 = parts[2];
    this.y2 = parts[3];
  }
  else {
    this.x1 = x1OrRectangle;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }
}

/**
 * Find the image Ark(s) that are the source of the given indexed GedcomX document, along with corresponding record/article rectangles within each.
 *   Uses the 'description' element at the root to get the id of the Source Description for the Record.
 *   Then uses the 'sources' list of that record (recursively, following the source change until it finds DigitalArtifact sources).
 *   For each DigitalArtifact source, adds an object to the return array that includes:
 *     image: image Ark.
 *     rectangles: array of rectangle objects, each with {x1,y1,x2,y2}, hopefully in fractional (0..1) coordinates.
 * @param doc - GedcomX document.
 * @returns {*}
 */
function getImageArks(doc) {
  function isImage(sd) {
    return sd && sd.resourceType && (sd.resourceType === "http://gedcomx.org/DigitalArtifact" || sd.resourceType === "http://gedcomx.org/Image");
  }

  function isRecord(sd) {
    return sd && sd.resourceType && sd.resourceType === "http://gedcomx.org/Record";
  }

  function findImageArksAndRectangles(sd, imageArks) {
    if (sd && imageArks.length === 0) {
      if (!isEmpty(sd.sources)) {
        for (let source of sd.sources) {
          let rectangles = [];
          if (source.qualifiers) {
            for (let qualifier of source.qualifiers) {
              if (qualifier.name === "http://gedcomx.org/RectangleRegion") {
                rectangles.push(new Rectangle(qualifier.value));
              }
            }
          }
          if (source.description) {
            let nextSd = getSourceDescription(doc, source.description);
            if (isImage(nextSd)) {
              let arkAndRectangles = {image: nextSd.about};
              if (!isEmpty(rectangles)) {
                arkAndRectangles.rectangles = rectangles;
              }
              imageArks.push(arkAndRectangles);
            }
            else {
              findImageArksAndRectangles(nextSd, imageArks);
            }
          }
        }
      }
    }
  }

  // Array of objects, one for each source image found. Each object has {ark: <URL>, coordinates: array of objects with {x1,y1,x2,y2})
  let imageArks = [];
  // Get the "main" SourceDescription for this GedcomX document (i.e., for this Record).
  let mainSd = getSourceDescription(doc, doc.description);
  let recordSd = mainSd;
  while (recordSd && !isRecord(recordSd) && recordSd.componentOf) {
    recordSd = getSourceDescription(doc, recordSd.componentOf.description);
  }

  findImageArksAndRectangles(recordSd ? recordSd : mainSd, imageArks);

  return imageArks;
}
