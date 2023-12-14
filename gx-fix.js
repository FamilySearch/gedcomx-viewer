// Common fixup operations for a GEDCOM X document.

function fixGedcomx(gx) {
  if (gx.records && gx.records.length > 0) {
    gx = gx.records[0];
  }

  addLocalIds(gx);
  fixExplicitNameType(gx);
  return gx;
}

function parseYearFromDateString(dateString) {
  if (dateString) {
    let dateObject = parseDate(dateString);
    if (dateObject && dateObject.year) {
      return dateObject.year;
    }
  }
  return null;
}

function getRecordYear(gx) {
  function getPrimaryFactYear(factsContainer) {
    for (let entity of factsContainer) {
      for (let fact of getList(entity, "facts")) {
        if (fact.primary && fact.date) {
          let year = parseYearFromDateString(fact.date.original);
          if (year) {
            return year;
          }
        }
      }
    }
    return null;
  }

  // Check persons and relationships for primary fact year
  let year = getPrimaryFactYear(getList(gx, "persons"));
  if (!year) {
    year = getPrimaryFactYear(getList(gx, "relationships"));
  }
  // Check record coverage for date
  if (!year && gx.sourceDescriptions) {
    for (let sd of gx.sourceDescriptions) {
      if (sd.resourceType === "http://gedcomx.org/Record" && sd.coverage) {
        for (let coverage of sd.coverage) {
          if (coverage.temporal) {
            year = parseYearFromDateString(coverage.temporal.original)
            if (year) {
              return year;
            }
          }
        }
      }
    }
  }
  // Check documents for NBX with <DAT>publication date</DAT>
  if (!year && gx.documents) {
    for (let document of gx.documents) {
      if (document.text && document.text.includes("<NBX>")) {
        let match = document.text.match(/<DAT>([^<]*)<\/DAT>/);
        if (match) {
          year = parseYearFromDateString(match[1]);
          if (year) {
            return year;
          }
        }
      }
    }
  }
  return year;
}

// Ensure that anyone with an age has at least an estimated birth year.
// - First use an age from a qualifier on an event with a date.
// - Next use an age field and the date of the primary event, if any, or else the record date.
// Also, REMOVE an estimated birth year (i.e., with "about" on date
//   when another birth event with a non-'about' date is also there.
function updateEstimatedBirthYear(gx) {
  function countBirthFactsWithDates(person) {
    let numBirthFacts = 0;
    for (let fact of getList(person, "facts")) {
      if (fact.type && fact.type.endsWith("/Birth") && fact.date) {
        numBirthFacts++;
      }
    }
    return numBirthFacts;
  }

  function findEstimatedBirthFact(facts) {
    for (let f = 0; f < facts.length; f++) {
      let fact = facts[f];
      if (fact.type && fact.type.endsWith("/Birth") && fact.date && fact.date.original && fact.date.original.startsWith("about")) {
        return f;
      }
    }
    return -1;
  }

  function findBirthFactWithOnlyPlace(person) {
    if (person.facts) {
      for (let fact of person.facts) {
        if (fact.type === "http://gedcomx.org/Birth" && fact.place && !fact.date) {
          return fact;
        }
      }
    }
    return null;
  }

  function addEstimatedBirthFact(person, birthYear) {
    if (!person.facts) {
      person.facts = [];
    }
    let estBirthYear = "about " + birthYear;
    let placeOnlyBirthFact = findBirthFactWithOnlyPlace(person);
    if (placeOnlyBirthFact) {
      placeOnlyBirthFact.date = {"original": estBirthYear};
    }
    else {
      person.facts.push({
        "id": generateLocalId("f_"),
        "type": "http://gedcomx.org/Birth",
        "date": {
          "original": estBirthYear
        }
      });
    }
  }

  if (!gx) {
    return;
  }
  let recordDate = getRecordYear(gx);
  for (let person of getList(gx, "persons")) {
    let numBirthFactsWithDates = countBirthFactsWithDates(person);
    if (numBirthFactsWithDates === 0) {
      let birthYear = estimateBirthYearFromPersonAge(person, recordDate);
      if (birthYear) {
        addEstimatedBirthFact(person, birthYear);
      }
    }
    else if (numBirthFactsWithDates > 1) {
      let estimatedBirthFactIndex = findEstimatedBirthFact(person.facts);
      if (estimatedBirthFactIndex >= 0) {
        let fact = person.facts[estimatedBirthFactIndex];
        if (fact.place) {
          fact.date = null;
        }
        else {
          person.facts.splice(estimatedBirthFactIndex, 1);
        }
      }
    }
  }
}

