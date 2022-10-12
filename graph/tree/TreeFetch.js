/*
  Set of data and utility functions to manage fetching persons from a family tree
    and adding them to a gedcomx object.
  Todo:
  - Sort children by birth dates.
  - Sort spouses by marriage date.
  - Toggle details on selected persons (instead of everyone).
  - Include landing page on LLS URL so it works with FS Session ID.
  - Default to session ID user ID if no PID specified.
 */

// Master GedcomX object with all the persons and relationships fetched so far.
let masterGx = null;

// (Assumes that person IDs coming from API are unique for each person. If not, then overwrite person ID with ID derived from URL.)
// Map of person id -> GedcomX Person object
let gxPersonMap = new Map();
// Set of relationship IDs, so we don't add the same one twice.
let gxRelIdSet = new Set();

// Map of person id -> array of relatives' person ids (whether fetched yet or not)
let parentIdsMap = new Map(); // Map of person Id to an array of their parents' ids
let spouseIdsMap = new Map(); // Map of person Id to an array of their spouses' ids
let childIdsMap = new Map(); // Map of person Id to an array of their children's ids

// Map of personId -> PersonAnalysis.
let personAnalysisMap;

function clearPersonCache() {
  masterGx = null;
  gxPersonMap.clear();
  gxRelIdSet.clear();
  parentIdsMap.clear();
  spouseIdsMap.clear();
  childIdsMap.clear();
}

let defaultChartOptions = new ChartOptions(
    {
      isEditable: false,
      isSelectable: true,
      shouldShowConfidence: false,
      shouldDisplayIds: false,
      shouldDisplayDetails: false,
      isDraggable: true
    });

function setUpHelp(treeHelpHtmlUrl) {
  if (!treeHelpHtmlUrl) {
    treeHelpHtmlUrl = "https://familysearch.github.io/gedcomx-viewer/graph/tree/tree-help.html";
  }
  let $helpArea = $("#help-area");
  if ($helpArea) {
    $helpArea.load(treeHelpHtmlUrl, function () {
      $("#tree-graph-help-content").hide().draggable();
    });
  }
}

function toggleTreeGraphHelp() {
  let $div = $("#tree-graph-help-content");
  if ($div.is(":visible")) {
    $div.hide();
  }
  else {
    $div.show();
  }
}

function askForLogin() {
  $("#rel-chart").html("Log in to <a href='https://www.familysearch.org' target='_blank'>FamilySearch</a> in another tab and then reload this page. (Or add 'sessionid=&lt;sessionId&gt;' to the URL)");
}

/**
 * Fetch a set of persons, and asynchronously call receivePersons on the ones received.
 * @param fetchSpecs - Array of FetchSpec objects (see below) describing persons to fetch (and perhaps further generations to fetch after that)
 */
function fetchPersonsAsync(fetchSpecs) {
  function fetchFromOneUrl(urlToFetch, theFetchSpecs) {
    $.ajax({
      beforeSend: function (request) {
        request.setRequestHeader("Accept", "application/x-gedcomx-v1+json");
        request.setRequestHeader("Authorization", "Bearer " + fetchSpecs[0].sessionId);
      },
      dataType: "json",
      url: urlToFetch,
      statusCode: {
        401: askForLogin
      },
      success: async function (gx) {
        //Pause for animation: await new Promise(r => setTimeout(r, 1000));
        receivePersons(gx, theFetchSpecs);
      },
    });
  }

  function isFamilyTreeUrl(personUrl) {
    return personUrl.includes("4:1:") || personUrl.includes("/platform/tree/persons/")
  }

  // == function fetchPersonsAsync ==
  if (isFamilyTreeUrl(fetchSpecs[0].personUrl)) {
    // This is Family Tree, so we can optimize multiple fetches into one call
    let personIds = [];
    for (const fetchSpec of fetchSpecs) {
      let personId = getPersonIdFromUrl(fetchSpec.personUrl);
      if (!gxPersonMap.has(personId)) {
        personIds.push(personId);
      }
    }
    while (personIds.length > 0) {
      const maxIdsToFetch = 100;
      let idsToFetch = personIds.length < maxIdsToFetch ? personIds : personIds.slice(0, maxIdsToFetch);
      let personsUrl = "https://api.familysearch.org/platform/tree/persons?flag=fsh&pids=" + idsToFetch.join(",");
      fetchFromOneUrl(personsUrl, fetchSpecs);
      if (personIds.length >= maxIdsToFetch) {
        personIds.splice(0, maxIdsToFetch);
      }
      else {
        personIds = [];
      }
    }
  }
  else {
    // Maybe LLS or something, so we need to fetch each person separately on a separate thread.
    // Each person will cause the chart to update when it comes in. (Might be cool, or might be annoying).
    // Send the entire list of fetchSpecs through to "receivePersons" so it can check to see if all requested
    //   persons have arrived yet. Only when all of the persons in the list have arrived will any further fetching begin.
    for (const fetchSpec of fetchSpecs) {
      fetchFromOneUrl(fetchSpec.personUrl, fetchSpecs);
    }
  }
}

