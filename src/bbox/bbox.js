var overlayTypeIdMap = {};

function createOverlay(type, rectangle, id) {
  if (!id) {
    // If no ID is specified, use a separate 1-based counter for each type to give each box an id, e.g., "name-1" or "date-13".
    var lastId = overlayTypeIdMap[type];
    id = lastId ? lastId + 1 : 1;
    overlayTypeIdMap[type] = id;
  }

  var overlay = {
    id: id,
    type: type,
    selectable: true,
    x: rectangle.x,
    y: rectangle.y,
    width: rectangle.width,
    height: rectangle.height
  };
  if (rectangle.width > rectangle.x && rectangle.height > rectangle.y) {
    //todo: remove this when we've fixed the rectangle generation.
    // Looks like we got x, y, x2, y2 instead of x, y, width, height
    overlay.width = rectangle.width - rectangle.x;
    overlay.height = rectangle.height - rectangle.y;
  }
  return overlay;
}

function overlayBoxes(viewer, doc) {

  /**
   * Look in the value to see if it has any source references with rectangle qualifiers.
   * If so, create an overlay box for each rectangle (of the given 'boxType') and
   * add it to boxes[].
   * (Note that this assume that all sources with rectangles are referring to the same image.
   *  If this is not the case, then modify boxes[] to be a map of source ID -> boxes[] for that source.)
   * @param boxes
   * @param value
   * @param boxType
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

  // overlayBoxes ============================
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

  //todo: Article/record-level bounding boxes from record source description's image source.

  viewer.overlays.setAll(boxes);

}