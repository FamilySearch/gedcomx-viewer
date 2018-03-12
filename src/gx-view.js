function readGedcomX(url, callback) {
  $.ajax({type: "GET",
    dataType: "json",
    accepts: {json: "application/x-gedcomx-v1+json"},
    url: url,
    success: function (stuff, textStatus, jqKHR) {
      callback(url, stuff);
    },
    error: function (jqXHR, textStatus, errorThrown) {
      console.log("Didn't make it: " + url);
    }
  });
}

// Having read a GedcomX record, see if the sourceDescription has a recordDescriptor.
// If so, read the collection object that has it, and call back to showRecord.
// If not, just go straight to showRecord.
function readRecordDescriptor(doc) {

}

function encode(s) {
  return $('<div/>').text(s).html();
}

function empty(s) {
  return s === undefined || s === null || s.length === 0;
}

function makeGenderHtml(gender) {
  var genderString;
  if (gender) {
    if (gender.type === 'http://gedcomx.org/Male') {
      genderString = '<span class="male">M</span>';
    }
    else if (gender.type === 'http://gedcomx.org/Female') {
      genderString = '<span class="female">F</span>';
    }
    else {
      genderString = '<span class="unknown">?</span>';
    }
  }
  else {
    genderString = '<span class="unknown">?</span>';
  }
  return genderString;
}

function makeNameHtml(name) {
  var j, k, nameForm, namePart;
  var s = "<span class=\'name\'>";
  if (!empty(name.type) && name.type !== "http://gedcomx.org/BirthName") {
    s += "[" + name.type.replace("http://gedcomx.org/", "") + "]";
  }
  if (name.hasOwnProperty('nameForms')) {
    for (j = 0; j < name.nameForms.length; j++) {
      nameForm = name.nameForms[j];
      if (j > 0) {
        s += "</span><br/><span>[Form" + (empty(nameForm.lang) ? "" : " (" + nameForm.lang + ")") + ": ";
      }
      s += (empty(nameForm.fullText) ? encode("<Empty>") : encode(nameForm.fullText));
      if (j > 0) {
        s += "]";
      }
      if (nameForm.parts) {
        for (k = 0; k < nameForm.parts.length; k++) {
          namePart = nameForm.parts[k];

        }
      }
      //todo: name parts, fields...
    }
  }
  s += "</span>";
  return s;
}

/**
 * Make HTML for a person in a GedcomX document.
 * @param doc - GedcomX document that contains the person
 * @param person - Person object (from within that GedcomX document) to use.
 * @param idMap - Map of local person ID (p_1234567) to 1-based index (1, 2, 3...)
 * @returns {string}
 */
function makePersonHtml(doc, person, idMap) {
  var s = "<div class='person' " + (person.id ? " id='" + encode(person.id) + "'" : "") + ">";
  s += makeGenderHtml(person.hasOwnProperty('gender') ? person.gender : null) + " P" + idMap[person.id] + ". ";

  var i;

  if (person.hasOwnProperty('names')) {
    for (i = 0; i < person.names.length; i++) {
      s += makeNameHtml(person.names[i]);
    }
  }

  if (person.hasOwnProperty('facts')) {
    s += getFactsHtml(person.facts);
  }

  if (person.hasOwnProperty('fields')) {
    s += getFieldsHtml(person.fields);
  }

  s += getRelativesHtml(doc, person, idMap);

  if (person.principal) {
    s += "<p class='principal'>Principal: true</p>";
  }

  var identifier = getIdentifier(person);
  s += "  <p class='ark'><a href='" + identifier +"'>" + identifier + "</a> (" + person.id + ")</p>\n";
  s += "</div>\n"; // person div.
  return s;
}

function getFieldHtml(field) {
  var s = "";
  var fieldType = parseType(field.type);
  // Get iterpreted value, if any, or else the original value.
  var bestValue = GedxPersonaPOJO.getBestValue(field);
  s += "<p class='field'>" + encode(fieldType) + ": " + encode(bestValue) + "</p>";
  //todo: Add field values.
  return s;
}