function estimateBirthYearFromPersonAge(person, recordDate) {
  function parseAge(yr) {
    return yr && yr.match(/^\d+$/) ? yr : null;
  }

  function getAgeFromFields(person) {
    for (let field of getList(person, "fields")) {
      if (field.type && field.type.endsWith("/Age") && field.values) {
        for (let fieldValue of field.values) {
          let fieldAge = parseAge(fieldValue.text);
          if (fieldAge) {
            return fieldAge;
          }
        }
      }
    }
    return null;
  }

  function getQualifierAge(fact) {
    for (let q of getList(fact, "qualifiers")) {
      if (q.name.endsWith("/Age")) {
        let age = parseAge(q.value);
        if (age) {
          return age;
        }
      }
    }
    return null;
  }

  let age = getAgeFromFields(person);
  let estimatedBirthYear = null;
  for (let fact of getList(person, "facts")) {
    let qualifierAge = getQualifierAge(fact);
    if (qualifierAge) {
      age = qualifierAge;
      let date= fact.date ? parseDate(fact.date.original) : null;
      if (date && date.year) {
        estimatedBirthYear = date.year - age;
      }
    }
  }
  if (age && !estimatedBirthYear) {
    let date = parseDate(recordDate);
    if (date && date.year) {
      estimatedBirthYear = date.year - age;
    }
  }
  return estimatedBirthYear;
}

function generateLocalId(prefix) {
  return (prefix ? prefix : "") + Math.random().toString(36).substr(2, 9);
}

/**
 *  Add any missing ids for persons, facts, names, relationships and relationship facts.
 *  Also, if any person ID has a space in it, replace it with an underscore in both the persons and the relationships.
 *
 *  @param doc The record to update.
 */
function addLocalIds(doc) {
  function replaceSpaces(s) {
    return s.replaceAll(" ", "_");
  }

  function fixSpacesInPersonReference(personRef) {
    if (personRef && personRef.resourceId && personRef.resourceId.includes(" ")) {
      personRef.resourceId = personRef.resourceId.replaceAll(" ", "_");
    }
    if (personRef && personRef.resource && personRef.resource.includes(" ")) {
      personRef.resource = personRef.resource.replaceAll(" ", "_");
    }
  }

  if (doc.persons) {
    for (let person of doc.persons) {
      if (!person.id) {
        person.id = generateLocalId("p_");
      }
      if (person.id.includes(" ")) {
        person.id = replaceSpaces(person.id);
      }
      if (person.facts) {
        for (let fact of person.facts) {
          if (!fact.id) {
            fact.id = generateLocalId("f_");
          }
        }
      }

      if (person.names) {
        for (let name of person.names) {
          if (!name.id) {
            name.id = generateLocalId("n_");
          }
        }
      }
    }
  }

  if (doc.relationships) {
    for (let relationship of doc.relationships) {
      if (!relationship.id) {
        relationship.id = generateLocalId("r_");
      }

      if (relationship.facts) {
        for (let fact of relationship.facts) {
          if (!fact.id) {
            fact.id = generateLocalId("rf_");
          }
        }
      }

      fixSpacesInPersonReference(relationship.person1);
      fixSpacesInPersonReference(relationship.person2);
    }
  }
}

function fixTextOfSourceOfSource(doc, sourceDocumentText, sourceDocumentName, localId) {
  let mainSourceDescription = getSourceDescription(doc, doc.description);

  let sourceOfSource;
  if (mainSourceDescription && mainSourceDescription.sources && mainSourceDescription.sources.length > 0) {
    sourceOfSource = getSourceDescription(doc, mainSourceDescription.sources[0].description);
  }

  let sourceDocument;
  if (sourceOfSource && sourceOfSource.about) {
    let sourceDocumentId = sourceOfSource.about.substr(1); // Remove "#" from front
    if (doc.documents) {
      for (let candidate of doc.documents) {
        if (sourceDocumentId === candidate.id) {
          sourceDocument = candidate;
          break;
        }
      }
    }
  }

  if (!sourceDocument) {
    sourceDocument = {};
    sourceDocument.id = generateLocalId("doc_");
    doc.documents = doc.documents || [];
    doc.documents.push(sourceDocument);
  }

  sourceDocument.text = sourceDocumentText;
  if (sourceDocumentName) {
    sourceDocument.titles = [];
    sourceDocument.titles.push({value: sourceDocumentName})
  }

  if (!sourceOfSource) {
    sourceOfSource = {};
    sourceOfSource.id = localId || generateLocalId("sd_");
    sourceOfSource.about = "#" + sourceDocument.id;
    doc.sourceDescriptions = doc.sourceDescriptions || [];
    doc.sourceDescriptions.push(sourceOfSource);
  }

  if (!mainSourceDescription) {
    mainSourceDescription = {};
    mainSourceDescription.id = generateLocalId("sd_");
    doc.sourceDescriptions = doc.sourceDescriptions || [];
    doc.sourceDescriptions.push(mainSourceDescription);
    doc.description = "#" + mainSourceDescription.id;
  }

  mainSourceDescription.sources = [];
  mainSourceDescription.sources.push({description: "#" + sourceOfSource.id, descriptionId: sourceOfSource.id});
}

