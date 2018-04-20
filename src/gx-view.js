//////////////
//UI Utilities
//////////////

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

function card(sectionName, sectionContent, level, addHook) {
  level = level || 2;
  var title = $("<h" + level + "/>", {class: "card-title card-header"}).append(span().text(sectionName));
  if (addHook) {
    title = title.append(addButton(addHook));
  }
  return div({class: "card m-1 p-0"})
    .append(div({class:"card-body p-0"})
    .append(title)
    .append(div({class: "card-text p-3"}).append(sectionContent)));
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

function addButton(hook) {
  return span({class: "trigger badge badge-pill badge-secondary ml-2"}).append(span({class: "oi oi-plus", title: "add", "aria-hidden": "true"})).click(hook);
}

function editButton(hook) {
  return span({class: "trigger badge badge-pill badge-secondary ml-2"}).append(span({class: "oi oi-wrench", title: "edit", "aria-hidden": "true"})).click(hook);
}

function copyButton(hook) {
  return span({class: "trigger badge badge-pill badge-secondary ml-2"}).append(span({class: "oi oi-clipboard", title: "copy", "aria-hidden": "true"})).click(hook);
}

function removeButton(hook) {
  return span({class: "trigger badge badge-pill badge-secondary ml-2"}).append(span({class: "oi oi-trash", title: "remove", "aria-hidden": "true"})).click(hook);
}

////////////////////
//GEDCOM X Utilities
////////////////////

function getSourceDescription(personaOrRecord, sourceIdOrUrl) {
  var source = null;

  if (personaOrRecord && sourceIdOrUrl) {
    if (sourceIdOrUrl.charAt(0) === '#') {
      sourceIdOrUrl = sourceIdOrUrl.substring(1);
    }

    if (personaOrRecord.sourceDescriptions) {
      parseSourceDesc();
    }
  }
  return source;

  function parseSourceDesc() {
    for (var i = 0; i < personaOrRecord.sourceDescriptions.length; i++) {
      var srcDesc = personaOrRecord.sourceDescriptions[i];
      if (srcDesc.about === sourceIdOrUrl || srcDesc.id === sourceIdOrUrl) {
        source = srcDesc;
        break;
      }
    }
  }
}

function getGenderString(person) {
  var gender = "Gender?";

  if (person && person.gender && person.gender.type) {
    switch (person.gender.type) {
      case "http://gedcomx.org/Male":
        gender = "Male";
        break;
      case "http://gedcomx.org/Female":
        gender = "Female";
        break;
      default:
        break;
    }
  }
  return gender;
}

function getBestNameValue(person) {
  if (!person.names || !person.names.length) {
    return null;
  }

  var name = person.names[0];
  if (!name.nameForms || !name.nameForms.length) {
    return null;
  }
  var nameForm = name.nameForms[0];
  return formName(nameForm.fullText);

  function formName(nameString) {
    if (!nameString && nameForm.parts && nameForm.parts.length > 0) {
      var i;
      nameString = "";
      for (i = 0; i < nameForm.parts.length; i++) {
        if (i > 0) {
          nameString += " ";
        }
        nameString += nameForm.parts[i].value;
      }
    }
    return nameString;
  }
}


/////////////
//UI Builders
/////////////

function buildRecordUI(doc, url, editHooks) {
  editHooks = editHooks || {};
  var record = div({ id: "record"});
  record.append($("<h1/>").append(span().text("Record ")));

  if (isSour(doc)) {
    record.append($("<h4/>", {class: "alert alert-warning", role:"alert"}).append(span({class: "oi oi-warning mr-2"})).append(span().text("Record is sour!")));
  }

  var recordMetadata = {};

  if (url) {
    recordMetadata.URL = url;
  }

  if (doc.hasOwnProperty('description')) {
    var sd = getSourceDescription(doc, doc.description);
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

    record.append(card("Persons", buildPersonsUI(doc, idMap, path, editHooks), 2, editHooks.addPerson));
  }
  if (doc.hasOwnProperty('relationships')) {
    record.append(card("Relationships", buildRelationshipsUI(doc, idMap, path, editHooks), 2, editHooks.addRelationship));
  }
  if (doc.hasOwnProperty('fields')) {
    //hide fields for now
    //record.append(card("Fields", buildFieldsUI(doc.fields, path + ".fields")));
  }
  return record;
}

function isSour(doc) {
  if (doc.fields) {
    for (var i = 0; i < doc.fields.length; i++) {
      var field = doc.fields[i];
      if (field.type === "http://familysearch.org/types/fields/FsVisStatus") {
        if (field.values && field.values.length > 0 && field.values[0].text === "restricted") {
          return true;
        }
      }
    }
  }
  return false;
}

function buildPersonsUI(doc, idMap, path, editHooks) {
  var i;
  var persons = div({id: "persons"});
  path = path + ".persons";
  for (i = 0; i < doc.persons.length; i++) {
    persons.append(buildPersonUI(doc, doc.persons[i], idMap, path + '[' + i + "]", editHooks));
  }
  return persons;
}

function buildPersonUI(doc, person, idMap, path, editHooks) {
  var personCard = div({ class: "person card m-3", id: encode(person.id)} );
  var personCardBody = div({class: "card-body p-0"}).appendTo(personCard);
  var personCardTitle =  $("<h3/>", {class: "card-title card-header"}).appendTo(personCardBody);

  buildPersonIdBadge(person, idMap).appendTo(personCardTitle);

  span({"json-node-path" : path}).html(getBestNameValue(person)).appendTo(personCardTitle);

  buildGenderBadge(person, path, editHooks).appendTo(personCardTitle);

  buildPrincipalBadge(person, path, editHooks).appendTo(personCardTitle);

  if (editHooks.removePerson) {
    removeButton(function() { editHooks.removePerson(person.id) }).appendTo(personCardTitle);
  }

  var identifier = getIdentifier(person);
  if (identifier) {
    div({class: "card-text m-2", "json-node-path" : path + ".identifiers"}).append(dl({"Identifier": identifier})).appendTo(personCardBody);
  }

  var personCardBodyContent = div({class:"row"});
  div({class: "container"}).append(personCardBodyContent).appendTo(personCardBody);

  if (person.names && person.names.length > 0) {
    var names = buildNamesUI(person, path, editHooks);
    var addNameHook = null;
    if (editHooks.addName) {
      addNameHook = function () { editHooks.addName(person.id); };
    }
    personCardBodyContent.append(div({class: "col"}).append(card("Names", names, 5, addNameHook)));
  }
  else if (editHooks.addName) {
    personCardBodyContent.append(div({class: "col"}).append(card("Names", span().text("(None)"), 5, function () { editHooks.addName(person.id); })));
  }

  if (person.facts && person.facts.length > 0) {
    var facts = buildFactsUI(person, person.facts, path + ".facts", editHooks);
    var addFactHook = null;
    if (editHooks.addPersonFact) {
      addFactHook = function () { editHooks.addPersonFact(person.id); };
    }
    personCardBodyContent.append(div({class: "col"}).append(card("Facts", facts, 5, addFactHook)));
  }
  else if (editHooks.addPersonFact) {
    personCardBodyContent.append(div({class: "col"}).append(card("Facts", span().text("(None)"), 5, function () { editHooks.addPersonFact(person.id); })));
  }

  if (person.hasOwnProperty('fields')) {
    //hide fields for now
    //var fields = buildFieldsUI(person.fields, path + ".fields");
    //personCardBodyContent.append(div({class: "col"}).append(card("Fields", fields, 5)));
  }

  var relatives = buildRelativesUI(doc, person, idMap, editHooks);
  var addRelativeHook = null;
  if (editHooks.addRelationship) {
    addRelativeHook = function() { editHooks.addRelationship(person.id) }
  }
  personCardBodyContent.append(div({class: "col"}).append(card("Relatives", relatives, 5, addRelativeHook)));

  return personCard;
}

function buildGenderBadge(person, path, editHooks) {
  var genderString = getGenderString(person);
  var genderClass = genderString ? genderString.charAt(0) === 'M' ? "gender-male" : genderString.charAt(0) === 'F' ? "gender-female" : "gender-unknown" : "gender-unknown";
  var genderBadge = span({ class: "gender badge badge-pill badge-secondary " + genderClass }).append(span({ "json-node-path": path + ".gender" }).text(genderString));
  if (editHooks.editGender) {
    span({class: "trigger oi oi-loop-circular ml-1"}).click(function() { editHooks.editGender(person.id); }).appendTo(genderBadge);
  }
  return genderBadge;
}

function buildPrincipalBadge(person, path, editHooks) {
  var principalUI;
  if (person.principal) {
    principalUI = span({class: "principal badge badge-pill badge-primary"}).append(span({"json-node-path": path + ".principal"}).text("Principal"));
  }
  else {
    principalUI = span({class: "principal badge badge-pill badge-secondary"}).append(span({class: "not"}).text("Principal"));
  }

  if (editHooks.editPrincipal) {
    span({class: "trigger oi oi-loop-circular ml-1"}).click(function () { editHooks.editPrincipal(person.id); }).appendTo(principalUI);
  }

  return principalUI;
}

function buildPersonIdBadge(person, idMap) {
  var localId = idMap[person.id];
  return span({class: "local-pid badge badge-pill badge-info"}).append(span({class: "oi oi-person", title: "person", "aria-hidden": "true"})).append($("<small/>").text(localId));
}

function buildNamesUI(person, path, editHooks) {
  var n = div({class: "names"});
  path = path + ".names";
  for (var i = 0; i < person.names.length; i++) {
    n.append(buildNameUI(person, person.names[i], path + "[" + i + "]", editHooks));
  }
  return n;
}

function buildNameUI(person, name, path, editHooks) {
  var n = div({ class: "name text-nowrap"});

  if (name.hasOwnProperty('nameForms')) {
    path = path + ".nameForms";
    for (var i = 0; i < name.nameForms.length; i++) {
      var nameForm = name.nameForms[i];
      var nameFormPath = path + '[' + i + ']';
      var fullText = $("<h5/>", {class: "name-form", "json-node-path" : nameFormPath + ".fullText"}).append(span().html(empty(nameForm.fullText) ? "(Empty)" : nameForm.fullText));

      if (nameForm.lang) {
        fullText.append(span({class: "lang badge badge-dark", "json-node-path" : nameFormPath + ".lang"}).text(nameForm.lang));
      }

      if (name.type && name.type !== "http://gedcomx.org/BirthName") {
        fullText.append(span({class: "name-type badge badge-dark"}).text(parseType(name.type)));
      }

      if (editHooks.editName) {
        fullText.append(editButton(function() { editHooks.editName(person.id, name)}));
      }

      if (editHooks.removeName) {
        fullText.append(removeButton(function() { editHooks.removeName(person.id, name.id)}));
      }

      n.append(fullText);

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

function buildFactsUI(subject, facts, path, editHooks, isRelationship) {
  var i, j;
  var factsUI = $("<table/>", {class: "facts table table-sm"});
  var valueNeeded = false;
  var ageNeeded = false;
  var causeNeeded = false;
  var removeFactFn = isRelationship ? editHooks.removeRelationshipFact : editHooks.removePersonFact;
  var editFactFn = isRelationship ? editHooks.editRelationshipFact : editHooks.editPersonFact;
  var copyFactFn = isRelationship ? null : editHooks.copyPersonFact;

  for (i = 0; i < facts.length; i++) {
    if (facts[i].value) {
      valueNeeded = true;
    }

    if (facts[i].qualifiers) {
      for (j = 0; j < facts[i].qualifiers.length; j++) {
        if (facts[i].qualifiers[j].name === "http://gedcomx.org/Age") {
          ageNeeded = true;
        }
        if (facts[i].qualifiers[j].name === "http://gedcomx.org/Cause") {
          causeNeeded = true;
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
  if (causeNeeded) {
    row.append($("<th>Cause</th>"));
  }
  if (removeFactFn || editFactFn || copyFactFn) {
    row.append($("<th/>"))
  }
  $("<thead/>").append(row).appendTo(factsUI);

  var body = $("<tbody/>").appendTo(factsUI);
  for (i = 0; i < facts.length; i++) {
    var factPath = path + '[' + i + ']';
    var fact = facts[i];
    var f = $("<tr/>");

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
            break;
          }
        }
      }
      else {
        f.append($("<td/>", {class: "fact-age text-nowrap"}).text(""));
      }
    }
    if (causeNeeded) {
      if (fact.qualifiers) {
        for (j = 0; j < fact.qualifiers.length; j++) {
          if (fact.qualifiers[j].name === "http://gedcomx.org/Cause") {
            f.append($("<td/>", {class: "fact-cause text-nowrap", "json-node-path": factPath + ".qualifiers[" + j + "]"}).text(fact.qualifiers[j].value));
            break;
          }
        }
      }
      else {
        f.append($("<td/>", {class: "fact-cause text-nowrap"}).text(""));
      }
    }

    if (removeFactFn || editFactFn || copyFactFn) {
      var editCell = $("<td/>", {class: "text-nowrap"});

      if (editFactFn) {
        editCell.append(editFactButton(subject, fact, editFactFn));
      }
      
      if (copyFactFn) {
        editCell.append(copyFactButton(subject, fact, copyFactFn));
      }

      if (removeFactFn) {
        editCell.append(removeFactButton(subject, fact, removeFactFn));
      }

      f.append(editCell);
    }

    f.appendTo(body);
  }
  return factsUI;
}

function editFactButton(subject, fact, editFactFn) {
  return editButton(function () {
    editFactFn(subject.id, fact);
  });
}

function copyFactButton(subject, fact, copyFactFn) {
  return copyButton(function () {
    copyFactFn(subject.id, fact.id);
  });
}

function removeFactButton(subject, fact, removeFactFn) {
  return removeButton(function () {
    removeFactFn(subject.id, fact.id);
  });
}

// Get the HTML for the list of a person's relatives.
function buildRelativesUI(doc, person, idMap, editHooks) {
  var r = div({class: "relatives"});
  var i;
  var hasRelatives = false;

  if (doc.relationships) {
    for (i = 0; i < doc.relationships.length; i++) {
      var relationship = doc.relationships[i];
      var ref1 = relationship.person1 ? relationship.person1.resource ? relationship.person1.resource : "" : "";
      var ref2 = relationship.person2 ? relationship.person2.resource ? relationship.person2.resource : "" : "";
      var isP1 = ref1.endsWith(person.id);
      var isP2 = ref2.endsWith(person.id);
      if (isP1 || isP2) {
        hasRelatives = true;
        if (relationship.type === "http://gedcomx.org/Couple") {
          var spouseRef = isP1 ? ref2 : ref1;
          var spouse = findPersonByRef(doc, spouseRef);
          if (spouse) {
            var spouseLabel = relativeLabel(spouse.gender ? spouse.gender.type : null, "Husband", "Wife", "Spouse");
            r.append(buildRelativeUI(relationship, spouse, spouseLabel, idMap, ".relationships[" + i + "]", editHooks));
          }
        }
        else if (relationship.type === "http://gedcomx.org/ParentChild") {
          if (isP1) {
            var childRef = isP1 ? ref2 : ref1;
            var child = findPersonByRef(doc, childRef);
            if (child) {
              var childLabel = relativeLabel(child.gender ? child.gender.type : null, "Son", "Daughter", "Child");
              r.append(buildRelativeUI(relationship, child, childLabel, idMap, ".relationships[" + i + "]", editHooks));
            }
          }
          else {
            var parentRef = isP1 ? ref2 : ref1;
            var parent = findPersonByRef(doc, parentRef);
            if (parent) {
              var parentLabel = relativeLabel(parent.gender ? parent.gender.type : null, "Father", "Mother", "Parent");
              r.append(buildRelativeUI(relationship, parent, parentLabel, idMap, ".relationships[" + i + "]", editHooks));
            }
          }
        }
        else if (relationship.type === "http://familysearch.org/types/relationships/AuntOrUncle") {
          if (isP1) {
            var nieceOrNephewRef = isP1 ? ref2 : ref1;
            var nieceOrNephew = findPersonByRef(doc, nieceOrNephewRef);
            if (nieceOrNephew) {
              var nieceOrNephewLabel = relativeLabel(nieceOrNephew.gender ? nieceOrNephew.gender.type : null, "Nephew", "Niece", "Niece Or Nephew");
              r.append(buildRelativeUI(relationship, nieceOrNephew, nieceOrNephewLabel, idMap, ".relationships[" + i + "]", editHooks));
            }
          }
          else {
            var auntOrUncleRef = isP1 ? ref2 : ref1;
            var auntOrUncle = findPersonByRef(doc, auntOrUncleRef);
            if (auntOrUncle) {
              var auntOrUncleLabel = relativeLabel(auntOrUncle.gender ? auntOrUncle.gender.type : null, "Uncle", "Aunt", "Aunt Or Uncle");
              r.append(buildRelativeUI(relationship, auntOrUncle, auntOrUncleLabel, idMap, ".relationships[" + i + "]", editHooks));
            }
          }
        }
        else {
          var relativeRef = isP1 ? ref2 : ref1;
          var relative = findPersonByRef(doc, relativeRef);
          if (relative) {
            r.append(buildRelativeUI(relationship, relative, parseType(relationship.type), idMap, ".relationships[" + i + "]", editHooks));
          }
        }
      }
    }
  }

  if (!hasRelatives) {
    r.append(span().text("(None)"));
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

function buildRelativeUI(relationship, relative, relativeLabel, idMap, path, editHooks) {
  var relativeId = relative.id;
  var relativeTitle = $("<h5/>", {class: "relative text-nowrap"});
  buildPersonIdBadge(relative, idMap).appendTo(relativeTitle);
  $("<a/>", { "class" : "link-unstyled", "href" : '#' + relativeId}).html(getBestNameValue(relative)).appendTo(relativeTitle);
  if (relativeLabel) {
    relativeTitle.append($("<small/>", {class: "relative-type text-muted"}).text(relativeLabel));
  }
  if (editHooks.editRelationship) {
    relativeTitle.append(editButton(function() {editHooks.editRelationship(relationship)}));
  }
  if (editHooks.removeRelationship) {
    relativeTitle.append(removeButton(function() {editHooks.removeRelationship(relationship.id)}));
  }
  var relativeUI = div().append(relativeTitle);
  if (relationship.facts) {
    relativeUI.append(buildRelativeFactsUI(relationship));
  }
  return relativeUI;
}

function buildRelativeFactsUI(rel) {
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

function buildRelationshipsUI(doc, idMap, path, editHooks) {
  var i;
  var relationships = div({id: "relationships"});
  path = path + ".relationships";
  for (i = 0; i < doc.relationships.length; i++) {
    relationships.append(buildRelationshipUI(doc, doc.relationships[i], idMap, path + '[' + i + "]", editHooks));
  }
  return relationships;
}

function buildRelationshipUI(doc, relationship, idMap, path, editHooks) {
  var relationshipCard = div({ class: "relationship card m-3", id: encode(relationship.id)} );
  var relationshipCardBody = div({class: "card-body p-0"}).appendTo(relationshipCard);
  var relationshipCardTitle =  $("<h5/>", {class: "card-title card-header"}).appendTo(relationshipCardBody);

  var person1 = relationship.person1 ? findPersonByRef(doc, relationship.person1.resource) : null;
  if (person1) {
    buildPersonIdBadge(person1, idMap).appendTo(relationshipCardTitle);
    span({class: "relationship-person1 text-nowrap", "json-node-path" : path + ".person1"}).html(getBestNameValue(person1) + " &larr;").appendTo(relationshipCardTitle);
  }
  else {
    span({"json-node-path" : path + ".person1"}).text("(Unknown)").appendTo(relationshipCardTitle);
  }

  relationshipCardTitle.append(span({class: "relationship-type badge badge-secondary", "json-node-path" : path + ".type"}).text(parseType(relationship.type)));

  var person2 = relationship.person2 ? findPersonByRef(doc, relationship.person2.resource) : null;
  if (person2) {
    span({class: "relationship-person2 text-nowrap mr-1", "json-node-path" : path + ".person2"}).html("&rarr; " + getBestNameValue(person2)).appendTo(relationshipCardTitle);
    buildPersonIdBadge(person2, idMap).appendTo(relationshipCardTitle);
  }
  else {
    span({"json-node-path" : path + ".person2"}).text("(Unknown)").appendTo(relationshipCardTitle);
  }

  if (editHooks.editRelationship) {
    editButton(function() {editHooks.editRelationship(relationship)}).appendTo(relationshipCardTitle);
  }

  if (editHooks.removeRelationship) {
    removeButton(function() { editHooks.removeRelationship(relationship.id) }).appendTo(relationshipCardTitle);
  }

  var identifier = getIdentifier(relationship);
  if (identifier) {
    div({class: "card-text m-2", "json-node-path" : path + ".identifiers"}).append(dl({"Identifier": identifier})).appendTo(relationshipCardBody);
  }

  var relationshipCardBodyContent = div({class:"row p-2"});
  div({class: "container"}).append(relationshipCardBodyContent).appendTo(relationshipCardBody);

  if (relationship.facts && relationship.facts.length > 0) {
    var facts = buildFactsUI(relationship, relationship.facts, path + ".facts", editHooks, true);
    var addFactHook = null;
    if (editHooks.addRelationshipFact) {
      addFactHook = function () { editHooks.addRelationshipFact(relationship.id); };
    }
    relationshipCardBodyContent.append(div({class: "col"}).append(card("Facts", facts, 5, addFactHook)));
  }
  else if (editHooks.addRelationshipFact) {
    relationshipCardBodyContent.append(div({class: "col"}).append(card("Facts", span().text("(None)"), 5, function () { editHooks.addRelationshipFact(relationship.id); })));
  }

  if (relationship.hasOwnProperty('fields')) {
    //hide fields for now
    //var fields = buildFieldsUI(relationship.fields, path + ".fields");
    //relationshipCardBodyContent.append(div({class: "col"}).append(card("Fields", fields, 5)));
  }

  return relationshipCard;
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
