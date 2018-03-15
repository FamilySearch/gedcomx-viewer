function readGedcomX(url) {
  $.ajax({type: "GET",
    dataType: "text",
    accepts: {text: "application/x-gedcomx-v1+json"},
    url: url,
    success: function (stuff, textStatus, jqKHR) {
      $("#record-json").val(stuff);
      showRecord(url, $.parseJSON(stuff));
    },
    error: function (jqXHR, textStatus, errorThrown) {
      console.log("Didn't make it: " + url);
    }
  });
}

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

function buildRecordUI(url, doc) {
  var record = div({ id: "record"});
  var title = $("<h1/>").append(span().text("Record "));
  if (url) {
    $("<small/>", {class: "text-muted"}).text(url).appendTo(title);
  }
  record.append(title);

  var i;
  // Map of local person id (p_1234567) to index (1, 2, 3...)
  var idMap = {};

  if (doc.hasOwnProperty('persons')) {
    // Create a short 1-based person index for viewing.
    for (i = 0; i < doc.persons.length; i++) {
      idMap[doc.persons[i].id] = i + 1;
    }

    record.append(card("Persons", buildPersonsUI(doc, idMap)));
  }
  if (doc.hasOwnProperty('fields')) {
    record.append(card("Fields", buildFieldsUI(doc.fields)));
  }
  if (doc.hasOwnProperty('relationships')) {
    //todo: Show relationship graph.
  }
  return record;
}

function buildPersonsUI(doc, idMap) {
  var i;
  var persons = div({id: "persons"});
  for (i = 0; i < doc.persons.length; i++) {
    persons.append(buildPersonUI(doc, doc.persons[i], idMap));
  }
  return persons;
}

