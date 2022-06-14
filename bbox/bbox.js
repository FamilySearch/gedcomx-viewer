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
  let overlayId = nextId(type, elementMap, gxObject);

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
 * Add highlight boxes and corresponding text markers to the image viewer, as found in the given GedcomX document.
 *   A map is returned with key = local HTML element "id" for each highlight created; and value = "id" of the GedcomX object it came from.
 *   The GedcomX object is adorned with such ids if it did not already have them.
 * elements are added to that map
 * @param viewer - Javascript object for the image viewer element.
 * @param doc - GedcomX document
 * @param sessionId - Session id to use in deep zoom tile requests.
 * @return map of id of highlight in HTML document to corresponding element in GedcomX document.
 */
function overlayBoxes(viewer, doc, sessionId) {

  /**
   * Create a "span" element to serve as a tooltip "marker", so that when you hover over a box, you can see what text is associated with that box.
   * @param text - Text to use
   * @param markerId - Unique ID to use for the span (e.g., "m_" + id of the overlay box it goes with).
   * @param boxType - Type of box: "name", "date", "place" or null/undefined for default.
   * @returns JQuery object for the new span element.
   */
  function makeMarkerSpan(text, markerId, boxType) {
    let html = "<span class='marker-" + (boxType ? boxType : "default") + "' id='" + markerId + "'>" + encode(text) + "</span>";
    return $.parseHTML(html);
  }

  function addMarker(markers, overlayId, text, boxType) {
    let $markers = $("#markers");

    let markerId = "m_" + overlayId;
    $markers.append(makeMarkerSpan(text, markerId, boxType));
    let markerNode = document.getElementById(markerId);
    let marker = {
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
      for (let sourceReference of gxValue.sources) {
        if (!isEmpty(sourceReference.qualifiers)) {
          for (let qualifier of sourceReference.qualifiers) {
            if (qualifier.name === "http://gedcomx.org/RectangleRegion") {
              let rectangle = new Rectangle(qualifier.value);
              let overlay = createOverlay(boxType, rectangle, elementMap, gxValue);
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
      for (let field of fieldContainer.fields) {
        if (field.values) {
          let text = null;
          for (let fieldValue of field.values) {
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
      for (let name of names) {
        addFieldBoxes(boxes, markers, name, "name", elementMap);
        if (name.nameForms) {
          for (let nameForm of name.nameForms) {
            addFieldBoxes(boxes, markers, nameForm, "name", elementMap);
            if (nameForm.parts) {
              for (let namePart of nameForm.parts) {
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
      for (let fact of facts) {
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
    for (let meta of metadata) {
      if (meta.tag === tag) {
        return meta.content;
      }
    }
    return null;
  }

  // Parse "[10,20:30,40] " (using pixel coordinates) into {x1,y1,x2,y2}, using fractional coordinates.
  function parseRect(rectString, imgWidth, imgHeight) {
    let parts = rectString.match(/\[(\d+),(\d+):(\d+),(\d+)] */);
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
    let textStrings = [];
    if (!isEmpty(rectangles)) {
      let len = text.length;
      let r = 0;
      // Start at the text that is just past the next rectangle.
      let textPos = text.indexOf(rectangles[r]) + rectangles[r].length;

      while (textPos >= 0 && textPos < len) {
        r++;
        let nextRectPos = r < rectangles.length ? text.indexOf(rectangles[r], textPos) : len;
        if (nextRectPos < 0) {
          throw "Could not find expected rectangle " + r + ": " + rectangles[r];
        }
        let rectText = text.substring(textPos, nextRectPos).trim();
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
    let nbx = parseNbx(nbxText);

    let imgSizeArr = findMetadata(nbx.metadata, "IMGSIZE");
    let imgSize = imgSizeArr[0].text.split(",");
    let imgWidth = imgSize[0];
    let imgHeight = imgSize[1];

    for (let tag of nbx.sbody) {
      if (tag.rectangles) {
        //todo. So far there won't be any here.
      }
      if (tag.text) {
        let rectStrings = tag.text.match(/\[\d+,\d+:\d+,\d+] /g);
        let textStrings = findTextForEachRectangle(tag.text, rectStrings);
        if (!isEmpty(rectStrings)) {
          for (let r = 0; r < rectStrings.length; r++) {
            let overlay = createOverlay(null, parseRect(rectStrings[r], imgWidth, imgHeight));
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
    let rects = imageArksAndRects[0].rectangles;
    if (rects) {
      for (let rect of rects) {
        let overlay = createOverlay("article", rect, elementMap, doc);
        boxes.push(overlay);
      }
    }
  }
  
  // overlayBoxes(doc) ============================
  let boxes = [];
  let markers = [];
  let elementMap = {}; // Map of highlight HTML element id -> GedcomX object ID that the element is associated with.

  // Get an array of objects with {image: <imageArk>, rectangles: [array of Rectangle object with x1,y1,x2,y2]}
  let imageArksAndRects = getImageArks(doc);
  if (!isEmpty(imageArksAndRects)) {
    let imageArk = imageArksAndRects[0].image;
    let imageApid = imageArkToApid(imageArk);
    viewer.src = "https://www.familysearch.org/dz/v1/apid:" + imageApid + "/" +
        (sessionId == null ? "" : "?access_token=" + sessionId);

    // Add record/article-level bounding boxes.
    addArticleRectangles(imageArksAndRects, boxes, elementMap, doc);
  }

  // Add bounding boxes for all words. (Do this before names, dates and places, so that those will be on top)
  addNbxBoxes(boxes, markers, findDocumentText(doc));

  if (doc.persons) {
    for (let person of doc.persons) {
      addFieldBoxes(boxes, markers, person, "person", elementMap);
      addNameBoxes(boxes, markers, person.names, elementMap);
      addFactBoxes(boxes, markers, person.facts, elementMap);
      if (person.gender) {
        addFieldBoxes(boxes, markers, person, "gender", elementMap);
      }
    }
  }
  if (doc.relationships) {
    for (let relationship of doc.relationships) {
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