function getPersonUrl(gxPerson) {
  return gxPerson.identifiers["http://gedcomx.org/Persistent"][0];
}

/**
 * Having received a GedcomX payload, add the new persons over to the main GedcomX object and on to the relationship chart.
 * If all of the persons in the given fetchSpecs have now arrived (either because we did a single multi-person Family Tree call,
 *   or because this is the last of the FetchSpecs to come through) then recurse to additional persons that need to be fetched.
 * @param gx - GedcomX received for the given fetchSpecs
 * @param fetchSpecs - Array of {personUrl, [downGenerations...]} to be fetched.
 */
function receivePersons(gx, fetchSpecs) {
  // Get or create the array at map.get(personId1), and add person2Id to that array, if it is not already there.
  function addIdToArray(map, id1, id2) {
    let arr = map.get(id1);
    if (!arr) {
      arr = [id2];
      map.set(id1, arr);
    }
    else if (!arr.includes(id2)) {
      arr.push(id2);
    }
  }

  // Copy any additional persons or relationships from the given GedcomX into the masterGx.
  function updateMasterGx(gx) {
    // Update masterGx
    if (masterGx == null) {
      masterGx = { persons: [], relationships: []};
    }
    // Add all of the persons and relationships in gx to masterGx
    for (const person of gx.persons) {
      let existingPerson = gxPersonMap.get(person.id);
      if (existingPerson) {
        if (getPersonUrl(existingPerson) === getPersonUrl(person)) {
          console.log("Warning: Re-fetched existing person with id " + person.id);
        }
        else {
          console.log("Error: Two persons with id " + person.id + " with different persistent URLs.");
        }
      }
      else {
        gxPersonMap.set(person.id, person);
        masterGx.persons.push(person);
      }
    }

    if (gx.relationships) {
      for (const relationship of gx.relationships) {
        if (!gxRelIdSet.has(relationship.id)) {
          gxRelIdSet.add(relationship.id);
          masterGx.relationships.push(relationship);
          let person1Id = getPersonIdFromReference(relationship.person1);
          let person2Id = getPersonIdFromReference(relationship.person2);
          if (relationship.type === GX_COUPLE) {
            addIdToArray(spouseIdsMap, person1Id, person2Id);
            addIdToArray(spouseIdsMap, person2Id, person1Id);
          }
          else if (relationship.type === GX_PARENT_CHILD) {
            addIdToArray(childIdsMap, person1Id, person2Id);
            addIdToArray(parentIdsMap, person2Id, person1Id);
          }
        }
      }
    }
    if (masterGx.persons.length > 0) {
      masterGx.persons[0].principal = true;
    }
  }

  function gatherRemainingFetchSpecs(fetchSpecs) {
    function addFetchSpecToMap(fetchSpecMap, fetchSpec) {
      let current = fetchSpecMap.get(fetchSpec.personId);
      if (current) {
        current.mergeWith(fetchSpec);
      }
      else {
        fetchSpecMap.set(fetchSpec.personId, fetchSpec);
      }
    }

    /**
     * For each personId, see if all spouses and descendants needed to fulfill 'downCount' exist in the gxPersonMap.
     * Upon hitting any that are not there, create a new FetchSpec object, and add (or merge) it into the fetchSpecMap.
     * @param fetchSpecMap - map of personId -> FetchSpec for that person ID, for persons not yet fetched.
     * @param personId - Person ID to check for. If there, recurse until 'downCount' runs out. If not, add to remainingFetchSpecs
     * @param downCount - Number of generations to go down from this one. .5 => add spouses, 1 => add spouses + children.
     * @param remainingDownCounts - Array of 'downCount' for each generation of ancestors above the current one in 'personIds'.
     */
    function addNeededFetchSpecsForSpouseAndChildren(fetchSpecMap, personId, downCount, remainingDownCounts) {
      if (!gxPersonMap.has(personId)) {
        // This person has not been fetched yet.
        let fs = new FetchSpec(personId, null, remainingDownCounts, null);
        addFetchSpecToMap(fetchSpecMap, fs);
      }
      if (downCount > 0.4) {
        // Check on spouses
        let spouseIds = spouseIdsMap.get(personId);
        if (spouseIds && spouseIds.length > 0) {
          for (const spouseId of spouseIds) {
            if (!gxPersonMap.has(spouseId)) {
              // Use [downCount] so that we get this spouse's spouses and as many generations of children as for the person.
              // Will be rare to have any, but these would be effectively "stepchildren" of the person.
              addFetchSpecToMap(fetchSpecMap, new FetchSpec(spouseId, null, [downCount], null));
            }
          }
        }
        if (downCount > .9) {
          // Need to fetch children for this person
          let childIds = childIdsMap.get(personId);
          if (childIds && childIds.length > 0) {
            for (const childId of childIds) {
              if (gxPersonMap.has(childId)) {
                // Already have this child, so recurse if needed to see if there are descendants that need to be fetched.
                addNeededFetchSpecsForSpouseAndChildren(fetchSpecMap, childId, downCount - 1, []);
              }
              else {
                // Do not have this child yet, so fetch it before recursing.
                addFetchSpecToMap(fetchSpecMap, new FetchSpec(childId, null, [downCount - 1], null));
              }
            }
          }
        }
      }
    }

    // Get a Set of all of the parent IDs for all of the given child ids.
    function getAllParentIds(childPersonIds) {
      let allParentIds = new Set();
      for (const personId of childPersonIds) {
        let parentIds = parentIdsMap.get(personId);
        if (parentIds) {
          parentIds.forEach((parentId) => allParentIds.add(parentId));
        }
      }
      return allParentIds;
    }

    function addAllNeededOneHops() {
      function addRelatives(personId, relativeIdsMap) {
        const relativeIds = relativeIdsMap.get(personId);
        if (relativeIds) {
          for (const relativeId of relativeIds) {
            if (!gxPersonMap.has(relativeId) && !fetchSpecMap.has(relativeId)) {
              addFetchSpecToMap(fetchSpecMap, new FetchSpec(relativeId, null, 0, null));
            }
          }
        }
      }

      for (const fetchSpec of fetchSpecs) {
        addRelatives(fetchSpec.personId, parentIdsMap);
        addRelatives(fetchSpec.personId, spouseIdsMap);
        addRelatives(fetchSpec.personId, childIdsMap);
      }
    }

    //=== gatherRemainingFetchSpecs ===
    // Map of personId -> FetchSpec for that person ID (for persons not fetched yet)
    let fetchSpecMap = new Map();
    for (const fetchSpec of fetchSpecs) {
      // We have fetchSpec = {personId, personUrl, [1, 2, 0], maxPersonsToFetch}
      // For each generation, we need an array of person IDs for that generation,
      // then we need to ensure that we have all the persons fetched for each generation of descendants.
      // If we get to where we have IDs for someone, but they are not fetched yet,
      //   then we need to create a new FetchSpec for them with their ID, and their trimmed-down downstream array.
      if (!gxPersonMap.has(fetchSpec.personId)) {
        console.log("Error: Just fetched person " + fetchSpec.personId + " but still not in gxPersonMap...");
      }
      let generationPersonIds = new Set([fetchSpec.personId]);
      
      for (let gen = 0; gen < fetchSpec.downCounts.length; gen++) {
        // Down count for all the persons in this generation
        let downCount = fetchSpec.downCounts[gen];
        for (let personId of generationPersonIds) {
          addNeededFetchSpecsForSpouseAndChildren(fetchSpecMap, personId, downCount, fetchSpec.downCounts.slice(gen));
        }
        generationPersonIds = getAllParentIds(generationPersonIds);
      }
    }

    if (FetchSpec.prototype.maxPrefetch > (masterGx.persons.length + fetchSpecMap.size)) {
      addAllNeededOneHops();
    }
    return Array.from(fetchSpecMap.values());
  }

  function normalizePersonAndRelationshipIds(gx, firstPersonId) {

    function normalizeId(personIdOrUrl) {
      return personIdOrUrl ? personIdOrUrl.replaceAll(/.*[:/#]/g, "") : null;
    }

    function normalizePersonReference(ref) {
      if (ref && ref.resource && ref.resource.length > 0 && ref.resource.substring(0, 1) === "#") {
        let origPersonId = ref.resource.substring(1);
        let normalizedPersonId = personIdMap.get(origPersonId);
        if (normalizedPersonId) {
          ref.resource = "#" + normalizedPersonId;
        }
        else {
          console.log("Warning: Could not find normalized person id...");
        }
      }
      ref.resourceId = normalizeId(ref.resource);
    }

    //=== normalizePersonAndRelationshipIds
    // Map of original local person ID to normalized one
    let personIdMap = new Map();
    if (gx.persons) {
      let firstPersonIdPos = null;
      let p = 0;
      for (let person of gx.persons) {
        let personUrl = getPersonUrl(person);
        let newPersonId = normalizeId(personUrl);
        personIdMap.set(person.id, newPersonId);
        person.id = newPersonId;
        if (newPersonId === firstPersonId) {
          firstPersonIdPos = p;
        }
        p++;
      }
      if (firstPersonIdPos > 0) {
        let temp = gx.persons[0];
        gx.persons[0] = gx.persons[firstPersonIdPos];
        gx.persons[firstPersonIdPos] = temp;
      }
    }

    if (gx.relationships) {
      for (let relationship of gx.relationships) {
        normalizePersonReference(relationship.person1);
        normalizePersonReference(relationship.person2);
        relationship.id = normalizeId(relationship.type).substring(0, 1) + "_" + relationship.person1.resourceId + "_" + relationship.person2.resourceId;
      }
    }
  }

  function everyoneHasArrived(fetchSpecs) {
    for (let fetchSpec of fetchSpecs) {
      // fetchSpec = {personId, personUrl, [1, 2, 0]}
      if (!gxPersonMap.has(fetchSpec.personId)) {
        return false;
      }
    }
    return true;
  }

  // ---- receivePersons -----------------------------------
  normalizePersonAndRelationshipIds(gx, fetchSpecs[0].personId);
  updateMasterGx(gx);

  if (everyoneHasArrived(fetchSpecs)) {
    // Start fetching anyone else in the FetchSpec who isn't already being fetched in the current array of fetchSpecs.
    let remainingFetchSpecs = gatherRemainingFetchSpecs(fetchSpecs);
    if (remainingFetchSpecs.length > 0) {
      fetchPersonsAsync(remainingFetchSpecs);
    }
  }
  if (gx.persons && gx.persons.length > 0) {
    updatePersonAnalysis(getFirstPersonId());
  }

  // Draw or update the relationship chart with what we have so far
  if (currentRelChart) {
    currentRelChart.selectedPersonBoxes = []; // clear selections
    updateRecord(masterGx, null, false, true);
  }
  else {
    let chartOptions = defaultChartOptions;
    currentRelChart = buildRelGraph(masterGx, chartOptions);
  }
  for (let fetchSpec of fetchSpecs) {
    if (fetchSpec.shouldSelect) {
      let personBoxIds = currentRelChart.personIdPersonBoxesMap[fetchSpec.personId];
      if (personBoxIds) {
        for (let personBoxId of personBoxIds) {
          let personBox = currentRelChart.personBoxMap[personBoxId];
          personBox.selectPerson();
        }
      }
    }
  }
}

let hiddenPersons = new Set();

function combineArrays(array1, array2) {
  if (array1 && array2) {
    return array1.concat(array2);
  }
  else if (array1) {
    return array1;
  }
  else if (array2) {
    return array2;
  }
  else {
    return [];
  }
}

function getFirstPersonId() {
  return masterGx.persons[0].id;
}

function refreshMasterGx() {
  let fetchSpecs = [];

  if (currentRelChart) {
    let firstPersonId = masterGx && masterGx.persons && masterGx.persons.length > 0 ? masterGx.persons[0].id : null;
    let firstPersonPosition = -1;
    for (let personBox of currentRelChart.personBoxes) {
      let personId = personBox.personNode.personId;
      let personUrl = getPersonUrl(personBox.personNode.person);
      let fetchSpec = new FetchSpec(personId, personUrl, [0], null);
      if (personId === firstPersonId) {
        firstPersonPosition = fetchSpecs.length;
      }
      fetchSpecs.push(fetchSpec);
    }
    if (firstPersonPosition > 0) {
      // Swap to make sure the starting person remains the starting position, to keep people from moving around unnecessarily.
      let temp = fetchSpecs[0];
      fetchSpecs[0] = fetchSpecs[firstPersonPosition];
      fetchSpecs[firstPersonPosition] = temp;
    }
  }
  else if (masterGx && masterGx.persons) {
    for (const gxPerson of masterGx.persons) {
      fetchSpecs.push(new FetchSpec(gxPerson.id, getPersonUrl(gxPerson), [0], null));
    }
  }
  if (fetchSpecs.length > 0) {
    clearPersonCache();
    fetchPersonsAsync(fetchSpecs);
  }
}

/**
 * Show additional relatives of the selected persons (or hide the persons or their relatives, if "shouldHide" is true).
 * - When hiding relatives, if any of them are the "from" relative (i.e., the one that would connect the start person to this person),
 *     then only hide those (and set a new start person) if there are no other relatives being hidden.
 *     This allows us to, for example, show the children of an ancestor, and then hide those children without the ancestor disappearing
 *     by severing the link back to the root person.
 * @param key - Kind of relatives to toggle: P=parents, S=spouses, C=children. M=hide "Me". R=Refresh
 * @param shouldHide - Flag for whether to hide the selected persons. False => show them.
 * @param selectedPersonIds - Array of personIds of PersonBox objects that are selected in the UI.
 */
function toggleRelatives(key, shouldHide, selectedPersonIds) {

  // If hiding relatives, see if we will be hiding the "from" person and others. If so, remove the "from" person from the list.
  function filterRelatives(personId, relIds) {
    if (relIds && relIds.length > 1 && personAnalysisMap) {
      let personAnalysis = personAnalysisMap.get(personId);
      if (personAnalysis && personAnalysis.fromPersonId && relIds.includes(personAnalysis.fromPersonId) && hiddenPersons) {
        let fromPersonId = personAnalysis.fromPersonId;
        let filteredIds = [];
        for (const relId of relIds) {
          if (relId !== fromPersonId && !hiddenPersons.has(relId)) {
            filteredIds.push(relId);
          }
        }
        if (filteredIds.length === 0) {
          // All of the relatives except the "from" person were already hidden, so allow the "from" person to be hidden.
          filteredIds.push(fromPersonId);
        }
        return filteredIds;
      }
    }
    return relIds;
  }
  
  let needRecordUpdate = false;
  let fetchSpecs = [];
  let fetchMap = new Map(); // map of personId -> FetchSpec for that person to be fetched.
  for (const personId of selectedPersonIds) {
    let relativeIds = [];
    let spouseIdsToNotSelect = [];
    switch (key) {
      case 'C': //children
        relativeIds = shouldHide ? filterRelatives(personId, childIdsMap.get(personId)) : combineArrays(childIdsMap.get(personId), spouseIdsMap.get(personId));
        if (!shouldHide) {
          spouseIdsToNotSelect = spouseIdsMap.get(personId);
        }
        break;
      case 'P': // parents
        relativeIds = parentIdsMap.get(personId);
        break;
      case 'S': // spouses
        relativeIds = shouldHide ? combineArrays(filterRelatives(personId, childIdsMap.get(personId)), filterRelatives(personId, spouseIdsMap.get(personId))) : spouseIdsMap.get(personId);
        break;
      case 'M': // "Me"
        if (personId !== getFirstPersonId()) {
          relativeIds = [personId];
          shouldHide = true; // Can't "unhide" a person that is not displayed.
        }
        break;
    }
    if (relativeIds) {
      if (shouldHide) {
        // Hide selected relatives
        for (const relativeId of relativeIds) {
          if (!hiddenPersons.has(relativeId) && gxPersonMap.has(relativeId) && relativeId !== getFirstPersonId()) {
            hiddenPersons.add(relativeId);
            needRecordUpdate = true;
          }
        }
      }
      else {
        for (const relativeId of relativeIds) {
          if (hiddenPersons.has(relativeId)) {
            hiddenPersons.delete(relativeId);
            needRecordUpdate = true;
          }
          if (!gxPersonMap.has(relativeId) && !fetchMap.has(relativeId)) {
            let shouldSelect = !spouseIdsToNotSelect || !spouseIdsToNotSelect.includes(relativeId);
            let fetchSpec = new FetchSpec(relativeId, null, [0], null, shouldSelect);
            fetchSpecs.push(fetchSpec);
            fetchMap.set(relativeId, fetchSpec);
          }
        }
      }
    }
  }
  if (fetchSpecs.length > 0) {
    needRecordUpdate = false; // don't bother redrawing the chart yet. We're about to fetch some more people and redraw anyway.
    fetchPersonsAsync(fetchSpecs);
  }
  if (needRecordUpdate) {
    updatePersonAnalysis(getFirstPersonId());
    updateRecord(masterGx);
  }
}

function getPersonIdFromUrl(personUrl) {
  return personUrl.match(/.*[:\/]([-A-Z0-9]+)/)[1];
}

//======= FetchSpec ========================================
// Merge another FetchSpec's downCounts array into this one, taking the maximum of corresponding elements, and keeping any additional elements the other doesn't have.
FetchSpec.prototype.mergeWith = function(otherFetchSpec) {
  if (this.personId !== otherFetchSpec.personId) {
    console.log("Warning: Merging FetchSpecs with different personIds");
  }
  if (this.personUrl !== otherFetchSpec.personUrl) {
    console.log("Warning: Merging FetchSpecs with different personUrls");
  }
  if (this.sessionId !== otherFetchSpec.sessionId) {
    console.log("Warning: Merging FetchSpecs with different sessionIds");
  }
  let mergedArray = [];
  for (let i = 0; i < this.downCounts.length || i < otherFetchSpec.downCounts.length; i++) {
    if (i < this.downCounts.length && i < otherFetchSpec.downCounts.length) {
      mergedArray.push(Math.max(this.downCounts[i], otherFetchSpec.downCounts[i]));
    }
    else if (i < this.downCounts.length) {
      mergedArray.push(this.downCounts[i]);
    }
    else {
      mergedArray.push(otherFetchSpec.downCounts[i]);
    }
  }
  this.downCounts = mergedArray;
}

FetchSpec.prototype.makeFetchSpec = function(personId, downCounts) {
  let personUrl = this.personUrl.match(/(.*[:\/])([-A-Z0-9]+)/)[1] + personId;
  return new FetchSpec(personId, personUrl, downCounts, this.sessionId);
}

FetchSpec.prototype.sessionId = null;
FetchSpec.prototype.exampleUrl = null;
FetchSpec.prototype.maxPrefetch = 0;

/**
 * Constructor for a FetchSpec object, which specifies who to fetch from a lineage-linked GedcomX API such as Family Tree or LLS.
 * @param personId - local person ID.
 * @param personUrl - URL of person to fetch
 * @param downCounts - Array of # of generations of descendants to fetch for each ancestor of this person (starting with this person), once they arrive.
 *   For each generation, .5 down is the person's spouse, and 1 down is spouse + children.
 * @param sessionId - Session ID to use for fetching (if null, will use the last session ID that was provided)
 * @param shouldSelect - Flag for whether to select the person after they are loaded (default = false)
 * @param maxPrefetch - Max number of persons to fetch recursively (after doing any downCounts).
 * @constructor
 */
function FetchSpec(personId, personUrl, downCounts, sessionId, shouldSelect, maxPrefetch) {
  this.personId = personId ? personId : getPersonIdFromUrl(personUrl);
  this.personUrl = personUrl ? personUrl : FetchSpec.prototype.exampleUrl.match(/(.*[:\/])([-A-Z0-9]+)/)[1] + personId;
  this.downCounts = downCounts ? downCounts : []; //ensure non-null array
  this.sessionId = sessionId ? sessionId : FetchSpec.prototype.sessionId;
  this.shouldSelect = shouldSelect;
  this.maxPrefetch = maxPrefetch ? maxPrefetch : FetchSpec.prototype.maxPrefetch;
  if (!FetchSpec.prototype.sessionId) {
    FetchSpec.prototype.sessionId = sessionId;
  }
  if (!FetchSpec.prototype.exampleUrl) {
    FetchSpec.prototype.exampleUrl = personUrl;
  }
  if (maxPrefetch && !FetchSpec.prototype.maxPrefetch) {
    FetchSpec.prototype.maxPrefetch = maxPrefetch;
  }
}

//===== Person Analysis =====================

// personAnalysisMap is declared in graph.js to avoid errors, but is created here.

// Map of personPath -> Array of personIds at that path
let pathPersonsMap = null;

function updatePersonAnalysis(startPersonId) {
  function analyzeRelatives(personId, relativeIdsMap, path, queue, isVisible) {
    if (relativeIdsMap) {
      let relativeIds = relativeIdsMap.get(personId);
      if (relativeIds) {
        for (const relativeId of relativeIds) {
          if (gxPersonMap.has(relativeId) && !personAnalysisMap.has(relativeId)) {
            personAnalysisMap.set(relativeId, new PersonAnalysis(relativeId, path, personId, isVisible && !hiddenPersons.has(relativeId)));
            let pathList = pathPersonsMap.get(path);
            if (pathList) {
              pathList.push(relativeId);
            }
            else {
              pathPersonsMap.set(path, [relativeId]);
            }
            queue.push(relativeId);
          }
        }
      }
    }
  }

  // -- updatePersonAnalysis(startPersonId)---
  personAnalysisMap = new Map();
  personAnalysisMap.set(startPersonId, new PersonAnalysis(startPersonId, "*", null, true));
  pathPersonsMap = new Map();
  pathPersonsMap.set(startPersonId, "*");
  let queue = [startPersonId];
  let qpos = 0;

  while (qpos < queue.length) {
    let personId = queue[qpos++];
    let personPath = pathPersonsMap.get(personId);
    let isVisible = !hiddenPersons.has(personId) && personAnalysisMap.get(personId).isVisible;
    analyzeRelatives(personId, parentIdsMap, personPath + ".p", queue, isVisible);
    analyzeRelatives(personId, spouseIdsMap, personPath + ".s", queue, isVisible);
    analyzeRelatives(personId, childIdsMap, personPath + ".c", queue, isVisible);
  }
}

function hasMore(personId, relativeIdsMap) {
  let relativeIds = relativeIdsMap.get(personId);
  if (relativeIds) {
    for (const relativeId of relativeIds) {
      if (!gxPersonMap.has(relativeId) || hiddenPersons.has(relativeId)) {
        return true;
      }
    }
  }
  return false;
}

function PersonAnalysis(personId, personPath, fromPersonId, isVisible) {
  this.personId = personId;
  this.fromPersonId = fromPersonId;
  this.personPath = personPath;
  this.hasMoreParents = hasMore(personId, parentIdsMap);
  this.hasMoreSpouses = hasMore(personId, spouseIdsMap);
  this.hasMoreChildren = hasMore(personId, childIdsMap);
  this.isVisible = isVisible;
}