function buildPersonUI(doc, person, idMap) {
  var personCard = div({ class: "person card m-3", id: encode(person.id)} );
  var personCardBody = div({class: "card-body p-0"}).appendTo(personCard);
  var personCardTitle =  $("<h3/>", {class: "card-title card-header"}).appendTo(personCardBody);
  personBadge(idMap[person.id], GedxPersonaPOJO.getGenderString(person)).appendTo(personCardTitle);
  span().text(GedxPersonaPOJO.getBestNameValue(person)).appendTo(personCardTitle);
  if (person.principal) {
    span({ class: "principal badge badge-pill badge-primary"}).append(span({class: "oi oi-star"})).append(span().text("Principal")).appendTo(personCardTitle);
  }

  var identifier = getIdentifier(person);
  if (identifier) {
    div({class: "card-text m-2"}).append(dl({"Identifier": identifier})).appendTo(personCardBody);
  }

  var personCardBodyContent = div({class:"row"});
  div({class: "container"}).append(personCardBodyContent).appendTo(personCardBody);

  if (person.hasOwnProperty('names')) {
    var names = buildNamesUI(person);
    personCardBodyContent.append(div({class: "col"}).append(card("Names", names, 5)));
    //accordionSection(contentId, "Names", names).appendTo(personCardBodyContent);
  }

  if (person.hasOwnProperty('facts')) {
    var facts = buildFactsUI(person.facts);
    personCardBodyContent.append(div({class: "col"}).append(card("Facts", facts, 5)));
    //accordionSection(contentId, "Facts", facts).appendTo(personCardBodyContent);
  }

  if (person.hasOwnProperty('fields')) {
    var fields = buildFieldsUI(person.fields);
    personCardBodyContent.append(div({class: "col"}).append(card("Fields", fields, 5)));
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

function buildNamesUI(person) {
  var n = div({class: "names"});
  for (var i = 0; i < person.names.length; i++) {
    n.append(buildNameUI(person.names[i]));
  }
  return n;
}

function buildNameUI(name) {
  var n = div({ class: "name text-nowrap"});

  var j, nameForm, namePart;
  if (!empty(name.type) && name.type !== "http://gedcomx.org/BirthName") {
    n.append(span({class: "name-type badge badge-dark"}).text(name.type.replace("http://gedcomx.org/", "")));
  }

  if (name.hasOwnProperty('nameForms')) {
    for (var i = 0; i < name.nameForms.length; i++) {
      nameForm = name.nameForms[i];
      if (!empty(nameForm.lang)) {
        n.append(span({class: "lang badge badge-dark"}).text(nameForm.lang));
      }
      n.append(span({class: "name-form"}).text(empty(nameForm.fullText) ? "(Empty)" : nameForm.fullText));

      // todo: name parts, fields...
      // if (nameForm.parts) {
      //   for (j = 0; j < nameForm.parts.length; j++) {
      //     namePart = nameForm.parts[j];
      //
      //   }
      // }
    }
  }

  return n;
}

function buildFactsUI(facts) {
  var i, fact;
  var fs = $("<table/>", {class: "facts table table-sm"});
  $("<thead/>").append($("<tr/>").append($("<th>Type</th>")).append($("<th>Date</th>")).append($("<th>Place</th>")).append($("<th>Value</th>"))).appendTo(fs);
  var body = $("<tbody/>").appendTo(fs);
  for (i = 0; i < facts.length; i++) {
    fact = facts[i];
    var f = $("<tr/>").appendTo(body);
    f.append($("<td/>", {class: "fact-type text-nowrap"}).text(parseType(fact.type)));
    f.append($("<td/>", {class: "fact-date text-nowrap"}).text(fact.date ? fact.date.original : ""));
    f.append($("<td/>", {class: "fact-place text-nowrap"}).text(fact.place ? fact.place.original : ""));
    f.append($("<td/>", {class: "fact-value text-nowrap"}).text(fact.value ? fact.value : ""));
  }
  return fs;
}

function buildFieldsUI(fields) {
  var i, field;
  var fs = $("<table/>", {class: "fields table table-sm"});
  $("<thead/>").append($("<tr/>").append($("<th>Type</th>")).append($("<th>Value</th>"))).appendTo(fs);
  var body = $("<tbody/>").appendTo(fs);
  for (i = 0; i < fields.length; i++) {
    field = fields[i];
    var f = $("<tr/>").appendTo(body);
    f.append($("<td/>", {class: "field-type text-nowrap"}).text(parseType(field.type)));
    f.append($("<td/>", {class: "field-value text-nowrap"}).text(GedxPersonaPOJO.getBestValue(field)));
  }
  return fs;
}

// Get the HTML for the list of a person's relatives.
function buildRelativesUI(doc, person, idMap) {
  var r = div({class: "relatives"});
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
        r.append(relativeUI(parentLabel, idMap[parent.id], parent.name, parent.gender));
      }
    }
  }
  spouseAndChildren = GedxPersonaPOJO.getSpousesAndChildren(doc, person);
  for (i = 0; i < spouseAndChildren.length; i++) {
    spouseFamily = spouseAndChildren[i];
    var spouse = spouseFamily.spouse;
    if (!empty(spouse)) {
      spouseLabel = relativeLabel(spouse.gender, "Husband", "Wife", "Spouse");
      r.append(relativeUI(spouseLabel, idMap[spouse.id], spouse.name, spouse.gender));
      r.append(buildRelationshipFactsUI(person.id, spouse.id, "http://gedcomx.org/Couple", doc.relationships));
    }
    if (!empty(spouseFamily.children)) {
      for (j = 0; j < spouseFamily.children.length; j++) {
        child = spouseFamily.children[j];
        childLabel = relativeLabel(child.gender, "Son", "Daughter", "Child");
        r.append(relativeUI(childLabel, idMap[child.id], child.name, child.gender));
      }
    }
  }
  return r;
}

function buildRelationshipFactsUI(person1Id, person2Id, relationshipType, relationships) {
  var i, j, rel;
  var facts = {};
  for (i = 0; i < relationships.length; i++) {
    rel = relationships[i];
    if (relationshipType === rel.type && rel.hasOwnProperty("facts")) {
      if (("#" + person1Id === rel.person1.resource && "#" + person2Id === rel.person2.resource) || (relationshipType === "http://gedcomx.org/Couple" && "#" + person2Id === rel.person1.resource && "#" + person1Id === rel.person2.resource)) {
        for (j = 0; j < rel.facts.length; j++) {
          var fact = rel.facts[j];
          facts[parseType(fact.type)] = (fact.date ? fact.date.original + " " : "") + (fact.place ? fact.place.original + " " : "") + (fact.value ? "(" + fact.value + ")" : "");
        }
      }
    }
  }
  return dl(facts, {class: "relationship-facts px-3"});
}

function relativeUI(relativeType, relativeIndex, relativeName, relativeGender) {
  var r = $("<h5/>", {class: "relative text-nowrap"});
  personBadge(relativeIndex, relativeGender).appendTo(r);
  span().text(relativeName).appendTo(r);
  if (!empty(relativeType)) {
    r.append($("<small/>", {class: "relative-type text-muted"}).text(relativeType));
  }
  return r;
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

function showRecord(url, doc) {
  $("#record").append(buildRecordUI(url, doc));
}