function fixExplicitNameType(gx) {
  if (gx.persons) {
    for (let person of gx.persons) {
      if (person.names) {
        for (let name of person.names) {
          if (name.type === "http://gedcomx.org/BirthName") {
            //assume birth name is implicit, not explicit
            name.type = null;
          }
        }
      }
    }
  }
}

function removeAllRelationships(gx) {
  gx.relationships = [];
  updateRecord(gx);
}

/**
 * Remove relationships that are already covered by existing couple and parent-child relationships.
 * For example, remove "brother" relationship if the two people already have the same parent;
 *   or "father-in-law" relationship if there's already a couple relationship to someone with that person as a parent.
 * Also, remove "Unknown" and "NonRelative" relationships.
 * @param gx
 */
function removeRedundantRelationships(gx) {
  // Get the personId from a personReference (i.e., from person1 or person2) in a relationship
  function getPersonId(personReference) {
    if (personReference.resourceId) {
      return personReference.resourceId;
    }
    else if (personReference.resource.startsWith("#")) {
      return personReference.resource.substring(1);
    }
  }

  // Add the value to the array pointed at by the key in the given map, unless the array already has it.
  // Add a new array if the map does not yet have this key.
  // ('map' has a personId as a key, and an array of personIds as a value.)
  function addIfNotThere(map, key, value) {
    let list = map[key];
    if (!list) {
      map[key] = [value];
    }
    else {
      //todo: see if it's already there first.
      list.push(value);
    }
  }

  // Find all the ParentChild relationships in the given array, and create a map of
  //   parent personId (p1) to an array of child personIds (p2's) that have that parent.
  function makeParentMap(relationships) {
    let parentMap = {};
    for (let rel of relationships) {
      if (rel.type === GX_PARENT_CHILD) {
        addIfNotThere(parentMap, getPersonId(rel.person1), getPersonId(rel.person2));
      }
    }
    return parentMap;
  }

  // Take a parent map (map of parent personId to array of child personIds that have that parent)
  //   and return a child map (map of child personId to array of parent personIds that have that child).
  function makeChildMap(parentMap) {
    let childMap = {};
    for (let parentId in parentMap) {
      if (parentMap.hasOwnProperty(parentId)) {
        let childIds = parentMap[parentId];
        for (let childId of childIds) {
          addIfNotThere(childMap, childId, parentId);
        }
      }
    }
    return childMap;
  }

  function makeSpouseMap(relationships) {
    let spouseMap = {};
    for (let rel of relationships) {
      if (rel.type === GX_COUPLE) {
        addIfNotThere(spouseMap, getPersonId(rel.person1), getPersonId(rel.person2));
        addIfNotThere(spouseMap, getPersonId(rel.person2), getPersonId(rel.person1));
      }
    }
    return spouseMap;
  }

  /**
   * Tell whether p1 has p2 as a relative at the end of 1, 2 or 3 maps.
   * For example, to see if p1 is a great-grandchild p2, map1, map2 and map3 would all be parentMaps.
   * Each map is a map of personId to an array of personIds of parents, children or spouses of p1.
   * map2 is ignored if null (in which case map3 is ignored, too).
   * p1 is ignored (skipped) at the other end of any map.
   * @param person1Id - PersonId to find relative for
   * @param person2Id - PersonId of the relative to find
   * (optional) map1...n (any number) - list of maps, each from a personId to a list of relative personIds.
   */
  function hasRelative(person1Id, person2Id /*, map1, map2, map3, ...*/) {
    // Recursively see if p1 has a relative p2 in maps[mapIndex].
    // Ignore any relationships ending in p1.
    function recursiveHasRelative(ignoreList, p1, p2, mapIndex) {
      if (mapIndex < maps.length) {
        let relIds = maps[mapIndex][p1];
        if (relIds) {
          let nextMapIndex = mapIndex + 1;
          if (nextMapIndex >= maps.length) {
            return relIds.includes(p2);
          }
          // There are relatives of the given type from p1. So look for p2 in the last map.
          for (let relId of relIds) {
            if (!ignoreList.includes(relId)) { // skip any relatives that we have already visited in our search.
              // There are still more maps, so add the current id to the list to ignore, and recurse on the next map.
              let ignoreList2 = ignoreList.slice();
              ignoreList2.push(relId);
              if (recursiveHasRelative(ignoreList2, relId, p2, nextMapIndex)) {
                return true;
              } // else keep trying the other IDs.
            }
          }
        }
      }
      // Did not find a matching value, so return.
      return false;
    }
    let maps = [].slice.call(arguments, 2); // get the array of maps passed in
    return recursiveHasRelative([person1Id], person1Id, person2Id, 0);
  }

  // === removeRedundantRelationships ===
  if (gx && gx.relationships) {
    // Get map of parent personId -> list of child personIds
    let parentChildMap = makeParentMap(gx.relationships);
    // Get map of child personId -> list of parent personIds
    let childParentMap = makeChildMap(parentChildMap);
    // Get map of personId -> list of spouse personIds
    let spouseMap = makeSpouseMap(gx.relationships);
    let removedAny = false;

    for (let r = 0; r < gx.relationships.length; r++) {
      let relationship = gx.relationships[r];
      let p1 = getPersonId(relationship.person1);
      let p2 = getPersonId(relationship.person2);
      let relType = relationship.type.replace(/.*\//, ""); // get base relationship name, like "Couple" or "FatherInLaw".
      let remove = false;
      switch (relType) {
        case "Sibling":
          remove = hasRelative(p1, p2, childParentMap, parentChildMap);
          break;
        case "Unknown":
        case "NonRelative":
          remove = true;
          break;
        case "ParentChildInLaw":
          remove = hasRelative(p1, p2, parentChildMap, spouseMap);
          break;
        case "Grandparent":
          remove = hasRelative(p1, p2, parentChildMap, parentChildMap);
          break;
        case "GreatGrandparent":
          remove = hasRelative(p1, p2, parentChildMap, parentChildMap, parentChildMap);
          break;
        case "AuntOrUncle":
          remove = hasRelative(p1, p2, childParentMap, parentChildMap, parentChildMap);
          break;
        case "Cousin":
          remove = hasRelative(p1, p2, childParentMap, childParentMap, parentChildMap, parentChildMap);
          break;
        case "SiblingInLaw":
          remove = hasRelative(p1, p2, spouseMap, childParentMap, parentChildMap) || hasRelative(p1, p2, childParentMap, parentChildMap, spouseMap);
          break;
        case "Couple":
        case "ParentChild":
          break; // do nothing: These are core relationship types.
      }
      if (remove) {
        removedAny = true;
        // Remove the current relationship from the GedcomX relationships array.
        gx.relationships.splice(r--, 1);
      }
    }
    if (removedAny) {
      updateRecord(gx);
    }
  }
}

// Merge all of the persons, relationships, etc., from gx2 into gx1
// (Assumes that local IDs in both GedcomX documents are unique. If not, this function needs to be a lot more complicated to avoid collisions
// and fix up all references...)
function mergeGedcomx(gx1, gx2) {
  function checkForIdCollisions(listName, list1, list2) {
    let ids1 = new Set();
    for (let element of list1) {
      if (element.id) {
        if (ids1.has(element.id)) {
          throw new Error("Odd. Two " + listName + " with same ID in gedcomx1");
        }
        ids1.add(element.id);
      }
    }
    for (let element of list2) {
      if (element.id && ids1.has(element.id)) {
        // If you hit this error, then take the time to write the code so that when merging two GedcomX objects,
        //  we make sure all of the ids of all kinds are unique, and that all of the references to them use the
        //  new IDs. (i.e., relationship.person1/2=>new person IDs; source[references] => new sourceDescription ids; place references=>new place description ids;
        //  and attributions => new agent Ids.
        throw new Error("Error: Same id '" + element.id + "' in " + listName + " list in Gedcomx1 and Gedcomx2. Fancier code needed...");
      }
    }
  }

  function mergeArrays(listName) {
    let list1 = gx1[listName];
    let list2 = gx2[listName];
    if (list2 && list2.length > 0) {
      if (!list1 || list1.length === 0) {
        gx1[listName] = gx2[listName];
      }
      else {
        checkForIdCollisions(listName, list1, list2);
        list1.push(...list2);
      }
    }
  }

  if (!gx2) {
    return; // nothing to do
  }
  for (let listName of ["persons", "relationships", "sourceDescriptions", "agents", "events", "places", "documents", "collections", "fields", "recordDescriptors"]) {
    mergeArrays(listName);
  }
}