function parseType(typeUri) {
  return typeUri === null || typeUri === undefined ? "(No type)" :
      typeUri.
        // Remove everything up to the last "/"
        replace(/.*\//gi, "").
        // Insert spaces before capitals, e.g., "SomeType" -> "Some Type"
        replace(/([A-Z])/g, ' $1');
        // Get iterpreted value, if any, or else the original value.
}

function getFieldsHtml(fields) {
  var i;
  var s = "";
  for (i = 0; i < fields.length; i++) {
    s += getFieldHtml(fields[i]);
  }
  return s;
}

function relationshipFactsHtml(person1Id, person2Id, relationshipType, relationships) {
  var i;
  var rel;
  var s = "";
  for (i = 0; i < relationships.length; i++) {
    rel = relationships[i];
    if (relationshipType === rel.type && rel.hasOwnProperty("facts")) {
      if ("#" + person1Id === rel.person1.resource && "#" + person2Id === rel.person2.resource) {
        s += getFactsHtml(rel.facts, true);
      }
      else if (relationshipType === "http://gedcomx.org/Couple" && "#" + person2Id === rel.person1.resource && "#" + person1Id === rel.person2.resource) {
        // For couples, display the marriage under both the husband and the wife.
        s += getFactsHtml(rel.facts, true);
      }
    }
  }
  return s;
}

// Get the HTML for the list of a person's relatives.
function getRelativesHtml(doc, person, idMap) {
  var s = "";
  var parentsAndSiblings = GedxPersonaPOJO.getParentsAndSiblings(doc, person);
  var parentFamily, parent, parentLabel;
  var spouseAndChildren, spouseFamily, spouseLabel;
  var child, childLabel;
  var i, j;
  for (i = 0; i < parentsAndSiblings.length; i++) {
    parentFamily = parentsAndSiblings[i];
    if (parentFamily.parents) {
      for (j = 0; j < parentFamily.parents.length; j++) {
        parent = parentFamily.parents[j];
        parentLabel = relativeLabel(parent.gender, "Father", "Mother", "Parent");
        s += relativeHtml(parentLabel, idMap[parent.id], parent.name);
      }
    }
  }
  spouseAndChildren = GedxPersonaPOJO.getSpousesAndChildren(doc, person);
  for (i = 0; i < spouseAndChildren.length; i++) {
    spouseFamily = spouseAndChildren[i];
    var spouse = spouseFamily.spouse;
    if (!empty(spouse)) {
      spouseLabel = relativeLabel(spouse.gender, "Husband", "Wife", "Spouse");
      s += relativeHtml(spouseLabel, idMap[spouse.id], spouse.name);
      s += relationshipFactsHtml(person.id, spouse.id, "http://gedcomx.org/Couple", doc.relationships);
    }
    if (!empty(spouseFamily.children)) {
      for (j = 0; j < spouseFamily.children.length; j++) {
        child = spouseFamily.children[j];
        childLabel = relativeLabel(child.gender, "Son", "Daughter", "Child");
        s += relativeHtml(childLabel, idMap[child.id], child.name, spouseFamily.hasOwnProperty("spouse"));
      }
    }
  }
  return s;

  /**
   * Create HTML for information about a relative. (e.g., "Father: P2. Fred Jones")
   * @param relativeType - Type of relative (e.g., "Father")
   * @param relativeIndex - Index of the relative (e.g., 2)
   * @param relativeName - Name of the relative (e.g., "Fred Jones")
   * @param shouldIndent - Flag for whether to indent (i.e., indent children under the spouse they go with, if any).
   * @returns {string}
   */
  function relativeHtml(relativeType, relativeIndex, relativeName, shouldIndent) {
    if (empty(relativeType)) {
      relativeType = '(Unknown relative type)';
    }
    return "<p class='" + (shouldIndent ? "child" : "relative") + "'>" + relativeType + ": P" + relativeIndex + ". " + relativeName + "</p>";
  }

  function relativeLabel(gender, maleType, femaleType, neutralType) {
    if (gender === "M") {
      return maleType;
    }
    if (gender === "F") {
      return femaleType;
    }
    return neutralType;
  }
}

function getFactsHtml(facts, shouldIndent) {
  var i, fact, hadStuff;
  var s = "";
  for (i = 0; i < facts.length; i++) {
    s += "<p class='fact" + (shouldIndent ? " indented" : "") + "'>";
    fact = facts[i];
    s += encode(parseType(fact.type));
    s += ": ";
    hadStuff = false;
    if (fact.hasOwnProperty('date') && !empty(fact.date.original)) {
      s += encode(fact.date.original);
      hadStuff = true;
    }
    if (fact.hasOwnProperty('place') && !empty(fact.place.original)) {
      if (hadStuff) {
        s += encode("; ");
      }
      s += encode(fact.place.original);
      hadStuff = true;
    }
    if (fact.hasOwnProperty('value') && !empty(fact.value)) {
      if (hadStuff) {
        s += encode("; ");
      }
      s += encode(fact.value);
    }
    s += "</p>\n";
  }
  return s;
}

function getIdentifier(object) {
  var id = null;
  if (object.hasOwnProperty('identifiers')) {
    id = getFirst(object.identifiers["http://gedcomx.org/Persistent"]);
    if (id === null) {
      id = getFirst(object.identifiers["http://gedcomx.org/Primary"]);
      if (id === null) {
        for (var idType in object.identifiers) {
          if (object.identifiers.hasOwnProperty(idType)) {
            id = getFirst(object.identifiers[idType]);
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
  if (!empty(array)) {
    return array[0];
  }
  return null;
}

/**
 * Fetch the GedcomX historical record from the given URL, generate HTML for it, and put that HTML into the div with local id "gx".
 * @param url - URL of a GedcomX historical record.
 * @param doc - GedcomX document read from there.
 */
function showRecord(url, doc) {
  var gxDiv = $("#gx");
  gxDiv.text("Processing record...");
  //buildDocMaps(doc);
  var s = "<p>GedcomX URL: " + url + "</p>\n";
  var i;
  // Map of local person id (p_1234567) to index (1, 2, 3...)
  var idMap = {};

  if (doc.hasOwnProperty('persons')) {
    // Create a short 1-based person index for viewing.
    for (i = 0; i < doc.persons.length; i++) {
      idMap[doc.persons[i].id] = i + 1;
    }
    for (i = 0; i < doc.persons.length; i++) {
      s += makePersonHtml(doc, doc.persons[i], idMap);
    }
  }
  if (doc.hasOwnProperty('fields')) {
    s += getFieldsHtml(doc.fields);
  }
  if (doc.hasOwnProperty('relationships')) {
    //todo: Show relationship graph.
  }
  gxDiv.html(s);
  $("#p_15024659740");
}