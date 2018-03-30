function encode(s) {
  return $('<div/>').text(s).html();
}

function empty(s) {
  return s === undefined || s === null || s.length === 0;
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

function card(sectionName, sectionContent, level) {
  level = level || 2;
  return div({class: "card m-1 p-0"})
    .append(div({class:"card-body p-0"})
      .append($("<h" + level + "/>", {class: "card-title card-header"}).text(sectionName))
      .append(div({class: "card-text p-3"}).append(sectionContent)));
}

function accordionSection(parentId, sectionName, sectionContent) {
  var sectionHeaderId = parentId + "_" + sectionName;
  var sectionContentId = parentId + "_" + sectionName + "_content";
  var sectionHeader = div({class: "card-header", id: sectionHeaderId});
  $("<h4/>").append($("<button/>", {
    "class" : "btn btn-link",
    "data-toggle": "collapse",
    "data-target": "#" + sectionContentId,
    "aria-expanded": "false",
    "aria-controls": sectionContentId
  }).text(sectionName)).appendTo(sectionHeader);

  var sectionBody = div({
                          "id": sectionContentId,
                          "class": "collapse",
                          "aria-labelledby": sectionHeaderId,
                          "data-parent": "#" + parentId
                        });
  sectionBody.append(div({class: "card-body"}).append(sectionContent))

  return div({class: "card"}).append(sectionHeader).append(sectionBody);
}

function dl(items, attrs) {
  var list = $("<dl/>", attrs);
  for (var key in items) {
    if (items.hasOwnProperty(key)) {
      list.append($("<dt/>").text(key)).append($("<dd/>").text(items[key]));
    }
  }
  return list
}

function div(attrs) {
  return $("<div/>", attrs);
}

function span(attrs) {
  return $("<span/>", attrs);
}

function buildRecordUI(doc, url) {
  var record = div({ id: "record"});
  record.append($("<h1/>").append(span().text("Record ")));

  var recordMetadata = {};

  if (url) {
    recordMetadata.URL = url;
  }

  if (doc.hasOwnProperty('description')) {
    var sd = GedxPersonaPOJO.getSourceDescription(doc, doc.description);
    if (sd) {
      if (sd.hasOwnProperty("titles")) {
        recordMetadata.Title = sd.titles[0].value;
      }

      if (sd.hasOwnProperty("coverage")) {
        var coverage = sd.coverage[0];
        recordMetadata.Type = parseType(coverage.recordType);
        if (coverage.hasOwnProperty("temporal")) {
          recordMetadata.Date = coverage.temporal.original;
        }
        if (coverage.hasOwnProperty("spatial")) {
          recordMetadata.Place = coverage.spatial.original;
        }
      }
    }
  }
  record.append(dl(recordMetadata));

  var i;
  // Map of local person id (p_1234567) to index (1, 2, 3...)
  var idMap = {};
  var path = "";

  if (doc.hasOwnProperty('persons')) {
    // Create a short 1-based person index for viewing.
    for (i = 0; i < doc.persons.length; i++) {
      idMap[doc.persons[i].id] = i + 1;
    }

    record.append(card("Persons", buildPersonsUI(doc, idMap, path)));
  }
  if (doc.hasOwnProperty('relationships')) {
    record.append(card("Relationships", buildRelationshipsUI(doc, idMap, path)));
  }
  if (doc.hasOwnProperty('fields')) {
    //hide fields for now
    //record.append(card("Fields", buildFieldsUI(doc.fields, path + ".fields")));
  }
  return record;
}

function buildPersonsUI(doc, idMap, path) {
  var i;
  var persons = div({id: "persons"});
  path = path + ".persons";
  for (i = 0; i < doc.persons.length; i++) {
    persons.append(buildPersonUI(doc, doc.persons[i], idMap, path + '[' + i + "]"));
  }
  return persons;
}

function buildPersonUI(doc, person, idMap, path) {
  var personCard = div({ class: "person card m-3", id: encode(person.id)} );
  var personCardBody = div({class: "card-body p-0"}).appendTo(personCard);
  var personCardTitle =  $("<h3/>", {class: "card-title card-header"}).appendTo(personCardBody);
  personBadge(idMap[person.id], GedxPersonaPOJO.getGenderString(person)).appendTo(personCardTitle);
  span({"json-node-path" : path}).text(GedxPersonaPOJO.getBestNameValue(person)).appendTo(personCardTitle);
  if (person.principal) {
    span({ class: "principal badge badge-pill badge-primary", "json-node-path" : path + ".principal"}).append(span({class: "oi oi-star"})).append(span().text("Principal")).appendTo(personCardTitle);
  }

  var identifier = getIdentifier(person);
  if (identifier) {
    div({class: "card-text m-2", "json-node-path" : path + ".identifiers"}).append(dl({"Identifier": identifier})).appendTo(personCardBody);
  }

  var personCardBodyContent = div({class:"row"});
  div({class: "container"}).append(personCardBodyContent).appendTo(personCardBody);

  if (person.hasOwnProperty('names')) {
    var names = buildNamesUI(person, path);
    personCardBodyContent.append(div({class: "col"}).append(card("Names", names, 5)));
    //accordionSection(contentId, "Names", names).appendTo(personCardBodyContent);
  }

  if (person.hasOwnProperty('facts')) {
    var facts = buildFactsUI(person.facts, path + ".facts");
    personCardBodyContent.append(div({class: "col"}).append(card("Facts", facts, 5)));
    //accordionSection(contentId, "Facts", facts).appendTo(personCardBodyContent);
  }

  if (person.hasOwnProperty('fields')) {
    //hide fields for now
    //var fields = buildFieldsUI(person.fields, path + ".fields");
    //personCardBodyContent.append(div({class: "col"}).append(card("Fields", fields, 5)));
    //accordionSection(contentId, "Fields", fields).appendTo(personCardBodyContent);
  }

  var relatives = buildRelativesUI(doc, person, idMap);
  personCardBodyContent.append(div({class: "col"}).append(card("Relatives", relatives, 5)));
  //accordionSection(contentId, "Relatives", relatives).appendTo(personCardBodyContent);

  return personCard;
}

function personBadge(localId, gender) {
  var genderClass = gender ? gender.charAt(0) === 'M' ? "gender-male" : gender.charAt(0) === 'F' ? "gender-female" : "gender-unknown" : "gender-unknown";
  return span({class: "local-pid badge badge-pill badge-secondary " + genderClass}).append(span({class: "oi oi-person", title: "person", "aria-hidden": "true"})).append($("<small/>").text(localId));
}

function buildNamesUI(person, path) {
  var n = div({class: "names"});
  path = path + ".names";
  for (var i = 0; i < person.names.length; i++) {
    n.append(buildNameUI(person.names[i], path + "[" + i + "]"));
  }
  return n;
}

function buildNameUI(name, path) {
  var n = div({ class: "name text-nowrap"});

  var j, nameForm, namePart;
  if (!empty(name.type) && name.type !== "http://gedcomx.org/BirthName") {
    n.append(span({class: "name-type badge badge-dark"}).text(name.type.replace("http://gedcomx.org/", "")));
  }

  if (name.hasOwnProperty('nameForms')) {
    path = path + ".nameForms";
    for (var i = 0; i < name.nameForms.length; i++) {
      nameForm = name.nameForms[i];
      var nameFormPath = path + '[' + i + ']';
      if (!empty(nameForm.lang)) {
        n.append(span({class: "lang badge badge-dark", "json-node-path" : nameFormPath + ".lang"}).text(nameForm.lang));
      }
      n.append($("<h5/>", {class: "name-form", "json-node-path" : nameFormPath + ".fullText"}).text(empty(nameForm.fullText) ? "(Empty)" : nameForm.fullText));

      if (nameForm.parts) {
        n.append(buildNamePartsUI(nameForm.parts, nameFormPath + ".parts"));
      }
    }
  }

  return n;
}

function buildNamePartsUI(parts, path) {
  var i, part;
  var fs = $("<table/>", {class: "name-parts table table-sm"});
  $("<thead/>").append($("<tr/>").append($("<th>Part Type</th>")).append($("<th>Part Value</th>"))).appendTo(fs);
  var body = $("<tbody/>").appendTo(fs);
  for (i = 0; i < parts.length; i++) {
    var partPath = path + '[' + i + ']';
    part = parts[i];
    var f = $("<tr/>").appendTo(body);
    f.append($("<td/>", {class: "fact-type text-nowrap", "json-node-path" : partPath + ".type"}).text(parseType(part.type)));
    f.append($("<td/>", {class: "fact-value text-nowrap", "json-node-path" : partPath + ".value"}).text(part.value ? part.value : ""));
  }
  return fs;
}

function buildFactsUI(facts, path) {
  var i, j, fact;
  var fs = $("<table/>", {class: "facts table table-sm"});
  var valueNeeded = false;
  var ageNeeded = false;
  for (i = 0; i < facts.length; i++) {
    if (facts[i].value) {
      valueNeeded = true;
    }

    if (facts[i].qualifiers) {
      for (j = 0; j < facts[i].qualifiers.length; j++) {
        if (facts[i].qualifiers[j].name === "http://gedcomx.org/Age") {
          ageNeeded = true;
        }
      }
    }
  }

  var row = $("<tr/>").append($("<th>Type</th>")).append($("<th>Date</th>")).append($("<th>Place</th>"));
  if (valueNeeded) {
    row.append($("<th>Value</th>"));
  }
  if (ageNeeded) {
    row.append($("<th>Age</th>"));
  }
  $("<thead/>").append(row).appendTo(fs);

  var body = $("<tbody/>").appendTo(fs);
  for (i = 0; i < facts.length; i++) {
    var factPath = path + '[' + i + ']';
    fact = facts[i];
    var f = $("<tr/>").appendTo(body);
    if (fact.primary) {
      f.append($("<td/>", {class: "fact-type text-nowrap", "json-node-path" : factPath + ".type"}).append(span().text(parseType(fact.type) + " ")).append(span({class: "oi oi-star"})));
    }
    else {
      f.append($("<td/>", {class: "fact-type text-nowrap", "json-node-path" : factPath + ".type"}).text(parseType(fact.type)));
    }
    f.append($("<td/>", {class: "fact-date text-nowrap", "json-node-path" : factPath + ".date"}).text(fact.date ? fact.date.original : ""));
    f.append($("<td/>", {class: "fact-place text-nowrap", "json-node-path" : factPath + ".place"}).text(fact.place ? fact.place.original : ""));
    if (valueNeeded) {
      f.append($("<td/>", {class: "fact-value text-nowrap", "json-node-path": factPath + ".value"}).text(fact.value ? fact.value : ""));
    }
    if (ageNeeded) {
      if (fact.qualifiers) {
        for (j = 0; j < fact.qualifiers.length; j++) {
          if (fact.qualifiers[j].name === "http://gedcomx.org/Age") {
            f.append($("<td/>", {class: "fact-age text-nowrap", "json-node-path": factPath + ".qualifiers[" + j + "]"}).text(fact.qualifiers[j].value));
          }
        }
      }
      else {
        f.append($("<td/>", {class: "fact-age text-nowrap"}).text(""));
      }
    }
  }
  return fs;
}

function buildFieldsUI(fields, path) {
  var i, field;
  var fs = $("<table/>", {class: "fields table table-sm"});
  $("<thead/>").append($("<tr/>").append($("<th>Type</th>")).append($("<th>Value</th>"))).appendTo(fs);
  var body = $("<tbody/>").appendTo(fs);
  for (i = 0; i < fields.length; i++) {
    var fieldPath = path + '[' + i + ']';
    field = fields[i];
    var f = $("<tr/>", {"json-node-path" : fieldPath}).appendTo(body);
    f.append($("<td/>", {class: "field-type text-nowrap"}).text(parseType(field.type)));
    f.append($("<td/>", {class: "field-value text-nowrap"}).text(GedxPersonaPOJO.getBestValue(field)));
  }
  return fs;
}

// Get the HTML for the list of a person's relatives.
function buildRelativesUI(doc, person, idMap) {
  var r = div({class: "relatives"});
  var i;

  if (doc.relationships) {
    for (i = 0; i < doc.relationships.length; i++) {
      var relationship = doc.relationships[i];
      var ref1 = relationship.person1 ? relationship.person1.resource ? relationship.person1.resource : "" : "";
      var ref2 = relationship.person2 ? relationship.person2.resource ? relationship.person2.resource : "" : "";
      var isP1 = ref1.endsWith(person.id);
      var isP2 = ref2.endsWith(person.id);
      if (isP1 || isP2) {
        if (relationship.type === "http://gedcomx.org/Couple") {
          var spouseRef = isP1 ? ref2 : ref1;
          var spouse = findPersonByRef(doc, spouseRef);
          if (spouse) {
            var spouseLabel = relativeLabel(spouse.gender ? spouse.gender.type : null, "Husband", "Wife", "Spouse");
            r.append(relativeUI(spouse.id, spouseLabel, idMap[spouse.id], GedxPersonaPOJO.getBestNameValue(spouse), GedxPersonaPOJO.getGenderString(spouse)));
            r.append(buildRelationshipFactsUI(relationship));
          }
        }
        else if (relationship.type === "http://gedcomx.org/ParentChild") {
          if (isP1) {
            var childRef = isP1 ? ref2 : ref1;
            var child = findPersonByRef(doc, childRef);
            if (child) {
              var childLabel = relativeLabel(child.gender ? child.gender.type : null, "Son", "Daughter", "Child");
              r.append(relativeUI(child.id, childLabel, idMap[child.id], GedxPersonaPOJO.getBestNameValue(child), GedxPersonaPOJO.getGenderString(child)));
              r.append(buildRelationshipFactsUI(relationship));
            }
          }
          else {
            var parentRef = isP1 ? ref2 : ref1;
            var parent = findPersonByRef(doc, parentRef);
            if (parent) {
              var parentLabel = relativeLabel(parent.gender ? parent.gender.type : null, "Father", "Mother", "Parent");
              r.append(relativeUI(parent.id, parentLabel, idMap[parent.id], GedxPersonaPOJO.getBestNameValue(parent), GedxPersonaPOJO.getGenderString(parent)));
              r.append(buildRelationshipFactsUI(relationship));
            }
          }
        }
        else {
          var relativeRef = isP1 ? ref2 : ref1;
          var relative = findPersonByRef(doc, relativeRef);
          if (relative) {
            r.append(relativeUI(relative.id, parseType(relationship.type), idMap[relative.id], GedxPersonaPOJO.getBestNameValue(relative), GedxPersonaPOJO.getGenderString(relative)));
            r.append(buildRelationshipFactsUI(relationship));
          }
        }
      }
    }
  }

  return r;
}

function buildRelationshipFactsUI(rel) {
  var i;
  var facts = {};
  if (rel && rel.facts) {
    for (i = 0; i < rel.facts.length; i++) {
      var fact = rel.facts[i];
      facts[parseType(fact.type)] = (fact.date ? fact.date.original + " " : "") + (fact.place ? fact.place.original + " " : "") + (fact.value ? "(" + fact.value + ")" : "");
    }
  }
  return dl(facts, {class: "relationship-facts px-3"});
}

function relativeUI(relativeId, relativeType, relativeIndex, relativeName, relativeGender) {
  var r = $("<h5/>", {class: "relative text-nowrap"});
  personBadge(relativeIndex, relativeGender).appendTo(r);
  $("<a/>", { "class" : "link-unstyled", "href" : '#' + relativeId}).text(relativeName).appendTo(r);
  if (!empty(relativeType)) {
    r.append($("<small/>", {class: "relative-type text-muted"}).text(relativeType));
  }
  return r;
}

function relativeLabel(gender, maleType, femaleType, neutralType) {
  if (gender === "http://gedcomx.org/Male") {
    return maleType;
  }
  if (gender === "http://gedcomx.org/Female") {
    return femaleType;
  }
  return neutralType;
}

function buildRelationshipsUI(doc, idMap, path) {
  var i, relationship;
  var rs = $("<table/>", {class: "relationships table table-sm"});
  $("<thead/>").append($("<tr/>").append($("<th>Type</th>")).append($("<th>Person 1</th>")).append($("<th>Person 2</th>"))).appendTo(rs);
  var body = $("<tbody/>").appendTo(rs);
  path = path + ".relationships";
  for (i = 0; i < doc.relationships.length; i++) {
    var relationshipPath = path + '[' + i + ']';
    relationship = doc.relationships[i];
    var r = $("<tr/>").appendTo(body);
    r.append($("<td/>", {class: "relationship-type text-nowrap", "json-node-path" : relationshipPath + ".type"}).text(parseType(relationship.type)));
    var person1 = relationship.person1 ? findPersonByRef(doc, relationship.person1.resource) : null;
    if (person1) {
      r.append($("<td/>", {class: "relationship-person1 text-nowrap"}).append(personBadge(idMap[person1.id], GedxPersonaPOJO.getGenderString(person1))).append(span({"json-node-path": relationshipPath + ".person1"}).text(GedxPersonaPOJO.getBestNameValue(person1))));
    }
    else {
      r.append($("<td/>").text("(Unknown)"));
    }
    var person2 = relationship.person2 ? findPersonByRef(doc, relationship.person2.resource) : null;
    if (person2) {
      r.append($("<td/>", {class: "relationship-person2 text-nowrap"}).append(personBadge(idMap[person2.id], GedxPersonaPOJO.getGenderString(person2))).append(span({"json-node-path": relationshipPath + ".person2"}).text(GedxPersonaPOJO.getBestNameValue(person2))));
    }
    else {
      r.append($("<td/>").text("(Unknown)"));
    }
  }
  return rs;
}

function findPersonByRef(doc, id) {
  if (id) {
    if (id.charAt(0) === '#') {
      id = id.substr(1);
    }

    if (doc.persons) {
      for (var i = 0; i < doc.persons.length; i++) {
        var person = doc.persons[i];
        if (person.id === id) {
          return person;
        }
      }
    }
  }
  return null;
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
