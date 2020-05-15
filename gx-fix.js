// Common fixup operations for a GEDCOM X document.

function fixGedcomx(gx) {
  if (gx.records && gx.records.length > 0) {
    gx = gx.records[0];
  }

  addLocalIds(gx);
  fixAge(gx);
  fixExplicitNameType(gx);
  return gx;
}

function generateLocalId() {
  return Math.random().toString(36).substr(2, 9);
}

/**
 *  Fix the age at an event.
 *
 *  @param doc The record to update.
 */
function addLocalIds(doc) {
  if (doc.persons) {
    for (let i = 0; i < doc.persons.length; i++) {
      let person = doc.persons[i];
      if (!person.id) {
        person.id = generateLocalId();
      }

      if (person.facts) {
        for (let j = 0; j < person.facts.length; j++) {
          let fact = person.facts[j];
          if (!fact.id) {
            fact.id = generateLocalId();
          }
        }
      }

      if (person.names) {
        for (let j = 0; j < person.names.length; j++) {
          let name = person.names[j];
          if (!name.id) {
            name.id = generateLocalId();
          }
        }
      }
    }
  }

  if (doc.relationships) {
    for (let i = 0; i < doc.relationships.length; i++) {
      let relationship = doc.relationships[i];
      if (!relationship.id) {
        relationship.id = generateLocalId();
      }

      if (relationship.facts) {
        for (let j = 0; j < relationship.facts.length; j++) {
          let fact = relationship.facts[j];
          if (!fact.id) {
            fact.id = generateLocalId();
          }
        }
      }
    }
  }
}

/**
 *  Fix the age at an event.
 *
 *  @param doc The record to update.
 */
function fixAge(doc) {
  let sd = getSourceDescription(doc, doc.description);
  let isObituary = sd && sd.coverage && sd.coverage.length > 0 && sd.coverage[0].recordType === "http://gedcomx.org/Obituary";

  if (doc.persons) {
    for (let i = 0; i < doc.persons.length; i++) {
      let person = doc.persons[i];
      let age = null;
      if (person.fields) {
        for (let j = 0; j < person.fields.length; j++) {
          if (person.fields[j].type === "http://gedcomx.org/Age") {
            let ageField = person.fields[j];
            if (ageField.values) {
              for (let k = 0; k < ageField.values.length; k++) {
                if (ageField.values[k].type === "http://gedcomx.org/Original") {
                  age = ageField.values[k].text;
                  break;
                }
              }
            }
            break;
          }
        }
      }

      if (age && person.facts) {
        let ageAdded = false;
        for (let j = 0; j < person.facts.length; j++) {
          if ((isObituary && person.facts[j].type === "http://gedcomx.org/Death") || (!isObituary && person.facts[j].primary)) {
            let fact = person.facts[j];
            if (!fact.qualifiers) {
              fact.qualifiers = [];
            }

            let addAge = true;
            for (let k = 0; k < fact.qualifiers.length; k++) {
              if (fact.qualifiers[k].name === "http://gedcomx.org/Age") {
                ageAdded = true;
                addAge = false;
                break;
              }
            }

            if (addAge) {
              fact.qualifiers.push({name: "http://gedcomx.org/Age", value: age});
              ageAdded = true;
              break;
            }
          }
        }

        if (!ageAdded && isObituary) {
          let fact = {
            type: "http://gedcomx.org/Death",
            qualifiers: [ { name: "http://gedcomx.org/Age", value: age } ]
          };
          person.facts.push(fact);
        }
      }
    }
  }
}

function fixTextOfSourceOfSource(doc, sourceDocumentText, sourceDocumentName) {
  let source = getSourceDescription(doc, doc.description);

  let sourceOfSource;
  if (source && source.sources && source.sources.length > 0) {
    sourceOfSource = getSourceDescription(doc, source.sources[0].description);
  }

  let sourceDocument;
  if (sourceOfSource && sourceOfSource.about) {
    let sourceDocumentId = sourceOfSource.about.substr(1);
    if (doc.documents) {
      for (let i = 0; i < doc.documents.length; i++) {
        let candidate = doc.documents[i];
        if (sourceDocumentId === candidate.id) {
          sourceDocument = candidate;
          break;
        }
      }
    }
  }

  if (!sourceDocument) {
    sourceDocument = {};
    sourceDocument.id = generateLocalId();
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
    sourceOfSource.id = generateLocalId();
    sourceOfSource.about = "#" + sourceDocument.id;
    doc.sourceDescriptions = doc.sourceDescriptions || [];
    doc.sourceDescriptions.push(sourceOfSource);
  }

  if (!source) {
    source = {};
    source.id = generateLocalId();
    doc.sourceDescriptions = doc.sourceDescriptions || [];
    doc.sourceDescriptions.push(source);
    doc.description = "#" + source.id;
  }

  source.sources = [];
  source.sources.push({description: "#" + sourceOfSource.id, descriptionId: sourceOfSource.id});
}

function fixExplicitNameType(gx) {
  if (gx.persons) {
    for (let i = 0; i < gx.persons.length; i++) {
      let person = gx.persons[i];
      if (person.names) {
        for (let j = 0; j < person.names.length; j++) {
          let name = person.names[j];
          if (name.type === "http://gedcomx.org/BirthName") {
            //assume birth name is implicit, not explicit
            name.type = null;
          }
        }
      }
    }
  }
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
    for (let r = 0; r < relationships.length; r++) {
      let rel = relationships[r];
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
        for (let c = 0; c < childIds.length; c++) {
          addIfNotThere(childMap, childIds[c], parentId);
        }
      }
    }
    return childMap;
  }

  function makeSpouseMap(relationships) {
    let spouseMap = {};
    for (let r = 0; r < relationships.length; r++) {
      let rel = relationships[r];
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
   * If p1 is ignored (skipped) at the other end of any map.
   * @param p1 - PersonId to find relative for
   * @param p2 - PersonId of the relative to find
   * @param map1...n (any number) - list of maps, each from a personId to a list of relative personIds.
   */
  function hasRelative(p1, p2 /*, map1, map2, map3, ...*/) {
    function recursiveHasRelative(ignoreList, p1, p2, maps, mapIndex) {
      if (mapIndex < maps.length) {
        let relIds = maps[mapIndex][p1];
        if (relIds) {
          let nextMapIndex = mapIndex + 1;
          if (nextMapIndex >= maps.length) {
            return relIds.includes(p2);
          }
          // There are relatives of the given type from p1. So look for p2 in the last map.
          for (let r = 0; r < relIds.length; r++) {
            let relId = relIds[r];
            if (!ignoreList.includes(relId)) { // skip any relatives that we have already visited in our search.
              // There are still more maps, so add the current id to the list to ignore, and recurse on the next map.
              let ignoreList2 = ignoreList.slice();
              ignoreList2.push(relId);
              if (recursiveHasRelative(ignoreList2, relId, p2, maps, nextMapIndex)) {
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
    return recursiveHasRelative([p1], p1, p2, maps, 0);
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
          remove = hasRelative(p1, p2, childParentMap, childParentMap);
          break;
        case "GreatGrandparent":
          remove = hasRelative(p1, p2, childParentMap, childParentMap, childParentMap);
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


