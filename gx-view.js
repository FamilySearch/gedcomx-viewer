//////////////
//UI Utilities
//////////////

function empty(s) {
  return s === undefined || s === null || s.length === 0;
}

function card(sectionName, sectionContent, level, addHook, editHook, copyHook) {
  level = level || 2;
  let title = $("<h" + level + "/>", {class: "card-title card-header"}).append(span().text(sectionName));
  if (addHook) {
    title = title.append(addButton(addHook));
  }
  if (editHook) {
    title = title.append(editButton(editHook));
  }
  if (copyHook) {
    title = title.append(copyButton(copyHook));
  }
  return div({class: "card m-1 p-0"})
    .append(div({class:"card-body p-0"})
    .append(title)
    .append(div({class: "card-text p-3"}).append(sectionContent)));
}

function dl(items, attrs) {
  let list = $("<dl/>", attrs).addClass("row");
  for (let key in items) {
    if (items.hasOwnProperty(key)) {
      list.append($("<dt/>", {class: "col-3 text-nowrap"}).text(key)).append($("<dd/>", {class: "col-9 text-nowrap"}).text(items[key]));
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

function getGenderString(person) {
  let gender = "Gender?";

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

function getGenderClass(genderString) {
  if (genderString) {
    if (genderString.charAt(0) === 'M') {
      return "gender-male";
    }
    else if (genderString.charAt(0) === 'F') {
      return "gender-female";
    }
  }
  return "gender-unknown"
}

function getBestNameValue(person) {
  if (!person.names || !person.names.length) {
    return null;
  }

  let name = person.names[0];
  if (!name.nameForms || !name.nameForms.length) {
    return null;
  }
  let nameForm = name.nameForms[0];
  return formName(nameForm.fullText);

  function formName(nameString) {
    if (!nameString && nameForm.parts && nameForm.parts.length > 0) {
      nameString = "";
      for (let i = 0; i < nameForm.parts.length; i++) {
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
  let record = div({ id: "record"});
  record.append($("<h1/>").append(span().text("Record ")));

  if (isSour(doc)) {
    record.append($("<h4/>", {class: "alert alert-warning", role:"alert"}).append(span({class: "oi oi-warning mr-2"})).append(span().text("Record is sour!")));
  }

  let recordMetadata = {};

  if (url) {
    recordMetadata.URL = url;
  }

  if (doc.description) {
    let sd = getSourceDescription(doc, doc.description);
    if (sd) {
      if (sd.titles) {
        recordMetadata.Title = sd.titles[0].value;
      }

      if (sd.coverage && sd.coverage.length > 0) {
        let coverage = sd.coverage[0];
        recordMetadata.Type = parseType(coverage.recordType);
        if (coverage.temporal) {
          recordMetadata.Date = coverage.temporal.original;
        }
        if (coverage.spatial) {
          recordMetadata.Place = coverage.spatial.original;
        }
      }

      if (sd.publisher) {
        let publisher = getAgent(doc, sd.publisher.resource);
        if (publisher && publisher.names && publisher.names.length > 0) {
          recordMetadata.Publisher = publisher.names[0].value;
        }
      }
    }
  }

  let hookToEditRecordMetadata = null;
  let hookToCopyRecordMetadata = null;
  if (editHooks.editRecordMetadata) {
    hookToEditRecordMetadata = function() {editHooks.editRecordMetadata(recordMetadata)};
    hookToCopyRecordMetadata = function() {editHooks.copyRecordMetadata(doc)};
  }

  record.append(card("Metadata", dl(recordMetadata), 5, null, hookToEditRecordMetadata, hookToCopyRecordMetadata));

  // Map of local person id (p_1234567) to index (1, 2, 3...)
  let idMap = {};
  let path = "";

  if (doc.persons) {
    // Create a short 1-based person index for viewing.
    for (let i = 0; i < doc.persons.length; i++) {
      idMap[doc.persons[i].id] = i + 1;
    }

    record.append(card("Persons", buildPersonsUI(doc, idMap, path, editHooks), 2, editHooks.addPerson));
  }
  if (doc.relationships) {
    record.append(card("Relationships", buildRelationshipsUI(doc, idMap, path, editHooks), 2, editHooks.addRelationship));
  }
  if (doc.fields) {
    //hide fields for now
    //record.append(card("Fields", buildFieldsUI(doc.fields, path + ".fields")));
  }
  return record;
}

function isSour(doc) {
  if (doc.fields) {
    for (let field of doc.fields) {
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
  let persons = div({id: "persons"});
  path = path + ".persons";
  for (let i = 0; i < doc.persons.length; i++) {
    persons.append(buildPersonUI(doc, doc.persons[i], idMap, path + '[' + i + "]", editHooks));
  }
  return persons;
}

function buildPersonUI(doc, person, idMap, path, editHooks) {
  let personCard = div({ class: "person card m-3", id: encode(person.id)} );
  let personCardBody = div({class: "card-body p-0"}).appendTo(personCard);
  let personCardTitle =  $("<h3/>", {class: "card-title card-header"}).appendTo(personCardBody);

  buildPersonIdBadge(person, idMap).appendTo(personCardTitle);

  span({"json-node-path" : path}).html(getBestNameValue(person)).appendTo(personCardTitle);

  buildGenderBadge(person, path, editHooks).appendTo(personCardTitle);

  buildPrincipalBadge(person, path, editHooks).appendTo(personCardTitle);

  if (editHooks.removePerson) {
    removeButton(function() { editHooks.removePerson(person.id) }).appendTo(personCardTitle);
  }

  let identifier = getIdentifier(person);
  if (identifier) {
    div({class: "card-text m-2", "json-node-path" : path + ".identifiers"}).append(dl({"Identifier": identifier})).appendTo(personCardBody);
  }

  let personCardBodyContent = div({class:"row"});
  div({class: "container"}).append(personCardBodyContent).appendTo(personCardBody);

  if (person.names && person.names.length > 0) {
    let names = buildNamesUI(person, path, editHooks);
    let addNameHook = null;
    if (editHooks.addName) {
      addNameHook = function () { editHooks.addName(person.id); };
    }
    personCardBodyContent.append(div({class: "col"}).append(card("Names", names, 5, addNameHook)));
  }
  else if (editHooks.addName) {
    personCardBodyContent.append(div({class: "col"}).append(card("Names", span().text("(None)"), 5, function () { editHooks.addName(person.id); })));
  }

  if (person.facts && person.facts.length > 0) {
    let facts = buildFactsUI(person, person.facts, path + ".facts", editHooks);
    let addFactHook = null;
    if (editHooks.addPersonFact) {
      addFactHook = function () { editHooks.addPersonFact(person.id); };
    }
    personCardBodyContent.append(div({class: "col"}).append(card("Facts", facts, 5, addFactHook)));
  }
  else if (editHooks.addPersonFact) {
    personCardBodyContent.append(div({class: "col"}).append(card("Facts", span().text("(None)"), 5, function () { editHooks.addPersonFact(person.id); })));
  }

  if (person.fields) {
    //hide fields for now
    //let fields = buildFieldsUI(person.fields, path + ".fields");
    //personCardBodyContent.append(div({class: "col"}).append(card("Fields", fields, 5)));
  }

  let relatives = buildRelativesUI(doc, person, idMap, editHooks);
  let addRelativeHook = null;
  if (editHooks.addRelationship) {
    addRelativeHook = function() { editHooks.addRelationship(person.id) }
  }
  personCardBodyContent.append(div({class: "col"}).append(card("Relatives", relatives, 5, addRelativeHook)));

  return personCard;
}

function buildGenderBadge(person, path, editHooks) {
  let genderString = getGenderString(person);
  let genderClass = getGenderClass(genderString);
  let genderBadge = span({ class: "gender badge badge-pill badge-secondary " + genderClass }).append(span({ "json-node-path": path + ".gender" }).text(genderString));
  if (editHooks.editGender) {
    span({class: "trigger oi oi-loop-circular ml-1"}).click(function() { editHooks.editGender(person.id); }).appendTo(genderBadge);
  }
  return genderBadge;
}

function buildPrincipalBadge(person, path, editHooks) {
  let principalUI;
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
  let localId = idMap[person.id];
  return span({class: "local-pid badge badge-pill badge-info"}).append(span({class: "oi oi-person", title: "person", "aria-hidden": "true"})).append($("<small/>").text(localId));
}

function buildNamesUI(person, path, editHooks) {
  let n = div({class: "names"});
  path = path + ".names";
  for (let i = 0; i < person.names.length; i++) {
    n.append(buildNameUI(person, person.names[i], path + "[" + i + "]", editHooks));
  }
  return n;
}

function buildNameUI(person, name, path, editHooks) {
  let n = div({ class: "name text-nowrap"});

  if (name.nameForms) {
    path = path + ".nameForms";
    for (let i = 0; i < name.nameForms.length; i++) {
      let nameForm = name.nameForms[i];
      let nameFormPath = path + '[' + i + ']';
      let fullText = $("<h5/>", {class: "name-form", "json-node-path" : nameFormPath + ".fullText"}).append(span().html(empty(nameForm.fullText) ? "(Empty)" : nameForm.fullText));

      if (nameForm.lang) {
        fullText.append(span({class: "lang badge badge-dark", "json-node-path" : nameFormPath + ".lang"}).text(nameForm.lang));
      }

      if (name.type) {
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
  let fs = $("<table/>", {class: "name-parts table table-sm"});
  $("<thead/>").append($("<tr/>").append($("<th>Part Type</th>")).append($("<th>Part Value</th>"))).appendTo(fs);
  let body = $("<tbody/>").appendTo(fs);
  for (let i = 0; i < parts.length; i++) {
    let partPath = path + '[' + i + ']';
    let part = parts[i];
    let f = $("<tr/>").appendTo(body);
    f.append($("<td/>", {class: "name-part-type text-nowrap", "json-node-path" : partPath + ".type"}).text(parseType(part.type)));
    f.append($("<td/>", {class: "name-part-value text-nowrap", "json-node-path" : partPath + ".value"}).text(part.value ? part.value : ""));
  }
  return fs;
}

function buildFactsUI(subject, facts, path, editHooks, isRelationship) {
  let factsUI = $("<table/>", {class: "facts table table-sm"});
  let valueNeeded = false;
  let ageNeeded = false;
  let causeNeeded = false;
  let removeFactFn = isRelationship ? editHooks.removeRelationshipFact : editHooks.removePersonFact;
  let editFactFn = isRelationship ? editHooks.editRelationshipFact : editHooks.editPersonFact;
  let copyFactFn = isRelationship ? null : editHooks.copyPersonFact;

  for (let fact of facts) {
    if (fact.value) {
      valueNeeded = true;
    }

    if (fact.qualifiers) {
      for (let qualifier of fact.qualifiers) {
        if (qualifier.name === "http://gedcomx.org/Age") {
          ageNeeded = true;
        }
        if (qualifier.name === "http://gedcomx.org/Cause") {
          causeNeeded = true;
        }
      }
    }
  }

  let row = $("<tr/>").append($("<th>Type</th>")).append($("<th>Date</th>")).append($("<th>Place</th>"));
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

  let body = $("<tbody/>").appendTo(factsUI);
  for (let i = 0; i < facts.length; i++) {
    let factPath = path + '[' + i + ']';
    let fact = facts[i];
    let f = $("<tr/>");

    if (fact.primary) {
      f.append($("<td/>", {class: "fact-type text-nowrap", "json-node-path" : factPath + ".type"}).append(span().text(parseType(fact.type) + " ")).append(span({class: "oi oi-star"})));
    }
    else {
      f.append($("<td/>", {class: "fact-type text-nowrap", "json-node-path" : factPath + ".type"}).text(parseType(fact.type)));
    }
    f.append($("<td/>", {class: "fact-date text-nowrap", "json-node-path" : factPath + ".date"}).text(fact.date ? fact.date.original : ""));
    f.append($("<td/>", {class: "fact-place", "json-node-path" : factPath + ".place"}).text(fact.place ? fact.place.original : ""));
    if (valueNeeded) {
      f.append($("<td/>", {class: "fact-value", "json-node-path": factPath + ".value"}).text(fact.value ? fact.value : ""));
    }
    if (ageNeeded) {
      if (fact.qualifiers) {
        for (let j = 0; j < fact.qualifiers.length; j++) {
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
        for (let j = 0; j < fact.qualifiers.length; j++) {
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
      let editCell = $("<td/>", {class: "text-nowrap"});

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
  let relativesDiv = div({class: "relatives"});
  let hasRelatives = false;

  if (doc.relationships) {
    for (let i = 0; i < doc.relationships.length; i++) {
      let relationship = doc.relationships[i];
      let ref1 = relationship.person1 && relationship.person1.resource ? relationship.person1.resource : "";
      let ref2 = relationship.person2 && relationship.person2.resource ? relationship.person2.resource : "";
      let isP1 = ref1.endsWith(person.id);
      let isP2 = ref2.endsWith(person.id);
      if (isP1 || isP2) {
        hasRelatives = true;
        let relative = findPersonByRef(doc, isP1 ? ref2 : ref1);
        if (relative) {
          let gender = relative.gender ? relative.gender.type : null;
          let relativeLabel = getRelativeLabelFromRelationship(relationship.type, gender, isP1);
          relativesDiv.append(buildRelativeUI(relationship, relative, relativeLabel, idMap, ".relationships[" + i + "]", editHooks));
        }
      }
    }
  }

  if (!hasRelatives) {
    relativesDiv.append(span().text("(None)"));
  }

  return relativesDiv;
}

function buildRelativeUI(relationship, relative, relativeLabel, idMap, path, editHooks) {
  let relativeId = relative.id;
  let relativeTitle = $("<h5/>", {class: "relative text-nowrap"});
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
  let relativeUI = div().append(relativeTitle);
  if (relationship.facts) {
    relativeUI.append(buildRelativeFactsUI(relationship));
  }
  return relativeUI;
}

function buildRelativeFactsUI(rel) {
  let facts = {};
  if (rel && rel.facts) {
    for (let fact of rel.facts) {
      facts[parseType(fact.type)] = (fact.date ? fact.date.original + " " : "") + (fact.place ? fact.place.original + " " : "") + (fact.value ? "(" + fact.value + ")" : "");
    }
  }
  return dl(facts, {class: "relationship-facts px-3"});
}

function buildRelationshipsUI(doc, idMap, path, editHooks) {
  let relationships = div({id: "relationships"});
  path = path + ".relationships";
  for (let i = 0; i < doc.relationships.length; i++) {
    relationships.append(buildRelationshipUI(doc, doc.relationships[i], idMap, path + '[' + i + "]", editHooks));
  }
  return relationships;
}

function buildRelationshipUI(doc, relationship, idMap, path, editHooks) {
  let relationshipCard = div({ class: "relationship card m-3", id: encode(relationship.id)} );
  let relationshipCardBody = div({class: "card-body p-0"}).appendTo(relationshipCard);
  let relationshipCardTitle =  $("<h5/>", {class: "card-title card-header"}).appendTo(relationshipCardBody);

  let person1 = relationship.person1 ? findPersonByRef(doc, relationship.person1.resource) : null;
  if (person1) {
    buildPersonIdBadge(person1, idMap).appendTo(relationshipCardTitle);
    span({class: "relationship-person1 text-nowrap", "json-node-path" : path + ".person1"}).html(getBestNameValue(person1) + " &larr;").appendTo(relationshipCardTitle);
  }
  else {
    span({"json-node-path" : path + ".person1"}).text("(Unknown)").appendTo(relationshipCardTitle);
  }

  relationshipCardTitle.append(span({class: "relationship-type badge badge-secondary", "json-node-path" : path + ".type"}).text(parseType(relationship.type)));

  let person2 = relationship.person2 ? findPersonByRef(doc, relationship.person2.resource) : null;
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

  let identifier = getIdentifier(relationship);
  if (identifier) {
    div({class: "card-text m-2", "json-node-path" : path + ".identifiers"}).append(dl({"Identifier": identifier})).appendTo(relationshipCardBody);
  }

  let relationshipCardBodyContent = div({class:"row p-2"});
  div({class: "container"}).append(relationshipCardBodyContent).appendTo(relationshipCardBody);

  if (relationship.facts && relationship.facts.length > 0) {
    let facts = buildFactsUI(relationship, relationship.facts, path + ".facts", editHooks, true);
    let addFactHook = null;
    if (editHooks.addRelationshipFact) {
      addFactHook = function () { editHooks.addRelationshipFact(relationship.id); };
    }
    relationshipCardBodyContent.append(div({class: "col"}).append(card("Facts", facts, 5, addFactHook)));
  }
  else if (editHooks.addRelationshipFact) {
    relationshipCardBodyContent.append(div({class: "col"}).append(card("Facts", span().text("(None)"), 5, function () { editHooks.addRelationshipFact(relationship.id); })));
  }

  if (relationship.fields) {
    //hide fields for now
    //let fields = buildFieldsUI(relationship.fields, path + ".fields");
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
      for (let person of doc.persons) {
        if (person.id === id) {
          return person;
        }
      }
    }
  }
  return null;
}

// Return HTML for a Swifty (SFT) summary, as stored in the sft document (default name: sftPrediction)
function getSftSummaryHtml(doc, sftDocName) {
  let summary = findDocumentText(doc, sftDocName ? sftDocName : "sftPrediction");
  if (summary) {
    let lines = summary.split("\n");
    let html = "<h3>SFT Summary</h3>\n";
    for (let origLine of lines) {
      let line = origLine;
      if (line.startsWith("relationship ")) {
        line = line.replace(/^(relationship) /, "<span class='sft-relationship'>$1</span> ");
        line = line.replace(/ (pe[0-9]+)/g, " <span class='sft-person'>$1</span>");
      }
      else if (line.startsWith("pe")) {
        line = line.replace(/^(pe[0-9]*) /, "<span class='sft-person'>$1</span> ")
      }
      line = line.replace(/ (_[^ ]*)/g, " <span class='sft-tag'>$1</span>");
      html += "<p class='hanging-indent'>" + line + "</p>";
    }
    return html;
  }
  return null;
}

function dragElement(elmnt) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  if (document.getElementById(elmnt.id + "-label")) {
    /* if present, the label is where you move the DIV from:*/
    document.getElementById(elmnt.id + "-label").onmousedown = dragMouseDown;
  } else {
    /* otherwise, move the DIV from anywhere inside the DIV:*/
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    /* stop moving when mouse button is released:*/
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

