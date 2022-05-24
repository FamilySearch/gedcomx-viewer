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

function generateLocalId(prefix) {
  return (prefix ? prefix : "") + Math.random().toString(36).substr(2, 9);
}

/**
 *  Fix the age at an event.
 *
 *  @param doc The record to update.
 */
function addLocalIds(doc) {
  if (doc.persons) {
    for (let person of doc.persons) {
      if (!person.id) {
        person.id = generateLocalId("p_");
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
    for (let person of doc.persons) {
      let age = null;
      if (person.fields) {
        for (let personField of person.fields) {
          if (personField.type === "http://gedcomx.org/Age") {
            let ageField = personField;
            if (ageField.values) {
              for (let fieldValue of ageField.values) {
                if (fieldValue.type === "http://gedcomx.org/Original") {
                  age = fieldValue.text;
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
        for (let fact of person.facts) {
          if ((isObituary && fact.type === "http://gedcomx.org/Death") || (!isObituary &&fact.primary)) {
            if (!fact.qualifiers) {
              fact.qualifiers = [];
            }

            let addAge = true;
            for (let qualifier of fact.qualifiers) {
              if (qualifier.name === "http://gedcomx.org/Age") {
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


