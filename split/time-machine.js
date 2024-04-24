// IDs to try out:
//   LZBY-X8J - Clarence Gray. 5 PIDs that all merge into the same one. (Wife Bertha Nickell (later Bishop): L2DF-DRG)
//   9HMF-2S1 - Alice Moore. Example from Kathryn
//   G2FN-RZY - Theoore Freise, which Robby and Karl were working on. Has lots of data and persons added after some merging.
//   KWNR-S97 - John Taylor. We need to support attached sources w/o indexed personas.
//   G92P-752 - Broken for Robby

/* Still to do:
 - Select rows
   - Drag to move to new or existing group
   - Double-click value to select everyone with that value
 - Collapse merge node (and summarize all info in that one row).
 - Ordinances
 - Memories
 - Move "lollipops" (conclusions made after creation or merge) separately from identities.
*/

// Array of all entries from all change logs, sorted from newest to oldest timestamp, and then by column.
let allEntries = [];
let mainPersonId = null;

// Note that these are fetched after the ChangeLogHtml is built, so if a user hovers over a cell,
//   it will only include the extra info (like source title or relative name) if that has been fetched.
// Map of source URL -> {title: <title>, ark: <ark>, [and perhaps, gedcomx: <recordGx>]} (initially source URL -> null until fetched).
let sourceMap = {};

// Map of relative personId -> RelativeInfo
let relativeMap = new Map();
// Flag for whether we have finished receiving relative sources.
let relativeSourcesReceived = false;

// Map of duplicatePersonId -> array of [{ "survivor": <survivorPersonId>, "timestamp": <timestamp of merge>}]
let mergeMap = new Map();

const CHILD_REL = "child-and-parents-relationships"
const COUPLE_REL = "http://gedcomx.org/Couple"
const PARENT_CHILD_REL = "http://gedcomx.org/ParentChild"
const USYS_ID_TYPE = "http://api.familysearch.org/temple/USYS_ID";

// Fetch the change log entries for the person given by the change log URL.
function buildChangeLogView(changeLogUrl, sessionId, $mainTable, $status, shouldFetchOrdinances) {
  let context = parsePersonUrl(changeLogUrl);
  mainPersonId = context.personId;
  if (sessionId) {
    context["sessionId"] = sessionId;
  }

  // Map of personId -> array of change log entries for that person, most recent first.
  let changeLogMap = {};
  // List of urls currently being fetched.
  let fetching = [];

  updateStatus($status, "Fetching change logs...");
  // Recursively fetch this person's change log and that of anyone merged in.
  // Once last change log has been fetched, the last ajax call will call makeChangeLogHtml()
  fetchChangeLog(context.personId, context, changeLogMap, fetching, $mainTable, $status, null, shouldFetchOrdinances);
}

/**
 * Recursively fetch a person's change log entries, including following 'next' links, and fetching the
 *   change logs of any persons who merged into this one.
 * @param personId - Person ID to fetch change log for
 * @param context - Object with personId, baseUrl and optionally sessionId
 * @param changeLogMap - Map of personId to list of change log entries for that person id.
 * @param fetching - list of person IDs currently being fetched.
 * @param $mainTable - JQuery element to put the resulting HTML into when ready
 * @param $status - JQuery element to update with status messages
 * @param nextUrl - "next" Url for a person's change log, if this is a next link call (none => fetch person's change log from scratch)
 * @param shouldFetchOrdinances - flag for whether to fetch ordinances (currently only works within FamilySearch VPN).
 */
function fetchChangeLog(personId, context, changeLogMap, fetching, $mainTable, $status, nextUrl, shouldFetchOrdinances) {
  if (!nextUrl && (changeLogMap.hasOwnProperty(personId) || fetching.includes(personId))) {
    return; // Already took care of this one
  }
  fetching.push(personId);
  updateStatus($status, "Fetching " + (nextUrl ? "next " : "") + "change log for " + personId);
  let url = nextUrl ? nextUrl : context.baseUrl + personId + "/changes";
  $.ajax({
    beforeSend: function(request) {
      request.setRequestHeader("Accept", "application/json");
      // request.setRequestHeader("User-Agent", "ACE Record Fixer");
      // request.setRequestHeader("Fs-User-Agent-Chain", "ACE Record Fixer");
      if (context.sessionId) {
        request.setRequestHeader("Authorization", "Bearer " + context.sessionId);
      }
    },
    dataType: "json",
    url: url,
    success:function(gedcomx){
      receiveChangeLog(gedcomx, personId, context, changeLogMap, fetching, $mainTable, $status, nextUrl);
    }
  });

  if (shouldFetchOrdinances) {
    fetchOrdinances($status, personId, fetching, context, changeLogMap, $mainTable);
  }
}

/**
 * Receive a change log GedcomX from an Ajax request.
 * @param gedcomx - GedcomX of the change log
 * @param personId - Person ID whose change log is being fetched
 * @param context - Object with personId, baseUrl and optionally sessionId
 * @param changeLogMap - Map of person ID -> list of change log entries for that person id.
 * @param fetching - List of person IDs currently being fetched
 * @param $mainTable - JQuery element to put the resulting HTML into when ready
 * @param $status - JQuery element to update with status messages
 * @param receivedNextUrl - flag for whether this is a 'next' URL.
 */
function receiveChangeLog(gedcomx, personId, context, changeLogMap, fetching, $mainTable, $status, receivedNextUrl) {
  modifyStatusMessage($status, fetching, personId,
    "Fetching" + (receivedNextUrl ? " next" : "") + " change log for " + personId,
    "Received" + (receivedNextUrl ? " next" : "") + " change log for " + personId);
  let changeLogEntries = makeChangeLogEntries(gedcomx);
  if (personId in changeLogMap) {
    changeLogEntries = changeLogMap[personId].concat(changeLogEntries);
  }
  changeLogMap[personId] = changeLogEntries;
  let nextUrl = "next" in gedcomx.links ? gedcomx.links.next.href : null;
  if (nextUrl) {
    fetchChangeLog(personId, context, changeLogMap, fetching, $mainTable, $status, nextUrl);
  }
  let mergedIds = getNewMergeIds(personId, changeLogEntries);
  for (let newMergeId of mergedIds) {
    fetchChangeLog(newMergeId, context, changeLogMap, fetching, $mainTable, $status);
  }
  handleIfFinishedFetching(fetching, context, changeLogMap, $mainTable, $status);
}

function handleIfFinishedFetching(fetching, context, changeLogMap, $mainTable, $status) {
  if (fetching.length === 0) {
    // All the change logs that needed to be fetched have now been fetched, and this is the last one.
    // So create the Html.
    makeMainHtml(context, changeLogMap, $mainTable);
    // Then, kick off the fetching of relatives and sources info, and update the table when done.
    fetchRelativesAndSources(changeLogMap, $status, context);
  }
}

// Map of owsId -> OrdinanceWorkSet
let owsMap = new Map();
// Map of personId -> OrdinanceWorkSet[] that were originally attached to that personId.
let personOrdinanceMap = new Map();

class Ordinance { // "ctr" = Certified Temple Record
  constructor(ctrId, ordinanceType, ordinanceStatus, officialType, performedDate, templeCode) {
    this.ctrId = ctrId;
    this.ordinanceType = ordinanceType; // BAPTISM_LDS, INITIATORY, ENDOWMENT, SEALING_TO_PARENTS, SEALING_TO_SPOUSE
    this.ordinanceStatus = ordinanceStatus; // COMPLETED, ...
    this.officialType = officialType; // OFFICIAL_PRIMARY or OFFICIAL_SECONDARY
    this.performedDate = performedDate;
    this.templeCode = templeCode; // PORTL
    this.ordinanceSortKey = this.makeOrdSortKey(ordinanceType, performedDate, templeCode);
  }
  getOrdCode() {
    if (this.ordinanceType) {
      switch(this.ordinanceType) {
        case "BAPTISM_LDS": return "B";
        case "CONFIRMATION_LDS": return "C";
        case "INITIATORY": return "I";
        case "ENDOWMENT": return "E";
        case "SEALING_TO_PARENTS": return "SP";
        case "SEALING_TO_SPOUSE": return "SS";
      }
      return "?";
    }
  }
  getOrdString() {
    return this.getOrdCode() + ":" + (this.performedDate ? " " + this.performedDate : "") + (this.templeCode ? " " + this.templeCode : "");
  }
  makeOrdSortKey(ordinanceType, performedDate, templeCode) {
    let typesArray = ['B', 'C', 'I', 'E', 'SP', 'SS'];
    let ordinanceOrder = typesArray.indexOf(this.getOrdCode(ordinanceType));
    if (ordinanceOrder < 0) {
      ordinanceOrder = typesArray.length;
    }
    let dateNumber = parseDateIntoNumber(performedDate).toString().padStart(8, '0');
    return ordinanceOrder + "_" + dateNumber + "_" + (templeCode ? templeCode : "?");
  }
}

class OrdinanceWorkSet { // "ows"
  constructor(owsId, principalPersonId, currentPersonId, originalPersonId, role, date) {
    this.principalPersonId = principalPersonId; // Family Tree person ID at the time the ordinances were submitted.
    this.currentPersonId = currentPersonId; // latest, forwarded person id (according to TF) the ordinance is on.
    this.originalPersonId = originalPersonId; // (latest, forwarded?) person id (according to TF) the ordinance was originally attached to(?)
    this.roleInOws = role; // Role of this person in the OWS (e.g., ORD_FATHER if father of person getting baptized)
    this.owsId = owsId;
    this.modifiedDate = date;  // "modified" date from TF person. Should be reservation/submission date.
    this.createDate = null; // createDate from ows. Probably the same as above. Like "26 Feb 2007 21:33:43 GMT".
    this.ordinances = [];
    this.gedcomx = null; // GedcomX with the person and perhaps parents and spouse.
  }
  sortOrdinances() {
    this.ordinances.sort((a, b) => a.ordinanceSortKey.localeCompare(b.ordinanceSortKey));
  }
  getOrdinancesHtml() {
    let ordinanceList = [];
    for (let ord of this.ordinances) {
      ordinanceList.push(encode(ord.getOrdString()));
    }
    return ordinanceList.join("<br>");
  }
}

function fetchOrdinances($status, personId, fetching, context, changeLogMap, $mainTable) {
  updateStatus($status, "Fetching ordinances from TF for " + personId);
  fetching.push(personId + "-tf");
  let url = "http://tf.tree.service.prod.us-east-1.prod.fslocal.org/person/" + personId + "?sessionId=" + context.sessionId;
  $.ajax({
    beforeSend: function (request) {
      // request.setRequestHeader("User-Agent", "fs-wilsonr");
      request.setRequestHeader("User-Agent-Chain", "fs-wilsonr");
      request.setRequestHeader("Accept", "application/json");
      if (context.sessionId) {
        request.setRequestHeader("Authorization", "Bearer " + context.sessionId);
      }
    },
    dataType: "json",
    url: url,
    success: function (tf) {
      console.log("Success in fetching tf person " + personId);
      receiveTfPerson(tf, personId, context, changeLogMap, fetching, $mainTable, $status);
    },
    error: function (data) {
      console.log("Failed to fetch tf person " + personId);
      receiveTfPerson(null, personId, context, changeLogMap, fetching, $mainTable, $status);
    }
  });
  return url;
}

/*
  Receive a Tree Foundation person, and harvest it for ordinance information.
  tf.ordinanceReferences[]
      .originallyAttachedTo
      .value
        .role (ORD_PRINCIPAL/ORD_FATHER/ORD_MOTHER)
        .type (ORDINANCE)
        .uri (owsId, like "ows.MC7B-XRV")
   Then fetch the OWS for each ordinance reference.
 */
function receiveTfPerson(tf, personId, context, changeLogMap, fetching, $mainTable, $status) {
  function findNewOrdinanceWorkSets() {
    let newOrdinanceWorkSets = [];
    for (let ordinanceReference of getList(tf, "ordinanceReferences")) {
      let role = ordinanceReference.value.role;
      if (role === "ORD_PRINCIPAL") {
        let type = ordinanceReference.value.type;
        let currentPersonId = ordinanceReference.currentPersonId;
        let originalPersonId = ordinanceReference.originallyAttachedTo;
        let modifiedDate = ordinanceReference.attribution.modified;
        if (type !== "ORDINANCE") {
          console.log("New ordinance type: " + type);
        }
        let owsId = ordinanceReference.value.uri;
        let currentOws = owsMap.get(owsId);
        if (currentOws) {
          if (currentOws.role !== role) {
            console.log("Got two different roles for ows " + owsId);
          }
          if (originalPersonId !== currentOws.originalPersonId) {
            console.log("Got two different 'attached to' person Ids for ows " + owsId);
          }
        } else {
          let ows = new OrdinanceWorkSet(owsId, null, currentPersonId, originalPersonId, role, modifiedDate);
          owsMap.set(owsId, ows);
          computeIfAbsent(personOrdinanceMap, personId, key => []).push(ows);
          newOrdinanceWorkSets.push(ows);
        }
      }
    }
    return newOrdinanceWorkSets;
  }

  //---receiveTfPerson()---
  if (tf) {
    modifyStatusMessage($status, fetching, personId + "-tf",
      "Fetching ordinances from TF for " + personId, "Received ordinances from TF for " + personId);

    let newOrdinanceWorkSets = findNewOrdinanceWorkSets();
    for (let ows of newOrdinanceWorkSets) {
      fetchOws(ows.owsId, context, fetching, changeLogMap, $mainTable, $status);
    }
  }
  handleIfFinishedFetching(fetching, context, changeLogMap, $mainTable, $status);
}

function modifyStatusMessage($status, fetching, fetchingEntryToRemove, originalMessage, newMessage) {
  let logHtml = $status.html();
  logHtml = logHtml.replace(originalMessage, newMessage);
  $status.html(logHtml);
  fetching.splice(fetching.indexOf(fetchingEntryToRemove), 1); // Remove personId from the fetching array
}

// Note: Only works with engineer admin role.
function fetchOws(owsId, context, fetching, changeLogMap, $mainTable, $status) {
  fetching.push(owsId);
  updateStatus($status, "Fetching OWS " + owsId);
  let url = "http://tem-temple.temple.service.prod.us-east-1.prod.fslocal.org/ordinance-work-sets/" + owsId;
  $.ajax({
    beforeSend: function(request) {
      request.setRequestHeader("Accept", "application/json");
      if (context.sessionId) {
        request.setRequestHeader("Authorization", "Bearer " + context.sessionId);
      }
    },
    dataType: "json",
    url: url,
    success:function(owsJson){
      receiveOws(owsJson, owsId, context, fetching, changeLogMap, $mainTable, $status);
    },
    error: function() {
      receiveOws(null, owsId, context, fetching, changeLogMap, $mainTable, $status);
    }
  });
}

// Receive OWS object from tem-temple API (Only works as engineer admin).
// .ctrs[]
//   .id (like ctr.7PP4-G7N)
//   .ctrExtendedDetail[].officialType (OFFICIAL_PRIMARY, or OFFICIAL_SECONDARY => not from official temple record, but evidence shows it was done)
//   .ordinanceStatus (like http://api.familysearch.org/temple/COMPLETED")
//   .ordinanceType (like http://api.familysearch.org/temple/BAPTISM_LDS, INITIATORY, ENDOWMENT, SEALING_TO_PARENTS, SEALING_TO_SPOUSE
//   .performedDate.original (like 06 Dec 1991) (or .formal, like +1991-12-06)
//   .templeRef.templeCode (like PORTL)
// .persons[] - needs ids updated (and updated in corresponding relationships)
// .relationships[] - needs types mapped to standard ParentChild and Couple types
function receiveOws(owsJson, owsId, context, fetching, changeLogMap, $mainTable, $status) {

  /**
   * Fix local and persistent person IDs, and fix relationships.
   * - Persons have a local ".id" that is a temple person id.
   * - To convert this to a Family Tree person id, we'll look for an Identifier of type .../temple/USYS_ID
   * - We'll add a Person Ark as a Persistent Identifier on the person, and change their local .id to that FT person ID.
   * - Then we'll update references in relationships to refer to those new local IDs.
   * - Finally, we'll change the relationship types on relationships from FATHER, MOTHER, SPOUSE, CHILD to
   *    standard GedcomX ParentChild and Couple relationships.
   * @param gedcomx
   * @param latestForwardedFTPersonId - Latest, forwarded Family Tree person ID for the person we're working with.
   * @param mainPersonId - Local id for a temple person. (See the person's identifier of type .../temple/USYS_ID to get
   *                        the Family Tree person ID of the person at the time this ordinance was reserved.
   * @param fatherId - Local (temple) id for the father.
   * @param motherId - Local (temple) id for the mother.
   * @param spouseId - Local (temple) id for the spouse.
   * @return family tree person ID of the principal person.
   */
  function fixPersonIdsAndRelationshipTypes(gedcomx, latestForwardedFTPersonId, mainPersonId, fatherId, motherId, spouseId) {
    function fixRelativeId(relativeReference) {
      let relativeId = relativeReference.resourceId;
      let relativeFtPersonId = idMap.get(relativeId);
      if (relativeFtPersonId) {
        relativeReference.resource = "#" + relativeFtPersonId;
        relativeReference.resourceId = relativeFtPersonId;
      }
    }

    function addRelationshipIfNotThere(person1Id, person2Id, relationshipType, isBidirectional) {
      if (person1Id && person2Id) {
        for (let relationship of getList(gedcomx, "relationships")) {
          if (relationship.type === relationshipType &&
            ((person1Id === relationship.person1.resourceId && person2Id === relationship.person2.resourceId) ||
              (isBidirectional && person2Id === relationship.person1.resourceId && person1Id === relationship.person2.resourceId))) {
            return; // Relationship already exists.
          }
        }
        // Relationship does not yet exist, so add it.
        if (!gedcomx.relationships) {
          gedcomx.relationships = [];
        }
        let relationship = {
          "type" : relationshipType,
          "person1" : {"resourceId" : person1Id, "resource" : "#" + person1Id},
          "person2" : {"resourceId" : person2Id, "resource" : "#" + person2Id}
        };
        gedcomx.relationships.push(relationship);
      }
    }

    // -- fixPersonIdsAndRelationshipTypes() --
    // Map of original local person ID -> Family Tree person Id.
    let idMap = new Map();
    addRelationshipIfNotThere(fatherId, mainPersonId, PARENT_CHILD_REL);
    addRelationshipIfNotThere(motherId, mainPersonId, PARENT_CHILD_REL);
    addRelationshipIfNotThere(mainPersonId, spouseId, COUPLE_REL, true);

    let mainFtPersonId = null;
    for (let person of getList(gedcomx, "persons")) {
      let ftPersonId = getIdentifier(person, USYS_ID_TYPE);
      if (ftPersonId) {
        ftPersonId = ftPersonId.replace("p.", ""); // p.XXXX-YYY -> XXXX-YYY
        if (!getIdentifier(person, PERSISTENT_TYPE)) {
          // no "primary" or "persistent" identifier, so add one.
          person.identifiers[PERSISTENT_TYPE] = ["https://familysearch.org/ark:/61903/4:1:" + ftPersonId];
        }
        idMap.set(person.id, ftPersonId);
        if (person.id === mainPersonId) {
          mainFtPersonId = ftPersonId;
        }
        person.id = ftPersonId;
      } else {
        console.log("Could not find USYS_ID for ordinance person.");
        return;
      }
    }
    let mainPersonArk = "https://familysearch.org/ark:/61903/4:1:" + mainFtPersonId;
    let mainPersonSourceDescription = {
      "id": "#sd_" + mainFtPersonId,
      "about": mainPersonArk,
      "identifiers": {
        "http://gedcomx.org/Persistent": [mainPersonArk]
      }
    };
    gedcomx.sourceDescriptions = [mainPersonSourceDescription];
    gedcomx.description = "#" + mainPersonSourceDescription.id;
    for (let relationship of getList(gedcomx, "relationships")) {
      fixRelativeId(relationship.person1);
      fixRelativeId(relationship.person2);
      let relType = extractType(relationship.type);
      if (relType === "FATHER" || relType === "MOTHER") {
        relationship.type = PARENT_CHILD_REL;
      } else if (relType === "SPOUSE") {
        relationship.type = COUPLE_REL;
      } else if (relType !== "Couple" && relType !== "ParentChild") {
        console.log("Unexpected relationship type in OWS: " + relationship.type);
      }
    }
    return mainFtPersonId;
  }

  // --receiveOws()--
  modifyStatusMessage($status, fetching, owsId, "Fetching OWS " + owsId, "Received OWS " + owsId);
  if (owsJson) {
    let ows = owsMap.get(owsId);
    ows.createDate = getFirst(owsJson.ordinanceWorkSets).createDate.original;
    for (let ctr of getList(owsJson, "ctrs")) {
      let ordinanceType = extractType(getProperty(ctr, "ordinanceType"));
      let ordinanceStatus = extractType(getProperty(ctr, "ordinanceStatus"));
      let officialType = getProperty(getFirst(ctr, "ctrExtendedDetail"), "officialType");
      let performedDate = getProperty(ctr, "performedDate.original");
      let templeCode = getProperty(ctr, "templeRef.templeCode");
      let ordinance = new Ordinance(ctr.id, ordinanceType, ordinanceStatus, officialType, performedDate, templeCode);
      ows.ordinances.push(ordinance);
      console.log("OWS " + owsId + ": " + performedDate + " " + ordinanceType + " " + templeCode);
    }
    ows.sortOrdinances();
    for (let ordinanceWorkSet of getList(owsJson, "ordinanceWorkSets")) {
      if ("ows." + ordinanceWorkSet.id === owsId) {
        let principalId = getRelativeId(ordinanceWorkSet, "principal");
        // future: check to see if these IDs match up in the gedcomx.
        let fatherId = getRelativeId(ordinanceWorkSet, "father");
        let motherId = getRelativeId(ordinanceWorkSet, "mother");
        let wifeId = getRelativeId(ordinanceWorkSet, "wife");
        let husbandId = getRelativeId(ordinanceWorkSet, "husband");
        let gedcomx = {};
        gedcomx.persons = owsJson.persons;
        gedcomx.relationships = owsJson.relationships;
        console.log(getList(gedcomx, "relationships").length + " relationships in owsJson for " + owsId); //todo: remove this
        principalId = fixPersonIdsAndRelationshipTypes(gedcomx, context.personId, principalId, fatherId, motherId, wifeId ? wifeId : husbandId);
        ows.gedcomx = gedcomx;
        ows.principalPersonId = principalId;
      } else {
        console.log("Got unexpected ows for owd id " + owsId);
      }
    }
  }
  else {
    console.log("Could not get OWS Json for " + owsId);
  }
  handleIfFinishedFetching(fetching, context, changeLogMap, $mainTable, $status);
}

function fetchRelativesAndSources(changeLogMap, $status, context) {
  // Populate sourceMap[sourceUrl] = null, and relativeMap[relativeId].
  // so that the keys of these maps can be used to fill in the values.
  for (let personId of Object.keys(changeLogMap)) {
    let entries = changeLogMap[personId];
    for (let entry of entries) {
      let timestamp = entry.updated.toString();
      if (entry.content && entry.content.gedcomx) {
        let gedcomx = entry.content.gedcomx;
        gatherSources(sourceMap, findPersonInGx(gedcomx, personId));
        updateRelativeMap(gedcomx, timestamp,"relationships", ["person1", "person2"]);
        updateRelativeMap(gedcomx, timestamp, CHILD_REL, ["parent1", "parent2", "child"]);
      }
    }
  }

  let fetching = [...Object.keys(sourceMap)];

  setStatus($status, "Fetching " + fetching.length + " sources...");
  for (let sourceUrl of Object.keys(sourceMap)) {
    $.ajax({
      beforeSend: function(request) {
        request.setRequestHeader("Accept", "application/json");
        if (context.sessionId) {
          request.setRequestHeader("Authorization", "Bearer " + context.sessionId);
        }
      },
      dataType: "json",
      url: sourceUrl,
      success:function(gedcomx){
        receiveSourceDescription(gedcomx, $status, context, fetching, sourceUrl, sourceMap);
      },
      error: function() {
        receiveSourceDescription(null, $status, context, fetching, sourceUrl, sourceMap)
      }
    });
  }
}

// Look for a source reference on the given entity (i.e., person), and add it to the (global) sourceMap.
function gatherSources(sourceMap, entity) {
  let sourceUrl = getOnlySourceUrl(entity);
  if (sourceUrl) {
    let sourceInfo = sourceMap[sourceUrl];
    if (!sourceInfo) {
      sourceMap[sourceUrl] = new SourceInfo();
    }
  }
}

function getOnlySourceUrl(entity) {
  if (entity && entity.sources && entity.sources.length > 0) {
    if (entity.sources.length > 1) {
      // This is unexpected, because the entity we're getting should come from a change log entry with only one source on one person.
      console.log("Warning: Got " + entity.source.length + " sources, but only using first one.");
    }
    return entity.sources[0].description;
  }
}

// Populate relativeMap[relativeId] -> tsMap[timestamp] -> relative.display
// Note that relative.display is currently the same for all timestamps,
//   because the change log always provides the latest forwarded ID and latest information for each relative,
//   instead of what they would have looked like at the time.
// Future: use relatives' change log to show what they looked like at the time.
function updateRelativeMap(gedcomx, timestamp, listName, relativeKeys) {
  if (gedcomx[listName]) {
    for (let relationship of gedcomx[listName]) {
      for (let relativeKey of relativeKeys) {
        if (relationship[relativeKey]) {
          let relativeId = relationship[relativeKey].resourceId;
          let relative = findPersonInGx(gedcomx, relativeId);
          if (relative) {
            let relativeInfo = computeIfAbsent(relativeMap, relativeId, () => new RelativeInfo(relativeId));
            relativeInfo.addDisplay(timestamp, relative.display);
          }
        }
      }
    }
  }
}

// Get the value of map[key]. If not present, use the supplied function to create a default value,
//   add that value to the map, and return the value.
function computeIfAbsent(map, key, defaultValueFunction) {
  let value = map.get(key);
  if (value) {
    return value;
  }
  else {
    value = defaultValueFunction();
    map.set(key, value);
    return value;
  }
}

let sourceInfoIndex = 0;
class SourceInfo {
  constructor() {
    this.sourceId = sourceInfoIndex++;
    this.title = null;
    this.isExtraction = null;
    this.personaArk = null;
    this.gedcomx = null;
    this.recordDate = null;
    this.recordDateSortKey = null;
    this.attachedToPersonId = null; // Person ID attached to, including version number if > 1 (like "MMMM-MMM (v2)")
  }

  // Now that the SourceDescription for this source has been fetched, update this SourceInfo with information from it.
  setSourceDescription(sd) {
    this.title = ("titles" in sd && sd.titles.length && "value" in sd.titles[0]) ? sd.titles[0].value : "";
    this.isExtraction = sd.resourceType === "FSREADONLY";
    this.personaArk = ("about" in sd) ? sd.about : null;
  }
}

class RelativeInfo {
  constructor(relativeId) {
    // Family Tree person ID for a relative.
    this.relativeId = relativeId;
    // Map of ts -> FS display for the relative at that timestamp.
    // (Currently the same for all timestamps, so not really helpful).
    this.tsMap = {};
    // Set of shortened persona Arks attached to this relative (like 1:1:XXXX-YYY)
    this.attachedPersonaArks = new Set();
  }

  addDisplay(timestamp, fsDisplay) {
    this.tsMap[timestamp] = fsDisplay; // FamilySearch 'display' element with some info in it.
  }

  addPersonaArk(personaArk) {
    this.attachedPersonaArks.add(shortenPersonArk(personaArk));
  }
}

/**
 * Receive a SourceDescription from an AJAX call.
 * @param gedcomx - GedcomX containing the SourceDescription
 * @param $status - JQuery element in which to update status messages
 * @param context - Context info such as session ID.
 * @param fetching - List of sourceUrls still being fetched.
 * @param sourceUrl - SourceUrl fetched for this call
 * @param sourceMap - (Global) map of sourceUrl -> SourceInfo for that source (which is filled out here).
 */
function receiveSourceDescription(gedcomx, $status, context, fetching, sourceUrl, sourceMap) {
  fetching.splice(fetching.indexOf(sourceUrl), 1);
  if (gedcomx && "sourceDescriptions" in gedcomx && gedcomx.sourceDescriptions.length) {
    let sourceInfo = sourceMap[sourceUrl];
    sourceInfo.setSourceDescription(gedcomx.sourceDescriptions[0]);
    if (sourceInfo.personaArk && sourceInfo.personaArk.includes("ark:/61903/")) {
      fetching.push(sourceInfo.personaArk);
      // Got source description, which has the persona Ark, so now fetch that.
      $.ajax({
        beforeSend: function (request) {
          request.setRequestHeader("Accept", "application/json");
          // request.setRequestHeader("User-Agent", "ACE Record Fixer");
          // request.setRequestHeader("Fs-User-Agent-Chain", "ACE Record Fixer");
          if (context.sessionId) {
            request.setRequestHeader("Authorization", "Bearer " + context.sessionId);
          }
        },
        dataType: "json",
        url: sourceInfo.personaArk,
        success: function (gedcomx) {
          receivePersona(gedcomx, $status, context, fetching, sourceInfo);
        },
        error: function() {
          receivePersona(null, $status, context, fetching, sourceInfo);
        }
      });
    }
    if (fetching.length) {
      setStatus($status, "Fetching " + fetching.length + "/" + sourceMap.size + " sources...");
    }
    else {
      finishedReceivingSources($status);
    }
  }
}

function getMainPersonaArk(gedcomx) {
  let sd = getSourceDescription(gedcomx, null);
  if (sd) {
    if (sd.about) {
      return sd.about;
    }
    return getIdentifier(sd);
  }
}

function getCollectionName(gedcomx) {
  let collectionTitle = "<no title>";
  let sd = getSourceDescription(gedcomx, null);
  while (sd) {
    if (sd["resourceType"] === "http://gedcomx.org/Collection") {
      if (sd.titles) {
        for (let title of sd.titles) {
          if (title.value) {
            collectionTitle = title.value;
            break;
          }
        }
        break;
      }
    }
    else {
      sd = getSourceDescription(gedcomx, getProperty(sd, "componentOf.description"));
    }
  }
  return collectionTitle;
}

function getRecordDate(gedcomx) {
  function findPrimaryDate(factHolders) {
    if (factHolders) {
      for (let factHolder of factHolders) {
        if (factHolder.facts) {
          for (let fact of factHolder.facts) {
            if (fact.primary && fact.date && fact.date.original) {
              return fact.date.original;
            }
          }
        }
      }
    }
    return null;
  }
  function findLatestDate(factHolders) {
    let latestDate = null;
    let latestDateNumber = null;
    if (factHolders) {
      for (let factHolder of factHolders) {
        if (factHolder.facts) {
          for (let fact of factHolder.facts) {
            if (fact.date && fact.date.original) {
              let dateNumber = parseDateIntoNumber(fact.date.original);
              if (!latestDateNumber || dateNumber > latestDateNumber) {
                latestDateNumber = dateNumber;
                latestDate = fact.date.original;
              }
            }
          }
        }
      }
    }
    return latestDate;
  }

  let recordDate = "";
  let sd = getSourceDescription(gedcomx, null);
  while (sd) {
    if (sd["resourceType"] === "http://gedcomx.org/Record") {
      if (sd.coverage) {
        for (let coverage of sd.coverage) {
          if (coverage.temporal && coverage.temporal.original) {
            recordDate = coverage.original;
            break;
          }
        }
        break;
      }
    }
    else {
      sd = getSourceDescription(gedcomx, getProperty(sd, "componentOf.description"));
    }
  }
  if (isEmpty(recordDate)) {
    let date = findPrimaryDate(gedcomx.persons) ||
      findPrimaryDate(gedcomx.relationships) ||
      findLatestDate(gedcomx.persons) ||
      findLatestDate(gedcomx.relationships);
    if (date) {
      recordDate = date;
    }
  }
  return recordDate;
}

function receivePersona(gedcomx, $status, context, fetching, sourceInfo) {
  if (gedcomx) {
    fixEventOrders(gedcomx);
    sourceInfo.gedcomx = gedcomx;
    let personaArk = getMainPersonaArk(gedcomx);
    if (personaArk !== sourceInfo.personaArk) {
      // This persona has been deprecated & forwarded or something, so update the 'ark' in sourceInfo to point to the new ark.
      sourceInfo.personaArk = personaArk;
    }
    let person = findPersonInGx(gedcomx, personaArk);
    sourceInfo.personId = person ? person.id : null;
    sourceInfo.collectionName = getCollectionName(gedcomx);
    sourceInfo.recordDate = getRecordDate(gedcomx);
    sourceInfo.recordDateSortKey = sourceInfo.recordDate ? parseDateIntoNumber(sourceInfo.recordDate).toString() : null;
  }
  fetching.splice(fetching.indexOf(sourceInfo.personaArk), 1);
  if (fetching.length) {
    setStatus($status, "Fetching " + fetching.length + "/" + Object.keys(sourceMap).length + " sources...");
  }
  else {
    finishedReceivingSources($status, context);
  }
}

function finishedReceivingSources($status, context) {
  clearStatus($status);
  $("#" + SOURCES_VIEW).html(getSourcesViewHtml());
  split = new Split(mergeGrouper.mergeGroups[0].personRows[0].gedcomx);
  updateSplitViewHtml();
  updateComboViewHtml();
  makeTableHeadersDraggable();
  fetchRelativeSources($status, context);
}

// Begin fetching the list of source descriptions for each relative,
//   so that we can know what persona Arks are attached to each relative.
//   This allows us to know which sources attached to the main person have relatives
//   with corresponding attachments in the same source.
// For example, say person A has husband B in Family Tree; and that a marriage record R has a bride X and groom Y;
//   If X is attached to A, then if Y is also attached to B, then we can say that this source "supports" the
//   Couple relationship between A&B, because X&Y are a couple and A=X and B=Y.
function fetchRelativeSources($status, context) {
  let fetching = [...relativeMap.keys()];

  setStatus($status, "Fetching " + fetching.length + " relatives' sources...");
  for (let relativeId of relativeMap.keys()) {
    let sourceUrl = "https://www.familysearch.org/platform/tree/persons/" + relativeId + "/sources";
    $.ajax({
      beforeSend: function(request) {
        request.setRequestHeader("Accept", "application/json");
        if (context.sessionId) {
          request.setRequestHeader("Authorization", "Bearer " + context.sessionId);
        }
      },
      dataType: "json",
      url: sourceUrl,
      success:function(gedcomx){
        receiveRelativeSources(gedcomx, $status, context, fetching, relativeId);
      },
      error: function() {
        receiveRelativeSources(null, $status, context, fetching, relativeId);
      }
    });
  }
}

function receiveRelativeSources(gedcomx, $status, context, fetching, relativeId) {
  fetching.splice(fetching.indexOf(relativeId), 1);
  if (gedcomx && "sourceDescriptions" in gedcomx && gedcomx.sourceDescriptions.length) {
    let relativeInfo = relativeMap.get(relativeId);
    for (let sd of gedcomx.sourceDescriptions) {
      if (sd.about && sd.about.includes("ark:/61903")) {
        relativeInfo.addPersonaArk(sd.about);
      }
    }
  }
  if (fetching.length) {
    setStatus($status, "Fetching " + fetching.length + "/" + Object.keys(sourceMap).length + " relatives' sources...");
  }
  else {
    // Finished receiving relative sources
    clearStatus($status);
    relativeSourcesReceived = true;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// context - Map containing baseUrl, personId (of the main person), and optional "sessionId"
function formatTimestamp(ts, includeTimestamp) {
  function pad(n) {
    return String(n).padStart(2, '0');
  }
  let date = new Date(ts);
  let dateHtml = "<span class='ts-date'>" + String(date.getDate()) + "&nbsp;" + MONTHS[date.getMonth()] + "&nbsp;" + String(date.getFullYear()) +"</span>";
  if (includeTimestamp) {
    dateHtml += " <span class='ts-time'>" + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds())
             + "." + String(ts).slice(String(ts).length - 3) + "</span>";
  }
  return dateHtml;
}

// ==================== HTML ===================================
// changeLogMap - Map of personId -> GedcomX of the change log for that personId.
const HELP_VIEW    = "help-view";
const CHANGE_LOG_VIEW= "change-logs-table";
const MERGE_VIEW   = "merge-hierarchy";
const FLAT_VIEW    = "flat-view";
const SOURCES_VIEW = "sources-view";
const COMBO_VIEW   = "combo-view";
const SPLIT_VIEW   = "split-view";
const viewList = [HELP_VIEW, CHANGE_LOG_VIEW, MERGE_VIEW, FLAT_VIEW, SOURCES_VIEW, COMBO_VIEW, SPLIT_VIEW];

function getCurrentTab() {
  return viewList[$("#tabs").tabs("option", "active")];
}

function makeMainHtml(context, changeLogMap, $mainTable) {
  let personMinMaxTs = {};
  let personIds = [];
  allEntries = combineEntries(context.personId, changeLogMap, personIds, personMinMaxTs);
  let html =
    "<div id='tabs'><ul>\n" +
    "  <li class='tab'><a href='#" + HELP_VIEW + "'><span>Help</span></a></li>" +
    "  <li class='tab'><a href='#" + CHANGE_LOG_VIEW + "'><span>Change Logs</span></a></li>\n" +
    "  <li class='tab'><a href='#" + MERGE_VIEW   + "'><span>Merge view</span></a></li>\n" +
    "  <li class='tab'><a href='#" + FLAT_VIEW    + "'><span>Flat view</span></a></li>\n" +
    "  <li class='tab'><a href='#" + SOURCES_VIEW + "'><span>Sources view</span></a></li>\n" +
    "  <li class='tab'><a href='#" + COMBO_VIEW + "'><span>Combo view</span></a></li>\n" +
    "  <li class='tab'><a href='#" + SPLIT_VIEW   + "'><span>Split view</span></a></li>\n" +
    // Display Options
    "  <li id='options-tab'>" + getDisplayOptionsHtml() + "</li>" +
    "</ul>\n" +
    "<div id='" + HELP_VIEW + "'>" + getHelpViewHtml() + "</div>" +
    "<div id ='change-logs-table'>" + getChangeLogTableHtml(allEntries, personIds, personMinMaxTs) + "</div>\n" +
    "<div id='" + MERGE_VIEW + "'>" + getMergeHierarchyHtml(allEntries) + "</div>\n" +
    "<div id='" + FLAT_VIEW + "'>" + getFlatViewHtml(allEntries) + "</div>\n" +
    "<div id='" + SOURCES_VIEW + "'>Sources grid...</div>\n" +
    "<div id='" + COMBO_VIEW + "'>Flat + sources view...</div>\n" +
    "<div id='" + SPLIT_VIEW + "'>Split view...</div>\n" +
    "<div id='details'></div>\n";
  // "<div id='rel-graphs-container'>\n" +
  // "  <div id='close-rel-graphs' onclick='hideRelGraphs()'>X</div>\n" +
  // "  <div id='rel-graphs'></div>\n" +
  // "</div>\n";
  html += "</div>";
  $mainTable.html(html);
  $("#rel-graphs-container").hide();
  $("#tabs").tabs({
    active: viewList.indexOf(COMBO_VIEW),
    activate: displayAvailableOptions
  });
  // Prevent text from being selected when shift-clicking a row.
  for (let eventType of ["keyup", "keydown"]) {
    window.addEventListener(eventType, (e) => {
      document.onselectstart = function() {
        return !(e.shiftKey);
      }
    });
  }
  $(document).keydown(handleMergeKeypress);
  initOptionsDisplay();
  makeTableHeadersDraggable();
}

let columnPressed = false;
let columnStart = undefined;
let columnStartX;
let columnStartWidth;
let resizingTable;
let tableStartSize;
// map of table.id -> width, and column.id -> width, if manually set at any point.
let tableMap = new Map();

function makeTableHeadersDraggable() {
  function findTable(element) {
    while (element && element.prop('nodeName') !== "TABLE") {
      element = element.parent();
    }
    return element;
  }

  for (let elementId of tableMap.keys()) {
    let $element = $("#" + elementId);
    $element.width(tableMap.get(elementId));
  }

  $(".drag-width").mousedown(function(e) {
    columnStart = $(this);
    columnPressed = true;
    columnStartX = e.pageX;
    columnStartWidth = $(this).width();
    // Table jquery element that contains the dragged cell.
    // If this is set, then dragging resizes the table instead of the column.
    resizingTable = columnStart.attr("id") === "drag-table" ? findTable(columnStart) : null;
    tableStartSize = resizingTable ? resizingTable.width() : null;
    $(columnStart).addClass("resizing");
  });

  $(document).mousemove(function(e) {
    if(columnPressed) {
      if (resizingTable) {
        let newColumnSize = columnStartWidth + (e.pageX - columnStartX);
        let newSizeRatio = newColumnSize / columnStartWidth;
        $(resizingTable).width(tableStartSize * newSizeRatio);
        tableMap.set(resizingTable.attr("id"), tableStartSize * newSizeRatio);
      }
      else {
        $(columnStart).width(columnStartWidth + (e.pageX - columnStartX));
        tableMap.set(columnStart.attr("id"), columnStartWidth + (e.pageX - columnStartX));
      }
      e.preventDefault();
    }
  });

  $(document).mouseup(function() {
    if(columnPressed) {
      $(columnStart).removeClass("resizing");
      columnPressed = false;
    }
  });
  // Also make it so that clicked hyperlinks don't propagate
  $("a").click(function(e){
    e.stopPropagation();
  });
}

function getChangeLogTableHtml(allEntries, personIds, personMinMaxTs) {
  let html = "<table><tr><th>Timestamp</th>";
  for (let personId of personIds) {
    html += "<th class='person-id'>" + personId + "</th>";
  }
  html += "</tr>\n";
  let prevTimestamp = null;
  let evenTimestampGroup = true;
  let entryIndex = 0;
  for (let entry of allEntries) {
    if (entry.updated !== prevTimestamp) {
      evenTimestampGroup = !evenTimestampGroup;
    }
    let rowClass = evenTimestampGroup ? " even-ts" : " odd-ts";

    html += "<tr>";
    if (entry.updated !== prevTimestamp) {
      // Combine all cells with the same timestamp into a single cell.
      let rowspan = numRowsWithSameTimestamp(allEntries, entryIndex);
      let rowspanHtml = rowspan > 1 ? "rowspan='" + rowspan + "' " : "";
      html += "<td " + rowspanHtml +
        //"onclick='displayRecords(this, " + entryIndex + ")' " +  (<== in case we implement this...)
        "class='timestamp" + rowClass + "'>" + formatTimestamp(entry.updated, true) + "</td>";
    }

    for (let column = 0; column < personIds.length; column++) {
      let personId = personIds[column];
      if (column === entry.column) {
        html += "<td class='entry" + rowClass + "' id='entry-" + entry.entryIndex + "' onMouseover='showChangeLogEntryDetails(" + entry.entryIndex + ")' onMouseout='hideDetails()'>" + getEntryHtml(entry) + "</td>";
      }
      else if (entry.updated < personMinMaxTs[personId].min || entry.updated > personMinMaxTs[personId].max) {
        html += "<td class='empty-cell" + rowClass + "'></td>";
      }
      else {
        html += "<td class='between-cell" + rowClass + "'></td>";
      }
    }
    html += "</tr>\n";
    prevTimestamp = entry.updated;
    entryIndex++;
  }

  html += "</table>";
  return html;
}

function numRowsWithSameTimestamp(allEntries, entryIndex) {
  let timestamp = allEntries[entryIndex].updated;
  let differentIndex = entryIndex + 1;
  while (differentIndex < allEntries.length && allEntries[differentIndex].updated === timestamp) {
    differentIndex++;
  }
  return differentIndex - entryIndex;
}

function getEntryHtml(entry) {
  return "<span class='entry-title'>" + entry.title + "</span>";
}

function makeChangeLogEntries(gedcomx) {
  // Use the original GedcomX "entry" array, but add 'personId' to each.
  let entries = gedcomx.entries;
  let personId = extractPersonId(gedcomx.links.person.href);
  let originalIndex = 0;
  for (let entry of entries) {
    entry.personId = personId;
    entry.originalIndex = originalIndex++;
  }
  return entries;
}

function getNewMergeIds(personId, changeLogEntries) {
  let mergeIds = []
  if (changeLogEntries) {
    for (let entry of changeLogEntries) {
      if (entry.changeInfo[0].operation.endsWith("/Merge")) {
        let removedChangeId = entry.changeInfo[0].removed.resourceId;
        for (let person of entry.content.gedcomx.persons) {
          if (person.id === removedChangeId) {
            let personUrl = getPrimaryIdentifier(person);
            let removedPersonId = extractPersonId(personUrl);
            mergeIds.push(removedPersonId);
            // List of merges (usually just one, unless this person was "restored" later) where the removedPersonId went away.
            let mergeList = computeIfAbsent(mergeMap, removedPersonId, () => []);
            mergeList.push({"survivor": personId, "timestamp": entry.updated});
          }
        }
      }
    }
  }
  return mergeIds;
}

function getPrimaryIdentifier(entity) {
  if (entity && entity.hasOwnProperty("identifiers") && entity.identifiers.hasOwnProperty("http://gedcomx.org/Primary")) {
    let primaryIds = entity.identifiers["http://gedcomx.org/Primary"];
    return primaryIds && primaryIds.length > 0 ? primaryIds[0] : null;
  }
  return null;
}

function parsePersonUrl(url) {
  let matches = url.replace(/\?.*/, "").replace(/\/changes$/, "").match(/^(?<baseUrl>.*[:/])(?<personId>[^/:]*)$/)
  return {
    "baseUrl": matches.groups.baseUrl,
    "personId": matches.groups.personId
  }
}

function extractPersonId(url) {
  return parsePersonUrl(url)["personId"];
}

// Combine all the entries from the changeLogMap (personId -> array of change log entries)
// into a single array, sorted by timestamp and then by column.
// Augment each entry with a 'column' index.
// Fill in personMinMaxTs with a map of personId -> {min: minTs, max: maxTs}.
function combineEntries(mainPersonId, changeLogMap, personIds, personMinMaxTs) {

  // Sort by "updated" timestamp (newest first), and then by person column, with the main person ID first.
  // Sort Person Create to the bottom and Person Delete to the top.
  // Use entry.id as the tie-breaker
  function compareTimestamp(a, b) {
    if (a.updated < b.updated) {
      return 1;
    }
    if (a.updated > b.updated) {
      return -1;
    }
    // Equal timestamps, so put main person first.
    if (a.personId !== b.personId) {
      if (a.personId === mainPersonId || b.personId === mainPersonId) {
        return a.personId === mainPersonId ? -1 : 1;
      }
      let columnA = a.personId in personColumnMap ? personColumnMap[a.personId] : null;
      let columnB = b.personId in personColumnMap ? personColumnMap[b.personId] : null;
      if (columnA !== null && columnB !== null) {
        return columnA < columnB ? -1 : 1;
      }
      return a.personId.localeCompare(b.personId);
    }
    // Same person, same timestamp. So make sure Delete < other < Create
    if (isPersonAction("Create", a) || isPersonAction("Create", b)) {
      return isPersonAction("Create", a) ? 1 : -1;
    }
    if (isPersonAction("Merge", a) || isPersonAction("Merge", b)) {
      return isPersonAction("Merge", a) ? 1 : -1;
    }
    if (isPersonAction("Delete", a) || isPersonAction("Delete", b)) {
      return isPersonAction("Delete", a) ? -1 : 1;
    }
    // Same timestamp and person ID; so use that person's original change log order.
    return a.originalIndex - b.originalIndex;
  }

  function isPersonAction(action, entry) {
    return entry && entry.changeInfo
      && extractType(entry.changeInfo[0].objectType) === "Person"
      && extractType(entry.changeInfo[0].operation) === action;
  }

  let firstTimestamps = [];
  allEntries = [];
  let personColumnMap = {};
  for (let personId of Object.keys(changeLogMap)) {
    let entries = changeLogMap[personId];
    firstTimestamps.push({"personId" : personId, "updated": entries[0].updated});
    allEntries = allEntries.concat(entries);
    personMinMaxTs[personId] = {"max": entries[0].updated};
  }
  firstTimestamps.sort(compareTimestamp);
  let column = 0;
  for (let firstTimestamp of firstTimestamps) {
    personIds[column] = firstTimestamp.personId;
    personColumnMap[firstTimestamp.personId] = column++;
  }
  for (let entry of allEntries) {
    entry.column = personColumnMap[entry.personId];
    let minMax = personMinMaxTs[entry.personId];
    if (!("min" in minMax) || entry.updated < minMax.min) {
      minMax.min = entry.updated;
    }
  }
  allEntries.sort(compareTimestamp);
  let entryIndex = 0;
  for (let entry of allEntries) {
    entry.entryIndex = entryIndex++;
  }
  markMergePersonIds(allEntries);
  return allEntries;
}

function isMergeEntry(entry) {
  let changeInfo = entry.changeInfo[0];
  return changeInfo["operation"] === "http://familysearch.org/v1/Merge" && changeInfo["objectType"] === "http://gedcomx.org/Person";
}

function markMergePersonIds(entries) {
  // Set 'mergeSurvivorId' to the personId of the survivor for all entries involved in a merge,
  // and 'mergeDuplicateId' to the personId of the duplicate for all entries involved in a merge.
  for (let i = 0; i < entries.length; i++) {
    let entry = entries[i];
    let changeInfo = entry.changeInfo[0];
    if (isMergeEntry(entry)) {
      let survivorId = getPersonId(findPersonByLocalId(entry, changeInfo.resulting.resourceId));
      let duplicateId = getPersonId(findPersonByLocalId(entry, changeInfo.removed.resourceId));
      for (let j = i; j >= 0 && entries[j].updated === entry.updated; j--) {
        entries[j].mergeSurvivorId = survivorId;
        entries[j].mergeDuplicateId = duplicateId;
      }
      for (let j = i + 1; j < entries.length && entries[j].updated === entry.updated; j++) {
        entries[j].mergeSurvivorId = survivorId;
        entries[j].mergeDuplicateId = duplicateId;
      }
    }
  }
}

function updateStatus($status, message) {
  $status.append(encode(message) + "<br/>\n");
}

function setStatus($status, message) {
  $status.html(encode(message));
}

function clearStatus($status) {
  $status.html("");
}

function showChangeLogEntryDetails(entryIndex){
  let html = getEntryDetailsHtml(entryIndex);
  let $entryElement = $("#entry-" + entryIndex);
  let $details = $("#details");
  $details.html(html);
  let offset = $entryElement.offset();
  let entryLeft = offset.left;
  let entryRight = entryLeft + $entryElement.width();
  let entryHeight = $entryElement.height();
  let clientWidth = document.documentElement.clientWidth;
  let innerHeight = $(document).innerHeight();
  if (entryLeft > clientWidth - entryRight) {
    // More room to left of entry element than to right.
    $details.css('left', '');
    $details.css('right', clientWidth - entryLeft + 10);
  }
  else {
    $details.css('right', '');
    $details.css('left', entryRight + 10);
  }
  let detailsHeight = $details.height();
  if (offset.top + detailsHeight > innerHeight) {
    $details.css('top', offset.top + entryHeight - detailsHeight);
  }
  else {
    $details.css('top', offset.top);
  }
  $details.show();
  enabletip=true
  return false;
}

function hideDetails(){
  $("#details").hide();
}

//============ Change Entry Logic =====================
function getEntryDetailsHtml(entryIndex) {
  let entry = allEntries[entryIndex];
  let html = encode(entry.title) + "<br>";
  html += "<span class='contributor'>" + encode("Contributor: " + entry.contributors[0].name) + "</span><br>";
  let changeInfo = entry.changeInfo[0];
  let timestamp = entry.updated;
  let personId = entry.personId;
  if ("reason" in changeInfo && changeInfo.reason) {
    html += "<span class='change-reason'>" + encode("Reason: " + changeInfo.reason).replaceAll("\n", "<br>") + "</span><br>";
  }
  if (entry.changeInfo.length > 1) {
    console.log("Warning: Got " + entry.changeInfo.length + " elements in entry.changeInfo[]");
  }
  let originalId = getChangeId(changeInfo, true);
  let resultingId = getChangeId(changeInfo, false);
  // Create, Update, Delete, Merge
  let operation = extractType(changeInfo.operation);

  // Person, Child, ChildAndParentsRelationship, Parent1/2, Spouse1/2,
  // Birth/[Christening]/Death/Burial, Fact, Gender, Marriage/Divorce/etc.,
  // Occupation/Religion/...?
  // LifeSketch, Note, SourceReference, EvidenceReference,
  let objectType = extractType(changeInfo.objectType);

  // Person, Couple, ChildAndParentsRelationship
  let modifiedObjectType = extractType(changeInfo.objectModifier);
  let handled = true;
  switch(modifiedObjectType) {
    case "Person":
      let originalPerson = findPersonByLocalId(entry, originalId);
      let resultingPerson = findPersonByLocalId(entry, resultingId);
      switch(objectType) {
        case "BirthName":
          html += changeHtml(operation, getNameChangeHtml(originalPerson), getNameChangeHtml(resultingPerson));
          break;
        case "SourceReference":
          html += changeHtml(operation, getSourceReferenceHtml(originalPerson), getSourceReferenceHtml(resultingPerson), false);
          break;
        case "Gender":
          html += changeHtml(operation, getGender(originalPerson), getGender(resultingPerson));
          break;
        case "EvidenceReference":
          html += changeHtml(operation, getEvidenceHtml(originalPerson), getEvidenceHtml(resultingPerson), false);
          break;
        case "Person":
          html += changeHtml(operation, null, encode("Created " + personId + " (again?)"));
          break;
        case "Note":
          html += changeHtml(operation, getNoteHtml(originalPerson), getNoteHtml(resultingPerson), false);
          break;
        case "Birth":
        case "Christening":
        case "Death":
        case "Burial":
        case "Fact":
        default:
          if (hasFact(originalPerson) || hasFact(resultingPerson)) {
            html += changeHtml(operation, getFactsHtml(originalPerson), getFactsHtml(resultingPerson), false);
          }
          else {
            handled = false;
          }
      }
      break;
    case "Couple":
      let originalCouple = findCoupleRelationship(entry, originalId);
      let resultingCouple = findCoupleRelationship(entry, resultingId);
      switch(objectType.replace(/[0-9]*$/, "")) {
        case "SourceReference":
          html += changeHtml(operation, getSourceReferenceHtml(originalCouple), getSourceReferenceHtml(resultingCouple), false);
          html += getCoupleRelationshipHtml(originalCouple, personId, timestamp);
          html += getCoupleRelationshipHtml(resultingCouple, personId, timestamp);
          break;
        case "Couple":
        case "Spouse":
          html += changeHtml(operation, getCoupleRelationshipHtml(originalCouple, personId, timestamp), getCoupleRelationshipHtml(resultingCouple, personId, timestamp), false);
          break;
        default:
          if (hasFact(originalCouple) || hasFact(resultingCouple)) {
            html += changeHtml(operation, getCoupleRelationshipHtml(originalCouple, personId, timestamp), getCoupleRelationshipHtml(resultingCouple, personId, timestamp), false);
          }
          else {
            handled = false;
          }
      }
      break;
    case "ChildAndParentsRelationship":
      let originalRel = findChildAndParentsRelationship(entry, originalId)
      let resultingRel = findChildAndParentsRelationship(entry, resultingId)
      switch(objectType) {
        case "SourceReference":
          html += changeHtml(operation, getSourceReferenceHtml(originalRel), getSourceReferenceHtml(resultingRel), false);
          html += getChildRelationshipHtml(originalRel, personId, timestamp);
          html += getChildRelationshipHtml(resultingRel, personId, timestamp);
          break;
        case "ChildAndParentsRelationship":
        case "Child":
        case "Parent1":
        case "Parent2":
        default:
          //todo: Use objectType to add indicators or something to the display of a relationship
          html += changeHtml(operation,
            getChildRelationshipHtml(originalRel, personId, timestamp),
            getChildRelationshipHtml(resultingRel, personId, timestamp), false);
          break;
      }
      break;
    default:
      if (objectType === "Person") {
        let originalPerson = findPersonByLocalId(entry, originalId);
        switch (operation) {
          case "Merge":
            let removedPersonId = originalPerson.identifiers["http://gedcomx.org/Primary"][0].replace(/.*4:1:/, "");
            html += "<span class='merged-from'>" + encode("Merged from " + removedPersonId) + "</span><br>";
            break;
          case "Create":
            html += changeHtml(operation, null, encode("Created " + personId));
            break;
          case "Delete": // Probably got merged into someone
            let mergedIntoMessage = getMergedIntoMessage(personId, entry.updated);
            html += changeHtml(operation, encode("Deleted " + personId + mergedIntoMessage), null);
            break;
          default:
            handled = false;
        }
      }
      else {
        handled = false;
      }
  }
  if (!handled) {
    console.log("Unhandled operation: modified object: " + modifiedObjectType + "; object: " + objectType + "; operation: " + operation);
  }
  return html.replace(/<br>[\n]*$/, "");
}

function getNoteHtml(person) {
  let html = "";
  if (person && person.notes) {
    for (let note of person.notes) {
      if (note.subject) {
        let subjectClass = (note.text && note.text.includes(note.subject)) ? "ft-note-redundant-subject" : "ft-note-subject";
        html += "<span class='" + subjectClass + "'>" + encode("Subject: " + note.subject.replaceAll("\n", "; ")) + "</span><br>\n";
      }
      if (note.text) {
        html += "Note: <span class='ft-note'>" + encode(note.text).replaceAll("\n", "<br>\n") + "</span><br>\n";
      }
      html += getChangeMessage(note);
    }
  }
  return html;
}

function getEvidenceHtml(person) {
  if (person && person.evidence) {
    let html = "";
    for (let evidence of person.evidence) {
      html += encode("Evidence link: " + evidence.resource) + "<br>\n" + getChangeMessage(evidence);
    }
    return html;
  }
  return "";
}

function getMergedIntoMessage(removedPersonId, timestamp) {
  let mergeList = mergeMap.get(removedPersonId);
  if (mergeList) {
    for (let mergeItem of mergeList) {
      if (mergeItem.timestamp === timestamp) {
        return " (Merged into " + mergeItem.survivor + ")";
      }
    }
    if (mergeList.length === 1) {
      return " (Probably merged into " + mergeList[0].survivor + ", but timestamp differs.)";
    }
  }
  return "";
}

function hasFact(person, key="facts") {
  return person && key && person[key] && person[key].length > 0;
}

function getFactsHtml(entity, key="facts") {
  if (hasFact(entity, key)) {
    let factHtmlList = [];
    for (let fact of entity[key]) {
      factHtmlList.push(getFactHtml(fact));
      factHtmlList.push(getChangeMessage(fact));
    }
    return combineHtmlLists(factHtmlList);
  }
  return "";
}

function trimPlace(place) {
  return place ? place
    .replace(", United States of America", "")
    .replace(", United States", "")
    .replace(", Vereinigte Staaten von Amerika", "") : null;
}
function getFactHtml(fact, ignoreStatus) {
  let type = extractType(fact.type);
  let date = fact.date ? fact.date.original : null;
  let place = fact.place ? trimPlace(fact.place.original) : null;
  let value = fact.value ? fact.value : null;
  let statusClass = fact.status && !ignoreStatus ? " " + fact.status : "";
  let html = "<span class='fact-type" + statusClass + "'>"
    + (fact.status === ADDED_STATUS && !ignoreStatus ? "+" : "")
    + encode(type ? type : "<unknown fact type>");
  if (date || place || value) {
    html += ":</span> ";
    if (value) {
      html += "<span class='value " + statusClass + "'>" + encode(value + (date || place ? ";" : "")) + "</span>";
    }
    if (date && place) {
      html += "<span class='date " + statusClass + "'>" + encode(date + ";") + "</span> <span class='place" + statusClass + "'>" + encode(place) + "</span>";
    } else {
      html += date ? "<span class='date" + statusClass + "'>" + encode(date) + "</span>"
        : "<span class='place" + statusClass + "'>" + encode(place) + "</span>";
    }
  }
  else {
    html += "</span>";
  }
  return html;
}

function getChangeMessage(entity) {
  let changeMessage = entity.changeMessage;
  if (!changeMessage && entity.attribution) {
    changeMessage = entity.attribution.changeMessage;
  }
  return changeMessage ? "<span class='change-message'>" + encode("Change message: " + changeMessage) + "</span><br>\n" : "";
}

// Return true if person1 and person2 are both Male or Female but are not the same gender.
function oppositeGender(person1, person2) {
  let gender1 = getGender(person1);
  let gender2 = getGender(person2);
  return (gender1 !== gender2) && (gender1 !== "Unknown" && gender2 !== "Unknown");
}

function getGender(person) {
  if (person && person.gender && person.gender.type) {
    return extractType(person.gender.type);
  }
  return "Unknown";
}

function getCoupleRelationshipHtml(coupleRelationship, personId, timestamp) {
  if (!coupleRelationship) {
    return "";
  }
  let interpretation = interpretCoupleRelationship(coupleRelationship, personId);
  let html = "<table class='child-rel'>";
  html += getRelativeRow(coupleRelationship, "person1", interpretation, timestamp, "facts");
  html += getRelativeRow(coupleRelationship, "person2", interpretation, timestamp, null);
  html += "</table>\n" + getChangeMessage(coupleRelationship);
  let id = getPrimaryIdentifier(coupleRelationship);
  if (id) {
    id = extractType(id);
    html += "<br>" + encode("Rel id: " + id);
  }
  return html;
}

function interpretCoupleRelationship(rel, personId) {
  let husbandId = getRelativeId(rel, "person1");
  let wifeId = getRelativeId(rel, "person2");
  if (personId === husbandId) {
    return {"person1": "Person", "person2": "Wife"};
  }
  else if (personId === wifeId) {
    return {"person1": "Husband", "person2": "Person"};
  }
  else {
    // Shouldn't be possible.
    return {"person1": "person1?", "Parent2": "person2?"};
  }
}

function getChildRelationshipHtml(rel, personId, timestamp) {
  if (!rel) {
    return "";
  }
  let interpretation = interpretRelationship(rel, personId);
  let html = "<table class='child-rel'>";
  html += getRelativeRow(rel, "Parent1", interpretation, timestamp, "parent1Facts");
  html += getRelativeRow(rel, "Parent2", interpretation, timestamp, "parent2Facts");
  html += getRelativeRow(rel, "Child", interpretation, timestamp, "childFacts");
  html += "</table>\n" + getChangeMessage(rel);
  return html;
}

function interpretRelationship(rel, personId) {
  let fatherId = getRelativeId(rel, "Parent1");
  let motherId = getRelativeId(rel, "Parent2");
  let childId = getRelativeId(rel, "Child");
  if (personId === fatherId) {
    return {"Parent1": "Person", "Parent2": "Wife", "Child": "Child"};
  }
  else if (personId === motherId) {
    return {"Parent1": "Husband", "Parent2": "Person", "Child": "Child"};
  }
  else if (personId === childId) {
    return {"Parent1": "Father", "Parent2": "Mother", "Child": "Person"};
  }
  else {
    // Shouldn't be possible.
    return {"Parent1": "", "Parent2": "", "Child": ""};
  }
}

// Get HTML row for a relative, with cells for the "key" (person1/2/child), relative's name, and fact HTML.
// rel - Couple or ChildAndParents relationship
// key - person1/2, or parent1/2 or child
// interpretation - Map of key -> relationship to display in second column of table (e.g., "Parent2" might be "Mother" or "Wife").
function getRelativeRow(rel, key, interpretation, timestamp, factKey="facts") {
  let relativeId = getRelativeId(rel, key);
  let label = interpretation[key];
  let relativeName = getRelativeName(relativeId, timestamp);
  return "<tr><td>" + encode(key) + "</td><td>" + encode(label) + "</td><td>"
    + encode(relativeId)+ "</td><td>" + encode(relativeName) + "</td>"
    + "<td>" + getFactsHtml(rel, factKey) + "</td>"
    + "</tr>\n";
}

function getRelativeId(rel, key) {
  return key.toLowerCase() in rel && rel[key.toLowerCase()] ? rel[key.toLowerCase()].resourceId : null;
}

function getRelativeName(relativeId, timestamp) {
  let relativeInfo = relativeMap.get(relativeId);
  if (relativeInfo) {
    let relativeDisplay = relativeInfo.tsMap[timestamp];
    if (relativeDisplay && relativeDisplay.name) {
      return relativeDisplay.name;
    }
  }
  return "";
}

function getSourceReferenceHtml(entity) {
  let sourceUrl = getOnlySourceUrl(entity);
  let sourceInfo = sourceMap[sourceUrl];
  if (sourceInfo && ("title" in sourceInfo || "ark" in sourceInfo)) {
    let title = "title" in sourceInfo ? "<span class='source-title'>" + encode(sourceInfo.title) + "</span><br>" : "";
    let ark = "ark" in sourceInfo ? "<span class='source-ark'>" + encode(sourceInfo.personaArk) + "</span><br>" : "";
    return "<br>" + title + ark + "<br>\n" + getChangeMessage(sourceInfo);
  }
}

function getNameChangeHtml(person) {
  if (person && person.names) {
    return encode(person.names[0].nameForms[0].fullText) + "<br>\n" + getChangeMessage(person.names[0]);
  }
  else if (person && person["display"] && person.display["name"]) {
    return encode(person.display.name);
  }
  return encode("<no name>");
}

function changeHtml(operation, originalValue, newValue, shouldEncode=true) {
  switch(operation) {
    case "Create":
      return createHtml(newValue, shouldEncode);
    case "Update":
      return updateHtml(originalValue, newValue, shouldEncode);
    case "Delete":
      return deleteHtml(originalValue, shouldEncode);
  }
}

function createHtml(newValue, shouldEncode=true) {
  return "<span class='new-value'>" + maybeEncode(newValue, shouldEncode) + "</span><br>";
}

function updateHtml(originalValue, newValue, shouldEncode=true) {
  return "<span class='old-value'>" + maybeEncode(originalValue, shouldEncode) + "</span>" + encode(" => ")
    + "<span class='new-value'>" + maybeEncode(newValue, shouldEncode) + "</span><br>";
}

function deleteHtml(deletedValue, shouldEncode=true) {
  return "<span class='delete-value'>" + maybeEncode(deletedValue, shouldEncode) + "</span><br>";
}

function maybeEncode(s, shouldEncode=true) {
  if (!s) {
    return "";
  }
  return shouldEncode ? encode(s) : s;
}

// Find the person referenced by entry.changeInfo.(original or resulting).resourceId, if any, or null if no such id.
// (Throw an exception if there is such an id and the person with that id can't be found).
function findPersonByLocalId(entry, localId) {
  return findEntity(entry, "persons", localId);
}

function findCoupleRelationship(entry, localId) {
  return findEntity(entry, "relationships", localId);
}

function findChildAndParentsRelationship(entry, localId) {
  return findEntity(entry, CHILD_REL, localId);
}

function findEntityByPrimaryIdentifier(entityList, primaryIdentifier) {
  if (entityList) {
    for (let entity of entityList) {
      if (primaryIdentifier === getPrimaryIdentifier(entity)) {
        return entity;
      }
    }
  }
  return null;
}

function findEntity(entry, entityType, entityId) {
  if (entityId && entityType in entry.content.gedcomx) {
    for (let entity of entry.content.gedcomx[entityType]) {
      if (entity.id === entityId) {
        return entity;
      }
    }
    console.log("Could not find id " + entityId + " in " + entityType);
  }
  return null;
}

// Get the resourceId of entry.changeInfo[removed/original/resulting]
// If isOriginal is true, the uses the 'original', if any, or else the 'removed'.
// (In a merge, there is a 'removed' and 'resulting' but no 'original').
function getChangeId(changeInfo, isOriginal) {
  if (isOriginal && changeInfo.original) {
    return changeInfo.original.resourceId;
  }
  else if (isOriginal && changeInfo.removed) {
    return changeInfo.removed.resourceId;
  }
  else if (!isOriginal && changeInfo.resulting) {
    return changeInfo.resulting.resourceId;
  }
  return null;
}

function assume(assumption) {
  if (!assumption) {
    throw new Error("Violated assumption.");
  }
}

// function displayRecords(element, entryIndex) {
//   let gedcomxColumns = buildGedcomxColumns(entryIndex);
//   //future...
// }

// function buildGedcomxColumns(entryIndex) {
//   // Map of column# -> GedcomX object for that column
//   let columnGedcomxMap = {};
//   // Move entryIndex to the top of the list of changes that were all done at the same time.
//   while (entryIndex > 0 && allEntries[entryIndex - 1].updated === allEntries[entryIndex].updated) {
//     entryIndex--;
//   }
//   // Apply each change to the gedcomx at that entry's column.
//   for (let i = allEntries.length - 1; i >= entryIndex; i--) {
//     let entry = allEntries[i];
//     let gedcomx = columnGedcomxMap[entry.column];
//     if (!gedcomx) {
//       gedcomx = getInitialGedcomx(entry.personId);
//       columnGedcomxMap[entry.column] = gedcomx;
//     }
//     updateGedcomx(gedcomx, entry);
//   }
//   return columnGedcomxMap;
// }

// ========== MergeNode =============================
class MergeNode {
  // Constructor with required personId and, when created as the result of a merge, also survivor and duplicate merge nodes.
  constructor(personId, survivorMergeNode, duplicateMergeNode) {
    this.personId = personId;
    // When a person is merged, the "survivor" keeps the same person ID, but will have an incremented version #.
    this.version = survivorMergeNode ? survivorMergeNode.version + 1 : 1;
    // First (earliest in time) entry. For a merged person, this is the person merge entry.
    this.firstEntry = null;
    let survivorGx = survivorMergeNode ? survivorMergeNode.gedcomx : null;
    // GedcomX within 24 hours of the person's creation, or at the initial time of merge.
    this.gedcomx = survivorGx ? copySurvivorGedcomx(survivorGx) : getInitialGedcomx(personId);
    // Flag for whether only changes in 2012 or within 24 hours of creation have been made to this person's GedcomX so far
    this.isInitialIdentity = true;

    this.parentNode = null;
    this.prevNode = survivorMergeNode;
    this.dupNode = duplicateMergeNode;
    this.indent = "";
  }

  isLeafNode() {
    return !this.prevNode && !this.dupNode;
  }

  /**
   * Update the GedcomX of this MergeNode with one change log entry.
   * - If the entry is not within 24 hours of the first entry (or happened after the Great Migration in 2012),
   *   then set the isInitialIdentity to false.
   * @param entry
   */
  update(entry) {
    function hasBeenLongEnough(entryTs, firstTs, entry) {
      if (entryTs - firstTs > 24*3600*1000 && new Date(entryTs).getFullYear() > 2012) {
        // It has been over 24 hours and after 2012 when a change was made.
        // But also allow a source attachment in 2015, when extraction sources were auto-attached.
        if (new Date(entryTs).getFullYear() === 2015) {
          let changeInfo = entry.changeInfo[0];
          return !(extractType(changeInfo.operation) === "Create" &&
            extractType(changeInfo.objectType) === "SourceReference" &&
            extractType(changeInfo.objectModifier) === "Person");
        }
        return true;
      }
      return false;
    }

    if (!this.firstEntry) {
      this.firstEntry = entry;
    }
    else if (this.isInitialIdentity && this.firstEntry && hasBeenLongEnough(entry.updated, this.firstEntry.updated, entry)) {
      // We got an entry that is over 24 hours after the first one for this person (and after 2012),
      // so start applying changes to a new copy of the GedcomX that represents the "latest"
      // instead of the 'initial identity'.
      this.isInitialIdentity = false;
    }
    updateGedcomx(this.gedcomx, entry, this.isInitialIdentity);
  }

  // Create a new MergeNode by merging the given person's MergeNode into this one's person.
  merge(duplicateMergeNode) {
    let newSurvivorMergeNode = new MergeNode(this.personId, this, duplicateMergeNode);
    this.parentNode = newSurvivorMergeNode;
    duplicateMergeNode.parentNode = newSurvivorMergeNode;
    return newSurvivorMergeNode;
  }
}

// ===============
class PersonDisplay {
  constructor(person, nameClass, status, coupleRelationship, shouldIncludeId) {
    this.person = person;
    this.name = "<span class='" + nameClass + (status ? " " + status : "") + "'>" + encode(getPersonName(person)) + "</span>";
    this.coupleRelationship = coupleRelationship;
    if (nameClass !== "person" && shouldIncludeId) {
      this.name += " <span class='relative-id'>(" + encode(person.id) + ")</span>";
    }
    this.updateFacts();
  }

  updateFacts() {
    this.facts = getFactListHtml(this.person);
    let coupleFacts = this.coupleRelationship && this.coupleRelationship.type === COUPLE_REL ? getFactListHtml(this.coupleRelationship) : null;
    if (this.facts && coupleFacts) {
      this.facts += "<br>";
    }
    if (coupleFacts) {
      this.facts += "<span class='couple-facts'>" + coupleFacts + "</span>";
    }
  }
}

// ================
class FamilyDisplay {
  constructor(spouseDisplay) {
    if (spouseDisplay) {
      this.spouse = spouseDisplay;
    }
    this.children = [];
  }
  sortChildren() {
    function getBirthDateNumber(person) {
      let dateNumber = null;
      if (person.facts) {
        for (let fact of person.facts) {
          let type = extractType(fact.type);
          if (type === 'Birth' || ((type === 'Christening' || type === 'Baptism') && !dateNumber)) {
            let date = getFactDate(fact);
            if (date) {
              let newDateNumber = parseDateIntoNumber(date);
              if (newDateNumber) {
                dateNumber = newDateNumber;
              }
            }
          }
        }
      }
      return dateNumber;
    }

    if (this.children.length < 2) {
      return;
    }
    // Move each child who has a birth date up before the first one who has a later birth date.
    // This sorts the children such that (a) any with birth dates are in the right order, and
    // (b) all other children remain otherwise in as much the same order as possible.
    let childInfos = [];
    let originalOrder = 0;
    for (let child of this.children) {
      childInfos.push({
        child: child,
        originalOrder: originalOrder++,
        birthDateNum: getBirthDateNumber(child.person)
      });
    }
    let movedChild = false;
    for (let i = this.children.length - 1; i >= 0; i--) {
      let childInfo = childInfos[i];
      if (childInfo.birthDateNum) {
        for (let prevIndex = i - 1; prevIndex >= 0; prevIndex--) {
          let prevInfo = childInfos[prevIndex];
          if (prevInfo.birthDateNum && prevInfo.birthDateNum > childInfo.birthDateNum) {
            // delete childInfo from its current place in the array
            childInfos.splice(i, 1);
            // insert childInfo into its new place at 'prevIndex'
            childInfos.splice(prevIndex, 0, childInfo);
            i++; // make up for the i-- that is about to happen so that we don't skip an element that just moved into this spot.
            movedChild = true;
            break; // break out of the inner loop. If there's another even-earlier child, this element will get another chance to find it.
          }
        }
      }
    }
    if (movedChild) {
      for (let i = 0; i < childInfos.length; i++) {
        this.children[i] = childInfos[i].child;
      }
    }
  }
}

function handleMergeKeypress(event) {
  if (event.key === "Escape") {
    console.log("Pressed escape");
    for (let grouper of [mergeGrouper, flatGrouper, sourceGrouper, comboGrouper]) {
      if (grouper) {
        grouper.deselectAll();
      }
    }
  }
}

function handleRowClick(event, rowId) {
  let grouper = grouperMap[rowId];
  console.log("Clicked row " + rowId + (event.shiftKey ? " + shift" : "") + (event.ctrlKey ? " + ctrl" : "") + (event.metaKey ? " + meta" : ""));
  if (event.shiftKey) {
    grouper.selectUntil(rowId);
  }
  else {
    grouper.toggleRow(rowId);
  }
}

function handleColumnClick(event, rowId) {
  let grouper = grouperMap[rowId];
  console.log("Clicked column " + rowId + (event.shiftKey ? " + shift" : "") + (event.ctrlKey ? " + ctrl" : "") + (event.metaKey ? " + meta" : ""));
  if (event.shiftKey) {
    grouper.selectUntil(rowId);
  }
  else {
    grouper.toggleRow(rowId);
  }
}

// ===============
// Map of groupId -> Grouper object that the groupId is found in.
let grouperMap = {};
// Map of personRowId -> PersonRow object with that id
let personRowMap = {};
// Grouper objects to handle selection logic in each view.
let mergeGrouper;
let flatGrouper;
let sourceGrouper;
let comboGrouper;

// Global id used for MergeRow, MergeGroup and Grouper.
let nextPersonRowId = 0;
const ROW_SELECTION = 'selected';

const INCLUDE_NO_FACTS = "none";
const INCLUDE_VITAL_FACTS = "vital";
const INCLUDE_ALL_FACTS = "all";

class DisplayOptions {
  constructor() {
    // Option (INCLUDE_NO/VITAL/ALL_FACTS) for which facts to display.
    this.factsToInclude = INCLUDE_VITAL_FACTS;
    this.shouldShowChildren = false;
    // Flag for whether to include 'identity' (up to 24 hours after creation or 2012 + 2015 source attachments)
    // and also 'latest' (just before merge).
    this.shouldIncludeBeforeAfter = false;
    // Flag for whether to include facts and relatives that came in due to a merge
    // (false => only show info that was added to a note since the most recent merge)
    this.shouldRepeatInfoFromMerge = true;
    // Flag for whether to include facts and relatives added after the initial 'identity'.
    this.shouldShowAdditions = true;
    // Flag for whether to show which facts and relatives were deleted later.
    this.shouldShowDeletions = true;
    // Flag for whether to show "AttachedTo" column in sources view.
    this.shouldShowAttachedTo = false;
    // Flag for whether to do a vertical display
    this.vertical = false;
  }
}

let displayOptions = new DisplayOptions();

function getDisplayOptionsHtml() {
  return "<div id='settings'>\n" +
    "  <span id='vertical-option'><input type='checkbox' id='vertical-checkbox' onChange='handleOptionChange()'>Vertical" +
    "  <span class='vertical-divider'>|</span></span> " +
    "  <span id='repeat-info-option'><input type='checkbox' id='merge-info-checkbox' onChange='handleOptionChange()'>Repeat info from merge" +
    "  <span class='vertical-divider'>|</span></span> " +
    "  <form id='fact-level-radio' onChange='handleOptionChange()'>Facts: " +
    "    <input type='radio' name='fact-level' id='fact-" + INCLUDE_ALL_FACTS + "' value='" + INCLUDE_ALL_FACTS + "'>All</input>" +
    "    <input type='radio' name='fact-level' id='fact-" + INCLUDE_VITAL_FACTS + "' value='" + INCLUDE_VITAL_FACTS + "'>Vitals</input>" +
    "    <input type='radio' name='fact-level' id='fact-" + INCLUDE_NO_FACTS + "' value='" + INCLUDE_NO_FACTS + "'>None</input>" +
    "  </form> <span class='vertical-divider'>|</span> " +
    "  <input type='checkbox' id='children-checkbox' onChange='handleOptionChange()'>Show children" +
    "  <span class='vertical-divider'>|</span> " +
    "  <input type='checkbox' id='additions-checkbox' onChange='handleOptionChange()'>Show additions, " +
    "  <input type='checkbox' id='deletions-checkbox' onChange='handleOptionChange()'>Include deletions" +
    "</div>";
}

// Set the displayed options according to the global displayOptions variable's contents.
function initOptionsDisplay() {
  $("#vertical-checkbox").prop("checked", displayOptions.vertical);
  $("#merge-info-checkbox").prop("checked", displayOptions.shouldRepeatInfoFromMerge);
  $("#fact-" + displayOptions.factsToInclude).prop("checked", true);
  $("#children-checkbox").prop("checked", displayOptions.shouldShowChildren);
  $("#additions-checkbox").prop("checked", displayOptions.shouldShowAdditions);
  $("#deletions-checkbox").prop("checked", displayOptions.shouldShowDeletions);
  displayAvailableOptions();
}

function handleOptionChange() {
  displayOptions.factsToInclude = $("input[name = 'fact-level']:checked").val();
  displayOptions.shouldShowChildren = $("#children-checkbox").prop("checked");
  displayOptions.shouldRepeatInfoFromMerge = $("#merge-info-checkbox").prop("checked");
  displayOptions.shouldShowAdditions = $("#additions-checkbox").prop("checked");
  displayOptions.shouldShowDeletions = $("#deletions-checkbox").prop("checked");
  displayOptions.vertical = $("#vertical-checkbox").prop("checked");
  updatePersonFactsDisplay();
  updateIncludedColumns();
  updateTabsHtml();
  displayAvailableOptions();
}

function displayAvailableOptions() {
  let activeTab = getCurrentTab();
  setVisibility("settings", activeTab !== CHANGE_LOG_VIEW && activeTab !== SPLIT_VIEW);
  setVisibility("vertical-option", activeTab === FLAT_VIEW || activeTab === SOURCES_VIEW || activeTab === COMBO_VIEW || activeTab === HELP_VIEW);
  setVisibility("repeat-info-option", activeTab === MERGE_VIEW || activeTab === HELP_VIEW);
}

function setVisibility(elementId, isVisible) {
  let $element = $("#" + elementId);
  if (isVisible) {
    $element.show();
  }
  else {
    $element.hide();
  }
}

function updatePersonFactsDisplay() {
  for (let grouper of [mergeGrouper, flatGrouper, sourceGrouper, comboGrouper]) {
    for (let personRow of grouper.getAllRows()) {
      personRow.updatePersonDisplay();
    }
  }
}

function updateIncludedColumns() {
  for (let grouper of [mergeGrouper, flatGrouper, sourceGrouper, comboGrouper]) {
    grouper.usedColumns = findUsedColumns(grouper.getAllRows());
  }
}


class RowLocation {
  constructor(mergeRow, rowIndex, groupIndex) {
    this.mergeRow = mergeRow;
    this.rowIndex = rowIndex;
    this.groupIndex = groupIndex;
  }
}

class Grouper {
  constructor(mergeRows, usedColumns, maxDepth, tabId) {
    this.id = "grouper-" + nextPersonRowId++;
    this.tabId = tabId;
    this.mergeGroups = [new MergeGroup("Group 1", mergeRows, this)];
    this.usedColumns = usedColumns; // Set of COL_*
    this.maxDepth = maxDepth;
    this.prevSelectLocation = null;
    for (let mergeRow of mergeRows) {
      grouperMap[mergeRow.id] = this;
    }
    grouperMap[this.id] = this;
  }

  sort(columnName) {
    for (let mergeGroup of this.mergeGroups) {
      mergeGroup.sort(columnName);
    }
  }

  findGroup(groupId) {
    for (let mergeGroup of this.mergeGroups) {
      if (mergeGroup.groupId === groupId) {
        return mergeGroup;
      }
    }
    return null;
  }

  getAllRows() {
    let allRows = [];
    for (let group of this.mergeGroups) {
      allRows = allRows.concat(group.personRows);
    }
    return allRows;
  }

  findRow(rowId) {
    for (let groupIndex = 0; groupIndex < this.mergeGroups.length; groupIndex++) {
      let mergeRows = this.mergeGroups[groupIndex].personRows;
      for (let rowIndex = 0; rowIndex < mergeRows.length; rowIndex++) {
        let mergeRow = mergeRows[rowIndex];
        if (mergeRow.id === rowId) {
          return new RowLocation(mergeRow, rowIndex, groupIndex);
        }
      }
    }
    if (!rowLocation) {
      console.log("Could not find row with id " + rowId);
      return null;
    }
  }

  toggleRow(rowId) {
    let rowLocation = this.findRow(rowId);
    if (rowLocation) {
      rowLocation.mergeRow.toggleSelection();
      if (rowLocation.mergeRow.isSelected) {
        this.prevSelectLocation = rowLocation;
      }
    }
  }

  selectUntil(rowId) {
    let rowLocation = this.findRow(rowId);
    if (rowLocation) {
      let g = rowLocation.groupIndex;
      let r = rowLocation.rowIndex;
      if (this.prevSelectLocation) {
        if (this.prevSelectLocation.groupIndex < g) {
          r = 0;
        }
        else if (this.prevSelectLocation.groupIndex > g) {
          r = this.mergeGroups[g].personRows.length - 1;
        }
        else {
          r = this.prevSelectLocation.rowIndex;
        }
        let startRow = Math.min(r, rowLocation.rowIndex);
        let endRow = Math.max(r, rowLocation.rowIndex);
        for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
          let mergeRow = this.mergeGroups[g].personRows[rowIndex];
          mergeRow.select();
        }
      }
    }
  }

  deselectAll() {
    for (let group of this.mergeGroups) {
      for (let mergeRow of group.personRows) {
        mergeRow.deselect();
      }
    }
  }

  removeSelectedRows() {
    let selectedRows = [];
    for (let group of this.mergeGroups) {
      for (let r = 0; r < group.personRows.length; r++) {
        let mergeRow = group.personRows[r];
        if (mergeRow.isSelected) {
          mergeRow.deselect();
          selectedRows.push(mergeRow);
          group.personRows.splice(r, 1);
          r--;
        }
      }
    }
    return selectedRows;
  }

  deleteGroup(groupId) {
    for (let g = 0; g < this.mergeGroups.length; g++) {
      let mergeGroup = this.mergeGroups[g];
      if (mergeGroup.groupId === groupId && isEmpty(mergeGroup.personRows)) {
        this.mergeGroups.splice(g, 1);
      }
    }
  }
}

class MergeGroup {
  constructor(groupName, personRows, grouper) {
    this.groupId = "mg-" + nextPersonRowId++;
    this.groupName = groupName;
    this.personRows = personRows;
    grouperMap[this.groupId] = grouper;
  }

  sort(columnName) {
    let origOrder = 1;
    for (let personRow of this.personRows) {
      personRow.origOrder = origOrder++;
      personRow.setSortKey(columnName);
    }
    // Sort by sortKey, and then, if those are equal, by original order before the sort.
    // (Future: remember how we sorted last time, and reverse order if sorted by that again).
    this.personRows.sort(function(a, b){
      if (isEmpty(a.sortKey) && !isEmpty(b.sortKey)) {
        return 1;
      }
      if (isEmpty(b.sortKey) && !isEmpty(a.sortKey)) {
        return -1;
      }
      if (isEmpty(a.sortKey) && isEmpty(b.sortKey)) {
        return 0;
      }
      let diff = a.sortKey.localeCompare(b.sortKey);
      if (!diff) {
        diff = a.origOrder - b.origOrder;
      }
      return diff;
    });
  }
}

// Row of data for a person and their 1-hop relatives (record persona or Family Tree person--either original identity or result of a merge)
class PersonRow {
  constructor(mergeNode, personId, gedcomx, indent, maxIndent, isDupNode, grouper, sourceInfo, parentRow, ows) {
    this.id = "person-row-" + nextPersonRowId++;
    personRowMap[this.id] = this;
    grouperMap[this.id] = grouper;
    this.sortKey = "";
    this.person = findPersonInGx(gedcomx, personId);
    this.personId = personId;
    this.sourceInfo = sourceInfo;
    this.gedcomx = gedcomx;
    this.mergeNode = mergeNode;
    this.isSelected = false;
    this.origOrder = 0;
    this.note = "";
    this.updatePersonDisplay();

    this.indent = indent;
    this.maxIndent = maxIndent;
    this.isDupNode = isDupNode;
    // List of PersonRow for sources that were first attached to this person (or this version of the person, if a merge node)
    this.childSourceRows = [];
    // List of PersonRow for Ordinance Work Sets that were first attached to this person ID.
    this.childOwsRows = [];
    // Parent in merge hierarchy
    this.parentRow = parentRow;
    this.childRows = [];
    if (parentRow) {
      parentRow.childRows.push(this);
    }
    this.ows = ows;
  }

  updatePersonDisplay() {
    this.personDisplay = new PersonDisplay(this.person, "person");
    this.families = []; // Array of FamilyDisplay, one per spouse (and children with that spouse), and one more for any children with no spouse.
    this.fathers = []; // Array of PersonDisplay. Unknown-gender parents are also included here. (Note that parents are not paired up).
    this.mothers = []; // Array of PersonDisplay
    // Map of personId -> PersonDisplay for mothers and fathers.
    let fatherMap = new Map();
    let motherMap = new Map();
    // Map of spouseId -> FamilyDisplay for that spouse and children with that spouse.
    // Also, NO_SPOUSE -> FamilyDisplay for list of children with no spouse.
    this.familyMap = new Map();
    let includePersonId = !this.sourceInfo;
    this.handleCoupleAndTernaryRelationships(this.gedcomx, this.personId, fatherMap, motherMap, this.familyMap, includePersonId);
    this.handleParentChildRelationships(this.gedcomx, this.personId, fatherMap, motherMap, this.familyMap, includePersonId);
    this.sortFamilies();
  }

  sortFamilies() {
    // Sort families by marriage date, and sort children within each family by child's birth date, or by original order when no date.
    for (let family of this.families) {
      family.sortChildren();
    }
  }

  setSortKey(columnName) {
    let sortKey = null;

    function getFirstFactDate(factHolder) {
      if (factHolder && factHolder.facts) {
        for (let fact of factHolder.facts) {
          if (fact.date && fact.date.original) {
            let dayNumber = parseDateIntoNumber(fact.date.original);
            return dayNumber ? dayNumber.toString() : "";
          }
        }
      }
      return "";
    }

    function getPlaceSortKey(place) {
      if (place) {
        let parts = place.split(",");
        let newParts = [];
        for (let i = parts.length - 1; i >= 0; i--) {
          if (!parts[i].includes("United States")) {
            newParts.push(parts[i].trim());
          }
        }
        return newParts.join(", ");
      }
      return "";
    }

    function getFirstFactPlace(factHolder) {
      if (factHolder && factHolder.facts) {
        for (let fact of factHolder.facts) {
          if (fact.place && fact.place.original) {
            return getPlaceSortKey(fact.place.original);
          }
        }
      }
      return "";
    }

    function getFirstRelativeName(relatives) {
      return isEmpty(relatives) ? "" : relatives[0].name;
    }

    function getFirstSpouseName(families) {
      for (let family of families) {
        if (family.spouse) {
          let name = getPersonName(family.spouse.person);
          if (name !== "<no name>") {
            return name;
          }
        }
      }
      return "";
    }

    function getFirstSpouseFactDate(families) {
      for (let family of families) {
        if (family.spouse) {
          let date = getFirstFactDate(family.spouse.person);
          if (date) {
            return date;
          }
        }
      }
      return "";
    }

    function getFirstSpouseFactPlace(families) {
      for (let family of families) {
        if (family.spouse) {
          let place = getFirstFactPlace(family.spouse.person);
          if (place) {
            return place;
          }
        }
      }
      return "";
    }

    function getFirstChildName(families) {
      for (let family of families) {
        if (!isEmpty(family.children)) {
          return family.children[0].name;
        }
      }
      return "";
    }

    function getFirstChildFactDate(families) {
      for (let family of families) {
        for (let child of family.children) {
          let date = getFirstFactDate(child.person);
          if (date) {
            return date;
          }
        }
      }
      return "";
    }

    function getFirstChildFactPlace(families) {
      for (let family of families) {
        for (let child of family.children) {
          let place = getFirstFactPlace(child.person);
          if (place) {
            return place;
          }
        }
      }
      return "";
    }

    // Zero-pad a single-digit version number like XXXX-MMM (v3) => XXXX-MMM (v03)
    // so that it will sort properly when there are more than 9 versions of a person ID.
    function padV(versionedPersonId) {
      return versionedPersonId.replaceAll(/\(v(\d)\)/g, "(v0$1)");
    }
    // Get a sort key to use for sorting by person ID. In Flat view, this is just the personId.
    // But in source view, it's the person ID for FT person rows; or for source rows, it's
    //    the sourceInfo.attachedToPersonId + "_" + sourceInfo.recordDateSortKey;
    function personIdAndRecordDate(personId, sourceInfo, ows) {
      let recordDateSortKey = getRecordDateSortKey(sourceInfo, ows);
      let sortPersonId = sourceInfo && sourceInfo.attachedToPersonId ? sourceInfo.attachedToPersonId : personId;
      return sortPersonId + (isEmpty(recordDateSortKey) ? "" : "_" + recordDateSortKey);
    }

    function getRecordDateSortKey(sourceInfo, ows) {
      if (sourceInfo && sourceInfo.recordDateSortKey) {
        return "rec_" + sourceInfo.recordDateSortKey;
      }
      if (ows) {
        if (ows.ordinances.length > 0) {
          return "ord_" + ows.ordinances[0].ordinanceSortKey;
        }
        return "ord_?";
      }
      return "";
    }

    switch (columnName) {
      case COLUMN_COLLECTION:
        sortKey = this.sourceInfo ? this.sourceInfo.collectionName : "";
        break;
      case COLUMN_PERSON_ID:          sortKey = personIdAndRecordDate(this.personId, this.sourceInfo, this.ows); break;
      case COLUMN_ATTACHED_TO_IDS:    sortKey = padV(this.sourceInfo.attachedToPersonId);                        break;
      case COLUMN_CREATED:            sortKey = String(this.mergeNode.firstEntry.updated).padStart(15, "0");     break;
      case COLUMN_RECORD_DATE:        sortKey = getRecordDateSortKey(this.sourceInfo, this.ows);                 break;
      case COLUMN_PERSON_NAME:        sortKey = getPersonName(this.person);             break;
      case COLUMN_PERSON_FACTS:       sortKey = getFirstFactDate(this.person);          break;
      case COLUMN_PERSON_FACTS_PLACE: sortKey = getFirstFactPlace(this.person);         break;
      case COLUMN_FATHER_NAME:        sortKey = getFirstRelativeName(this.fathers);     break;
      case COLUMN_MOTHER_NAME:        sortKey = getFirstRelativeName(this.mothers);     break;
      case COLUMN_SPOUSE_NAME:        sortKey = getFirstSpouseName(this.families);      break;
      case COLUMN_SPOUSE_FACTS:       sortKey = getFirstSpouseFactDate(this.families);  break;
      case COLUMN_SPOUSE_FACTS_PLACE: sortKey = getFirstSpouseFactPlace(this.families); break;
      case COLUMN_CHILD_NAME:         sortKey = getFirstChildName(this.families);       break;
      case COLUMN_CHILD_FACTS:        sortKey = getFirstChildFactDate(this.families);   break;
      case COLUMN_CHILD_FACTS_PLACE:  sortKey = getFirstChildFactPlace(this.families);  break;
      case COLUMN_NOTES:              sortKey = this.note;                              break;
    }
    this.sortKey = sortKey;
  }

  handleParentChildRelationships(gedcomx, personId, fatherMap, motherMap, familyMap, includePersonId) {
    // Map of childId to array of {parentId, parentChildRelationship}
    let childParentsMap = this.buildChildParentsMap(gedcomx);

    for (let [childId, parentIds, status] of childParentsMap) {
      if (childId === personId) {
        for (let parentIdAndRel of parentIds) {
          let parentId = parentIdAndRel.parentId;
          let parent = findPersonInGx(gedcomx, parentId);
          let gender = getGender(parent);
          let parentMap = gender === "Female" ? motherMap : fatherMap;
          if (!parentMap.has(parentId)) {
            addParentToMap(parentMap, gedcomx, parentId, gender === "Female" ? this.mothers : this.fathers, includePersonId, status);
          }
        }
      } else {
        // ParentChild relationship from the main person to this childId
        let childRelOfPerson = this.getChildRelOfPerson(parentIds, personId);
        let foundOtherParent = false;
        if (childRelOfPerson) {
          for (let parentIdAndRel of parentIds) {
            let parentId = parentIdAndRel.parentId;
            if (parentId !== personId) {
              let familyDisplay = familyMap.get(parentId);
              if (familyDisplay) {
                // This child is a child of a spouse of the main person, so add it to that couple's family
                familyDisplay.children.push(new PersonDisplay(findPersonInGx(gedcomx, childId), "child", status,null, includePersonId)); // future: add lineage facts somehow.
                foundOtherParent = true;
              }
            }
          }
          if (!foundOtherParent) {
            let familyDisplay = familyMap.get(NO_SPOUSE);
            if (!familyDisplay) {
              familyDisplay = new FamilyDisplay(null);
              familyMap.set(NO_SPOUSE, familyDisplay);
              this.families.push(familyDisplay);
            }
            familyDisplay.children.push(new PersonDisplay(findPersonInGx(gedcomx, childId), "child", status,null, includePersonId)); // future: add lineage facts somehow.
          }
        }
      }
    }
  }

  handleCoupleAndTernaryRelationships(gedcomx, personId, fatherMap, motherMap, familyMap, includePersonId) {
    console.log("Handing relationships...");
    for (let relationship of getList(gedcomx, "relationships").concat(getList(gedcomx, CHILD_REL))) {
      if (!shouldDisplayStatus(relationship.status)) {
        continue;
      }
      let isChildRel = isChildRelationship(relationship);
      let spouseId = getSpouseId(relationship, personId);
      if (spouseId === NO_SPOUSE) {
        if (personId === getRelativeId(relationship, "child")) {
          addParentToMap(fatherMap, gedcomx, getRelativeId(relationship, "parent1"), this.fathers, includePersonId, relationship.status);
          addParentToMap(motherMap, gedcomx, getRelativeId(relationship, "parent2"), this.mothers, includePersonId, relationship.status);
        }
      } else {
        if (!spouseId && isChildRel) {
          spouseId = "<none>";
        }
        let familyDisplay = familyMap.get(spouseId);
        if (!familyDisplay) {
          let spouseDisplay = spouseId === "<none>" ? null : new PersonDisplay(findPersonInGx(gedcomx, spouseId), "spouse", relationship.status, relationship, includePersonId);
          familyDisplay = new FamilyDisplay(spouseDisplay);
          familyMap.set(spouseId, familyDisplay);
          this.families.push(familyDisplay);
        }
        if (isChildRel) {
          let childId = getRelativeId(relationship, "child");
          familyDisplay.children.push(new PersonDisplay(findPersonInGx(gedcomx, childId), "child", relationship.status,null, includePersonId)); // future: add lineage facts somehow.
        }
      }
    }
  }

  getChildRelOfPerson(parentIds, personId) {
    let childRelOfPerson = null;
    for (let parentIdAndRel of parentIds) {
      if (parentIdAndRel.parentId === personId) {
        childRelOfPerson = parentIdAndRel;
      }
    }
    return childRelOfPerson;
  }

  buildChildParentsMap(gedcomx) {
    let childParentsMap = new Map();
    for (let relationship of getList(gedcomx, "relationships")) {
      if (!shouldDisplayStatus(relationship.status)) {
        continue;
      }
      if (relationship.type === PARENT_CHILD_REL) {
        let parentId = getRelativeId(relationship, "person1");
        let childId = getRelativeId(relationship, "person2");
        let parentIdAndRel = {
          parentId: parentId,
          parentChildRelationship: relationship,
          status: relationship.status
        };
        let parentIds = childParentsMap.get(childId);
        if (parentIds) {
          parentIds.push(parentIdAndRel);
        } else {
          childParentsMap.set(childId, [parentIdAndRel]);
        }
      }
    }
    return childParentsMap;
  }

  getNumChildrenRows() {
    let numChildrenRows = 0;
    for (let family of this.families) {
      if (family.children.length > 0 && displayOptions.shouldShowChildren) {
        numChildrenRows += family.children.length;
      }
      else {
        numChildrenRows += 1;
      }
    }
    return numChildrenRows === 0 ? 1 : numChildrenRows;
  }

  combineParents(parents) {
    let parentsList = [];
    if (parents) {
      for (let parent of parents) {
        parentsList.push(parent.name);
      }
    }
    return parentsList.join("<br>");
  }

  getRowPersonCells(gedcomx, personId, rowClass, usedColumns, bottomClass, allRowsClass) {
    function addColumn(key, rowspan, content, extraClass) {
      if (usedColumns.has(key)) {
        html += "<td class='" + rowClass + extraClass + "'" + rowspan + ">" + (content ? content : "") + "</td>";
      }
    }

    // htmlHolder is an array of 0 or 1 HTML strings. If not empty, and we're adding a new row, add this just before closing the row.
    function startNewRowIfNotFirst(isFirst, rowClass, htmlHolder) {
      if (!isFirst) {
        if (htmlHolder.length > 0) {
          html += htmlHolder.pop();
        }
        html += "</tr>\n<tr" + (rowClass ? " class='" + rowClass + "' onclick='handleRowClick(event, \"" + rowClass + "\")'" : "") + ">";
      }
      return false;
    }

    let rowspan = getRowspanParameter(this.getNumChildrenRows());
    let html = "<td class='" + rowClass + bottomClass + "'" + rowspan + ">" + this.personDisplay.name + "</td>\n";
    addColumn("person-facts", rowspan, this.personDisplay.facts, bottomClass);
    addColumn("father-name", rowspan, this.combineParents(this.fathers), bottomClass);
    addColumn("mother-name", rowspan, this.combineParents(this.mothers), bottomClass);
    let isFirstSpouse = true;
    let noteCellHtmlHolder = this.getNoteCellHtml(rowClass, bottomClass, rowspan);

    if (this.families.length > 0) {
      for (let spouseIndex = 0; spouseIndex < this.families.length; spouseIndex++) {
        let spouseFamily = this.families[spouseIndex];
        isFirstSpouse = startNewRowIfNotFirst(isFirstSpouse, allRowsClass, noteCellHtmlHolder);
        let familyBottomClass = spouseIndex === this.families.length - 1 ? bottomClass : "";
        let childrenRowSpan = getRowspanParameter(displayOptions.shouldShowChildren ? spouseFamily.children.length : 1);
        addColumn("spouse-name", childrenRowSpan, spouseFamily.spouse ? spouseFamily.spouse.name : "", familyBottomClass);
        addColumn("spouse-facts", childrenRowSpan, spouseFamily.spouse ? spouseFamily.spouse.facts : "", familyBottomClass);
        if (spouseFamily.children.length > 0 && displayOptions.shouldShowChildren) {
          let isFirstChild = true;
          for (let childIndex = 0; childIndex < spouseFamily.children.length; childIndex++) {
            let child = spouseFamily.children[childIndex];
            isFirstChild = startNewRowIfNotFirst(isFirstChild, allRowsClass, noteCellHtmlHolder);
            let childBottomClass = childIndex === spouseFamily.children.length - 1 ? familyBottomClass : "";
            addColumn(COLUMN_CHILD_NAME, "", child.name, childBottomClass);
            addColumn(COLUMN_CHILD_FACTS, "", child.facts, childBottomClass);
          }
        } else {
          addColumn(COLUMN_CHILD_NAME, "", "", familyBottomClass);
          addColumn(COLUMN_CHILD_FACTS, "", "", familyBottomClass);
        }
      }
    }
    else {
      addColumn(COLUMN_SPOUSE_NAME, "", "", bottomClass);
      addColumn(COLUMN_SPOUSE_FACTS, "", "", bottomClass);
      addColumn(COLUMN_CHILD_NAME, "", "", bottomClass);
      addColumn(COLUMN_CHILD_FACTS, "", "", bottomClass);
    }
    if (noteCellHtmlHolder.length > 0) {
      html += noteCellHtmlHolder.pop();
    }
    return html;
  }

  getNoteCellHtml(rowClass, bottomClass, rowspan) {
    let noteId = this.id + "-note";
    return ["<td class='note " + rowClass + bottomClass + "' onclick='doNotSelect(event)' contenteditable='true'" + rowspan
    + " id='" + noteId + "' onkeyup='updateNote(\"" + this.id + "\", \"" + noteId + "\")'>"
    + encode(this.note) + "</td>"];
  }

  toggleSelection() {
    if (this.isSelected) {
      this.deselect();
    }
    else {
      this.select();
    }
  }

  select() {
    if (!this.isSelected) {
      $("." + this.id).addClass(ROW_SELECTION);
      $("." + this.getIdClass().trim()).addClass(ROW_SELECTION);
      this.isSelected = true;
      for (let childRow of this.childRows) {
        childRow.select();
      }
    }
  }

  deselect() {
    if (this.isSelected) {
      $("." + this.id).removeClass(ROW_SELECTION);
      $("." + this.getIdClass()).removeClass(ROW_SELECTION);
      this.isSelected = false;
      for (let childRow of this.childRows) {
        childRow.deselect();
      }
    }
  }

  isSourceRow() {
    return this.sourceInfo;
  }

  isOwsRow() {
    return this.ows;
  }

  getIdClass() {
    return "cell-" + this.id;
  }

  getCellClass() {
    return (this.isSourceRow() ? "source-row" : (this.isOwsRow() ? "ord-row" : "merge-id")) + " " + this.getIdClass();
  }

  getCollectionHtml(rowSpan, clickInfo) {
    let html = "<td class='" + this.getCellClass() + " main-row'" + (rowSpan ? rowSpan : "") + (clickInfo ? clickInfo : "") + ">";
    if (this.sourceInfo) {
      if (this.sourceInfo.personaArk) {
        html += "<a href='" + this.sourceInfo.personaArk + "' target='_blank'>" + encode(this.sourceInfo.collectionName) + "</a>";
      }
      else {
        html += encode(this.sourceInfo.collectionName);
      }
    }
    else if (this.ows) {
      html += this.ows.getOrdinancesHtml();
    }
    return html + "</td>";
  }

  getRecordDateHtml(rowSpan, clickInfo) {
    let recordDate = null;
    if (this.sourceInfo) {
      recordDate = this.sourceInfo.recordDate;
    }
    else if (this.ows) {
      recordDate = this.ows.createDate.replaceAll(/ *\d\d:.*/g, "");
    }
    return "<td class='" + this.getCellClass() + " main-row date rt'" + (rowSpan ? rowSpan : "")
      + (clickInfo ? clickInfo : "") + ">" + (recordDate ? encode(recordDate) : "") + "</td>";
  }

  getPersonIdHtml(shouldIncludeVersion) {
    if (this.isSourceRow() || this.isOwsRow()) {
      let personId = this.isSourceRow() ? this.sourceInfo.attachedToPersonId : this.ows.originalPersonId;
      return personId ? "<span class='relative-id'>" + encode("(" + personId + ")") + "</span>" : "";
    }
    else {
      let personIdHtml = encode(this.personId + (shouldIncludeVersion && this.mergeNode && this.mergeNode.version > 1 ? " (v" + this.mergeNode.version + ")" : ""));
      if (this.personId === mainPersonId) {
        return "<b>" + personIdHtml + "</b>";
      }
      return personIdHtml;
    }
  }

  // get HTML for this person row
  getHtml(usedColumns, tabId) {
    function getIndentationHtml(indentCodes) {
      let indentHtml = "";
      for (let indentCode of indentCodes) {
        if (indentCode === "O") {
          indentHtml += "<td" + rowSpan + ">&nbsp;</td>";
        } else {
          let upperClass;
          let lowerClass;
          switch (indentCode) {
            case "O":
              upperClass = 'con-O';
              lowerClass = 'con-O';
              break;
            case "I":
              upperClass = 'con-I';
              lowerClass = 'con-I';
              break;
            case "T":
              upperClass = 'con-L';
              lowerClass = 'con-I';
              break;
            case "L":
              upperClass = 'con-L';
              lowerClass = 'con-O';
              break;
            default:
              console.log("Error: Unrecognized indent code '" + indentCode + "'");
          }
          indentHtml += "<td class='con-holder' " + rowSpan + "><table class='connector-table'>" +
            "<tr><td class='con-O' rowspan='2'>&nbsp;</td><td class='" + upperClass + "'>&nbsp;</td></tr>" +
            "<tr><td class='" + lowerClass + "'>&nbsp;</td></tr></table></td>";
        }
      }
      return indentHtml;
    }

    let rowSpan = getRowspanParameter(this.getNumChildrenRows());
    let html = "<tr class='" + this.id + "' onclick='handleRowClick(event, \"" + this.id + "\")'>";
    let shouldIndent = tabId === MERGE_VIEW;
    let colspan = shouldIndent ? " colspan='" + (1 + this.maxIndent - this.indent.length) + "'" : "";
    let bottomClass = " main-row";
    let specialIdClass = this.isSourceRow() ? "source-row" : (this.isOwsRow() ? "ord-row" : null);
    let rowClasses = "class='"
      + (specialIdClass ? specialIdClass : "merge-id" + (shouldIndent && this.isDupNode ? "-dup" : ""))
      + bottomClass + "'";

    if (shouldIndent) {
      // Merge view: indentation and person id that spans columns as needed.
      html += getIndentationHtml(this.indent.split(""));
      html += "<td " + rowClasses + rowSpan + colspan + ">" + this.getPersonIdHtml(true) + "</td>";
    }
    else {
      if (tabId === SOURCES_VIEW || tabId === COMBO_VIEW) {
        // Collection name and record date
        html += this.getCollectionHtml(rowSpan);
        html += this.getRecordDateHtml(rowSpan);
      }
      if (tabId !== SOURCES_VIEW) {
        // Person ID
        html += "<td " + rowClasses + rowSpan + colspan + "'>" + this.getPersonIdHtml(shouldIndent) + "</td>";
      }
    }
    if (tabId === MERGE_VIEW || tabId === FLAT_VIEW) {
      // Created date
      html += this.getTimestampHtml(rowClasses, rowSpan);
    }

    // Person info
    let rowClass = this.mergeNode && !this.mergeNode.isLeafNode() ? 'merge-node' : 'identity-gx';
    html += this.getRowPersonCells(this.gedcomx, this.personId, rowClass, usedColumns, bottomClass, this.id);
    html += "</tr>\n";
    return html;
  }

  getTimestampHtml(rowClasses, rowSpan, clickInfo) {
    return "<td " + (rowClasses ? rowClasses : this.getCellClass()) + (rowSpan ? rowSpan : "") +
      (clickInfo ? clickInfo : "") + ">" + formatTimestamp(this.mergeNode.firstEntry.updated) + "</td>";
  }

// Add a source persona PersonRow as a "child" of a FT person row.
  addSourceChild(personaRow) {
    this.childSourceRows.push(personaRow);
  }
  addOwsChild(owsPersonRow) {
    this.childOwsRows.push(owsPersonRow);
  }
}

function doNotSelect(event) {
  event.stopPropagation();
}

function addParentToMap(parentIdDisplayMap, gedcomx, parentId, parentList, includePersonId, relativeStatus) {
  if (parentId && !parentIdDisplayMap.get(parentId)) {
    let parentDisplay = new PersonDisplay(findPersonInGx(gedcomx, parentId), "parent", relativeStatus, null, includePersonId);
    parentIdDisplayMap.set(parentId, parentDisplay);
    parentList.push(parentDisplay);
  }
}

function getRowspanParameter(numRows) {
  return numRows > 1 ? " rowspan='" + numRows + "'" : "";
}

// Go through all the change log entries, from earliest (at the end) to the most recent (at index [0]).
// Update the GedcomX for each personId with each entry.
// When a merge entry is found, merge the two MergeNodes into a new MergeNode (same person ID, but incremented 'version')
// Return the one remaining MergeNode at the end.
function getRootMergeNode(allEntries) {
  let personNodeMap = new Map();
  let latestMergeNode = null;

  for (let i = allEntries.length - 1; i >= 0; i--) {
    let entry = allEntries[i];
    if (extractType(getProperty(entry.changeInfo[0], "objectType")) === "NotAMatch") {
      // Skip "NotAMatch" entries because they get added onto both people, even if one is already merged/tombstoned.
      continue;
    }
    let personId = entry.personId;
    let mergeNode = computeIfAbsent(personNodeMap, personId, () => new MergeNode(personId));
    // When a merge happens, the 'duplicate' gets relationships removed and then a person delete in its change log.
    // But we want to display the person as they were just before the merge, so we will ignore those changes.
    if (isMergeEntry(entry)) {
      let duplicateMergeNode = personNodeMap.get(entry.mergeDuplicateId);
      personNodeMap.delete(entry.mergeDuplicateId);
      mergeNode = mergeNode.merge(duplicateMergeNode);
      personNodeMap.set(personId, mergeNode);
    }
    mergeNode.update(entry);
    latestMergeNode = mergeNode;
  }
  console.assert(Object.keys(personNodeMap).length === 1, "Expected 1 key in personNodeMap, but got " + Object.keys(personNodeMap).length);
  return latestMergeNode;
}

function findMaxDepth(mergeNode) {
  if (mergeNode.isLeafNode()) {
    return 1;
  }
  else {
    return 1 + Math.max(findMaxDepth(mergeNode.prevNode), findMaxDepth(mergeNode.dupNode));
  }
}

// ==================================================
// ===== Merge Hierarchy HTML =======================
/**
 * Build MergeRow array, representing the HTML table rows for each MergeNode in the hierarchy.
 * Indentation strings use the following codes to decide what connector to include at each indentation position:
 *   O=none, I = vertical, L = L-connector, T = vertical line with horizontal connector
 * @param mergeNode - MergeNode to use for building a row
 * @param indent - String indicating what kind of connector to put at each indentation position.
 *
 * @param maxIndent - maximum number of indentations for any merge node
 * @param isDupNode - Flag for whether this is a "duplicate" node (as opposed to the survivor of a merge)
 * @param mergeRows - Array of MergeRows to add to
 * @param shouldIncludeMergeNodes - Flag for whether to include non-leaf-nodes in the resulting array.
 * @param personSourcesMap - Map of personId -> list of sourceInfo objects first attached to that person Id (or null if not included)
 * @param parentRow - Parent PersonRow (from a higher merge history node).
 * @param personOrdinanceMap - Map of personId -> list of OrdinanceWorkSets for that person. null => ignore
 * @returns Array of MergeRow entries (i.e., the array mergeRows)
 */
function buildMergeRows(mergeNode, indent, maxIndent, isDupNode, mergeRows, shouldIncludeMergeNodes, personSourcesMap, parentRow, personOrdinanceMap) {
  this.indent = indent;
  let mergeRow = null;
  if (shouldIncludeMergeNodes || mergeNode.isLeafNode()) {
    mergeRow = new PersonRow(mergeNode, mergeNode.personId, mergeNode.gedcomx, indent, maxIndent, isDupNode, null, null, parentRow);
    mergeRows.push(mergeRow);
    if (personSourcesMap) {
      for (let sourceInfo of getList(personSourcesMap, mergeNode.personId)) {
        if (!sourceInfo.personaArk) {
          continue;
        }
        let shortPersonaArk = shortenPersonArk(sourceInfo.personaArk);
        if (!shortPersonaArk.includes(":")) {
          continue; // unexpected format.
        }
        let persona = findPersonInGx(sourceInfo.gedcomx, shortPersonaArk);
        let personaId = persona.id;
        let personaRow = new PersonRow(null, personaId, sourceInfo.gedcomx, 0, 0, false, null, sourceInfo, null);
        mergeRows.push(personaRow);
        mergeRow.addSourceChild(personaRow)
      }
    }
    if (personOrdinanceMap) {
      let owsList = personOrdinanceMap.get(mergeNode.personId);
      if (owsList) {
        for (let ows of owsList) {
          let owsPersonRow = new PersonRow(null, ows.principalPersonId, ows.gedcomx, 0, 0, false, null, null, null, ows);
          mergeRows.push(owsPersonRow);
          mergeRow.addOwsChild(owsPersonRow);
        }
      }
    }
  }
  if (!mergeNode.isLeafNode()) {
    let indentPrefix = indent.length > 0 ? (indent.substring(0, indent.length - 1) + (isDupNode ? "I" : "O")) : "";
    buildMergeRows(mergeNode.dupNode, indentPrefix + "T", maxIndent, true, mergeRows, shouldIncludeMergeNodes, personSourcesMap, mergeRow, personOrdinanceMap);
    buildMergeRows(mergeNode.prevNode, indentPrefix + "L", maxIndent, false, mergeRows, shouldIncludeMergeNodes, personSourcesMap, mergeRow, personOrdinanceMap);
  }
  return mergeRows;
}

// Get a set of columns that are needed for display in the table, as a set of Strings like "person/father/mother/spouse/child-name/facts"
function findUsedColumns(personRows) {
  let usedColumns = new Set();

  function checkColumns(personDisplay, who) {
    if (personDisplay) {
      if (personDisplay.name) {
        usedColumns.add(who + "-name");
      }
      if (personDisplay.facts) {
        usedColumns.add(who + "-facts");
      }
    }
  }

  for (let personRow of personRows) {
    checkColumns(personRow.personDisplay, "person");
    for (let family of personRow.families) {
      checkColumns(family.spouse, "spouse");
      if (displayOptions.shouldShowChildren) {
        for (let child of getList(family, "children")) {
          checkColumns(child, "child");
        }
      }
    }
    for (let father of personRow.fathers) {
      checkColumns(father, "father");
    }
    for (let mother of personRow.mothers) {
      checkColumns(mother, "mother");
    }
  }
  return usedColumns;
}

// Function called when the "add group" button is clicked in the Flat view.
// If any rows are selected, they are moved to the new group.
// If this is only the second group, then the first group begins displaying its header.
function addGroup(grouperId) {
  let grouper = grouperMap[grouperId];
  let mergeRows = grouper.removeSelectedRows();
  let mergeGroup = new MergeGroup("Group " + (grouper.mergeGroups.length + 1), mergeRows, grouper);
  grouper.mergeGroups.push(mergeGroup);
  updateFlatViewHtml(grouper);
}

function addSelectedToGroup(groupId) {
  let grouper = grouperMap[groupId];
  let mergeGroup = grouper.findGroup(groupId);
  if (mergeGroup) {
    let selectedRows = grouper.removeSelectedRows();
    mergeGroup.personRows.push(...selectedRows);
    updateFlatViewHtml(grouper);
  }
}

function updateTabsHtml() {
  updateMergeHierarchyHtml();
  updateFlatViewHtml(flatGrouper);
  updateFlatViewHtml(sourceGrouper);
  updateFlatViewHtml(comboGrouper);
  updateSplitViewHtml();
}

function updateFlatViewHtml(grouper) {
  $("#" + grouper.tabId).html(getGrouperHtml(grouper));
  highlightSelectedRows(grouper);
  makeTableHeadersDraggable();
}

function highlightSelectedRows(grouper) {
  for (let group of grouper.mergeGroups) {
    for (let personRow of group.personRows) {
      if (personRow.isSelected) {
        $("." + personRow.id).addClass(ROW_SELECTION);
        $("." + personRow.getIdClass()).addClass(ROW_SELECTION);
      }
    }
  }
}

function getFlatViewHtml(entries) {
  let rootMergeNode = getRootMergeNode(entries);
  let maxDepth = findMaxDepth(rootMergeNode);
  let mergeRows = buildMergeRows(rootMergeNode, "", maxDepth - 1, false, [], false);
  let usedColumns = findUsedColumns(mergeRows);

  flatGrouper = new Grouper(mergeRows, usedColumns, maxDepth, FLAT_VIEW);
  return getGrouperHtml(flatGrouper);
}

// Get an array of PersonRow, one per unique persona Ark (and its record) found in sourceMap.
function buildPersonaRows() {
  let personaIds = new Set();
  let personaRows = [];

  for (let sourceInfo of Object.values(sourceMap)) {
    if (sourceInfo.personaArk && sourceInfo.gedcomx) {
      let personaId = findPersonInGx(sourceInfo.gedcomx, shortenPersonArk(sourceInfo.personaArk)).id;
      if (!personaIds.has(personaId)) {
        personaRows.push(new PersonRow(null, personaId, sourceInfo.gedcomx, 0, 0, false, null, sourceInfo));
        personaIds.add(personaId);
      }
    }
  }
  return personaRows;
}

function getSourcesViewHtml() {
  let personaRows = buildPersonaRows();
  let usedColumns = findUsedColumns(personaRows);
  sourceGrouper = new Grouper(personaRows, usedColumns, 0, SOURCES_VIEW);
  sourceGrouper.sort("record-date");
  return getGrouperHtml(sourceGrouper, true);
}

// Build a view with a flat list of persons + the sources attached to each one first.
function getComboViewHtml() {
  let rootMergeNode = getRootMergeNode(allEntries);
  let maxDepth = findMaxDepth(rootMergeNode);
  let personSourcesMap = buildPersonSourcesMap(allEntries);
  let personAndPersonaRows = buildMergeRows(rootMergeNode, "", maxDepth - 1, false, [], false, personSourcesMap, null, personOrdinanceMap);
  let usedColumns = findUsedColumns(personAndPersonaRows);
  comboGrouper = new Grouper(personAndPersonaRows, usedColumns, maxDepth, COMBO_VIEW);
  comboGrouper.sort(COLUMN_PERSON_ID);
  return getGrouperHtml(comboGrouper);
}

// Build a map of FT personID -> list of SourceInfo objects for sources that were first attached to that person ID.
function buildPersonSourcesMap(entries) {
  // Set of sourceInfo.sourceId that have already been added to personSourceMap
  //   i.e., we already found the earliest person ID that this source was attached to.
  let alreadyUsedSourceIds = new Set();
  // Map of FT personId -> list of SourceInfo that were first attached to that ID
  let personSourcesMap = new Map();
  for (let i = entries.length - 1; i >=0; i--) {
    let entry = entries[i];
    let changeInfo = entry.changeInfo[0];
    // Create/Update/Delete/Merge
    let operation = extractType(getProperty(changeInfo, "operation"));
    let objectType = extractType(getProperty(changeInfo, "objectType"));
    let objectModifier = extractType(getProperty(changeInfo, "objectModifier"));
    if (objectModifier === "Person" && operation === "Create" && objectType === "SourceReference") {
      let resultingId = getProperty(changeInfo, "resulting.resourceId");
      let entryPerson = findPersonByLocalId(entry, resultingId);
      let sourceReference = getFirst(getList(entryPerson, "sources")); //i.e., entryPerson.sources[0], but with null-checking
      let sourceInfo = sourceMap[sourceReference.description];
      if (!alreadyUsedSourceIds.has(sourceInfo.sourceId)) {
        alreadyUsedSourceIds.add(sourceInfo.sourceId);
        let personSourcesList = computeIfAbsent(personSourcesMap, entry.personId, () => []);
        personSourcesList.push(sourceInfo);
        sourceInfo.attachedToPersonId = entry.personId;
      }
    }
  }
  return personSourcesMap;
}
//====== Split ========

// Use the selected PersonRows in the merge hierarchy view to select
function splitOnSelectedMergeRows() {
  let unselectedMergeRows = getRowsBySelection(mergeGrouper.mergeGroups[0].personRows, false);
  let selectedMergeRows = getRowsBySelection(mergeGrouper.mergeGroups[0].personRows, true);
  splitOnInfoInGroup(MERGE_VIEW, unselectedMergeRows, selectedMergeRows);
  updateSplitViewHtml();
  $("#tabs").tabs("option", "active", viewList.indexOf(SPLIT_VIEW));
}

// Use the PersonRows in the given group to decide which Elements to move to each side in the Split view.
// (aka "applyToSplit")
function splitOnGroup(groupId) {
  let grouper = grouperMap[groupId];
  let mergeGroup = grouper.findGroup(groupId);
  if (grouper.tabId === FLAT_VIEW || grouper.tabId === SOURCES_VIEW || grouper.tabId === COMBO_VIEW) {
    let splitRows = mergeGroup.personRows;
    let otherRows = getOtherPersonRows(grouper, mergeGroup);
    splitOnInfoInGroup(grouper.tabId, otherRows, splitRows);
    updateSplitViewHtml();
    $("#tabs").tabs("option", "active", viewList.indexOf(SPLIT_VIEW));
  }
}

// sourceGrouper - Grouper for the source view
// sourceGroup - The group of sources being applied to infer how to split the person.
function splitOnInfoInGroup(tabId, keepRows, splitRows) {
  // Tell whether the given entity's status should cause it to be included in a list for a merge hierarchy row.
  //   Include if there is no status, but not if the status is 'deleted' or any of the merge statuses.
  function shouldIncludeStatus(entity) {
    return tabId !== MERGE_VIEW || !entity.status || (entity.status !== DELETED_STATUS && !entity.status.startsWith("merge-"));
  }
  function addRelativeArksToSet(gedcomx, relativeId, relativeArkSet) {
    if (relativeId && relativeId !== NO_SPOUSE) {
      let relativeArk = getPersonId(findPersonInGx(gedcomx, relativeId));
      if (relativeArk) {
        relativeArkSet.add(relativeArk);
      }
    }
  }
  function gatherSourcesFromGroup(personRows, sourceIdSet) {
    for (let personRow of personRows) {
      if (tabId === FLAT_VIEW || tabId === MERGE_VIEW) {
        // No source rows, so move attachments over (unless the attachments are on a merge node and are only there because of the merge)
        let person = findPersonInGx(personRow.gedcomx, personRow.personId);
        for (let sourceReference of getList(person, "sources")) {
          if (shouldIncludeStatus(sourceReference)) {
            let sourceInfo = sourceMap[sourceReference.description];
            if (sourceInfo) {
              sourceIdSet.add(sourceInfo.sourceId);
            }
          }
        }
      }
      else {
        if (personRow.sourceInfo) {
          sourceIdSet.add(personRow.sourceInfo.sourceId);
        }
      }
    }
  }
  function gatherNames(person, nameSet) {
    for (let name of getList(person, "names")) {
      if (shouldIncludeStatus(name)) {
        let fullText = getFullText(name);
        if (!isEmpty(fullText)) {
          nameSet.add(fullText);
        }
      }
    }
  }
  function gatherFacts(person, factSet) {
    for (let fact of getList(person, "facts")) {
      if (shouldIncludeStatus(fact)) {
        factSet.add(getFactString(fact));
      }
    }
  }
  function gatherInfoFromGroup(personRows, sourceNames, treeNames, sourceFacts, treeFacts,
                               parentArks, spouseArks, childArks,
                               parentPids, spousePids, childPids) {
    for (let personRow of personRows) {
      if (personRow.isSourceRow()) {
        // Source persona rows
        let personaId = personRow.sourceInfo.personId;
        let gedcomx = personRow.sourceInfo.gedcomx;
        let persona = findPersonInGx(gedcomx, personaId);
        gatherNames(persona, sourceNames);
        gatherFacts(persona, sourceFacts);
        for (let relationship of getList(gedcomx, "relationships")) {
          if (relationship.type === PARENT_CHILD_REL) {
            let person1Id = getRelativeId(relationship, "person1");
            let person2Id = getRelativeId(relationship, "person2");
            if (person1Id === personaId) {
              addRelativeArksToSet(gedcomx, person2Id, childArks);
            } else if (person2Id === personaId) {
              addRelativeArksToSet(gedcomx, person1Id, parentArks);
            }
          } else if (relationship.type === COUPLE_REL) {
            let spouseId = getSpouseId(relationship, personaId);
            addRelativeArksToSet(gedcomx, spouseId, spouseArks);
          }
        }
      }
      else {
        // FT Person rows
        let personId = personRow.personId;
        let gedcomx = personRow.gedcomx;
        let person = findPersonInGx(gedcomx, personId);
        gatherNames(person, treeNames);
        gatherFacts(person, treeFacts);
        for (let relationship of getList(gedcomx, "relationships")) {
          if (!shouldIncludeStatus(relationship)) {
            continue;
          }
          if (relationship.type === PARENT_CHILD_REL) {
            let person1Id = getRelativeId(relationship, "person1");
            let person2Id = getRelativeId(relationship, "person2");
            if (person1Id === personId) {
              childPids.add(person2Id);
            } else if (person2Id === personId) {
              parentPids.add(person1Id);
            }
          } else if (relationship.type === COUPLE_REL) {
            let spouseId = getSpouseId(relationship, personId);
            spousePids.add(spouseId);
          }
        }
        for (let rel of getList(gedcomx, CHILD_REL)) {
          if (!shouldIncludeStatus(rel)) {
            continue;
          }
          let fatherId = getRelativeId(rel, "parent1");
          let motherId = getRelativeId(rel, "parent2");
          let childId = getRelativeId(rel, "child");
          if (childId === personId) {
            if (fatherId) {
              parentPids.add(fatherId);
            }
            if (motherId) {
              parentPids.add(motherId);
            }
          }
          else if (fatherId === personId || motherId === personId) {
            childPids.add(childId);
          }
        }
      }
    }
  }

  // Set the element direction based on whether its values matched a 'keep' source, 'move' source, or both.
  // If it didn't match either kind of source, then set the direction based on whether a tree person from the keep or move group matched.
  // If it didn't match anything there, either, that's strange, but leave it as "DIR_NULL" so the user can choose it.
  function setDirectionBasedOnInclusion(element, shouldKeep, shouldMove, treeShouldKeep, treeShouldMove) {
    if (shouldKeep && shouldMove) {
      element.direction = DIR_COPY;
    } else if (shouldKeep) {
      element.direction = DIR_KEEP;
    } else if (shouldMove) {
      element.direction = DIR_MOVE;
    }
    // Didn't find the element's information in the attached sources, so check the FT person information
    else if (treeShouldKeep && treeShouldMove) {
      element.direction = DIR_COPY;
    } else if (treeShouldKeep) {
      element.direction = DIR_KEEP;
    } else if (treeShouldMove) {
      element.direction = DIR_MOVE;
    }
  }

  function setDirectionBasedOnSetInclusion(element, value, keepSourceSet, moveSourceSet, keepTreeSet, moveTreeSet) {
    setDirectionBasedOnInclusion(element, keepSourceSet.has(value), moveSourceSet.has(value),
      keepTreeSet ? keepTreeSet.has(value) : false,
      moveTreeSet ? moveTreeSet.has(value) : false);
  }

  function setDirectionBasedOnAttachments(relativeId, keepRelativeArks, splitRelativeArks, keepRelativePids, splitRelativePids, element, optionalRelativeId2) {
    function checkRelativeArks(relId) {
      let relativeInfo = relativeMap.get(relId);
      if (relativeInfo) {
        for (let relativeArk of relativeInfo.attachedPersonaArks) {
          if (keepRelativeArks.has(relativeArk)) {
            shouldKeep = true;
          }
          if (splitRelativeArks.has(relativeArk)) {
            shouldMove = true;
          }
        }
      }
    }
    // Set the direction of the element based on whether the given Family Tree person with the given relative ID
    //   has any persona Arks attached to it that appear in (a) keepRelativeArks => keep; (b) splitRelativeArks => move;
    //     (c) both => copy; or (d) neither => leave as null.
    let shouldKeep = false;
    let shouldMove = false;
    checkRelativeArks(relativeId);
    checkRelativeArks(optionalRelativeId2);
    if (!shouldKeep && !shouldMove) {
      shouldKeep = keepRelativePids.has(relativeId);
      shouldMove = splitRelativePids.has(relativeId);
    }
    setDirectionBasedOnInclusion(element, shouldKeep, shouldMove, false, false);
  }

  //--- splitOnInfoInGroup() ---
  // Set of source ID numbers that are being split out
  let keepSourceIds = new Set();
  let splitSourceIds = new Set();
  gatherSourcesFromGroup(splitRows, splitSourceIds);
  gatherSourcesFromGroup(keepRows, keepSourceIds);
  // Sets of record persona Arks that appear as relatives in sources that are being split out.
  let splitSourceNames = new Set();
  let splitTreeNames = new Set();
  let splitSourceFacts = new Set();
  let splitTreeFacts = new Set();
  let splitParentArks = new Set();
  let splitSpouseArks = new Set();
  let splitChildArks = new Set();
  let splitParentPids = new Set();
  let splitSpousePids = new Set();
  let splitChildPids = new Set();
  gatherInfoFromGroup(splitRows, splitSourceNames, splitTreeNames, splitSourceFacts, splitTreeFacts,
    splitParentArks, splitSpouseArks, splitChildArks,
    splitParentPids, splitSpousePids, splitChildPids);
  let keepSourceNames = new Set();
  let keepTreeNames = new Set();
  let keepSourceFacts = new Set();
  let keepTreeFacts = new Set();
  let keepParentArks = new Set();
  let keepSpouseArks = new Set();
  let keepChildArks = new Set();
  let keepParentPids = new Set();
  let keepSpousePids = new Set();
  let keepChildPids = new Set();
  gatherInfoFromGroup(keepRows, keepSourceNames, keepTreeNames, keepSourceFacts, keepTreeFacts,
    keepParentArks, keepSpouseArks, keepChildArks,
    keepParentPids, keepSpousePids, keepChildPids);

  for (let element of split.elements) {
    // Clear element directions, so we know which ones haven't been decided yet.
    element.direction = DIR_NULL;
    switch (element.type) {
      case TYPE_NAME:
        let fullName = getFullText(element.item);
        setDirectionBasedOnSetInclusion(element, fullName, keepSourceNames, splitSourceNames, keepTreeNames, splitTreeNames);
        break;
      case TYPE_GENDER:
        element.direction = DIR_COPY;
        break;
      case TYPE_FACT:
        let factString = getFactString(element.item);
        setDirectionBasedOnSetInclusion(element, factString, keepSourceFacts, splitSourceFacts, keepTreeFacts, splitTreeFacts);
        break;
      case TYPE_PARENTS:
        let parentsRel = element.item;
        let parent1Id = getRelativeId(parentsRel, "parent1");
        let parent2Id = getRelativeId(parentsRel, "parent2");
        setDirectionBasedOnAttachments(parent1Id, keepParentArks, splitParentArks, keepParentPids, splitParentPids, element, parent2Id);
        break;
      case TYPE_SPOUSE:
        let coupleRelationship = element.item;
        let spouseId = getSpouseId(coupleRelationship, mainPersonId);
        setDirectionBasedOnAttachments(spouseId, keepSpouseArks, splitSpouseArks, keepSpousePids, splitSpousePids, element);
        break;
      case TYPE_CHILD:
        let childRel = element.item;
        let childId = getRelativeId(childRel, "child");
        setDirectionBasedOnAttachments(childId, keepChildArks, splitChildArks, keepChildPids, splitChildPids, element);
        break;
      case TYPE_SOURCE:
        setDirectionBasedOnSetInclusion(element, element.sourceInfo.sourceId, keepSourceIds, splitSourceIds);
        break;
    }
  }
}

const COLUMN_COLLECTION         = "collection";
const COLUMN_PERSON_ID          = "person-id";
const COLUMN_ATTACHED_TO_IDS    = "attached-to-ids";
const COLUMN_CREATED            = "created";
const COLUMN_RECORD_DATE        = "record-date";
const COLUMN_PERSON_NAME        = "person-name";
const COLUMN_PERSON_FACTS       = "person-facts";
const COLUMN_PERSON_FACTS_PLACE = "person-facts-place";
const COLUMN_FATHER_NAME        = "father-name";
const COLUMN_MOTHER_NAME        = "mother-name";
const COLUMN_SPOUSE_NAME        = "spouse-name";
const COLUMN_SPOUSE_FACTS       = "spouse-facts";
const COLUMN_SPOUSE_FACTS_PLACE = "spouse-facts-place";
const COLUMN_CHILD_NAME         = "child-name";
const COLUMN_CHILD_FACTS        = "child-facts";
const COLUMN_CHILD_FACTS_PLACE  = "child-facts-place";
const COLUMN_NOTES              = "notes";

// Direction to move each element
const DIR_KEEP = "keep"; // keep on the "survivor".
const DIR_COPY = "copy"; // keep on the survivor and also copy to the "split"
const DIR_MOVE = "move"; // remove from the survivor and move to the "split"
const DIR_NULL = null; // not decided yet

// Type of information in each element. Note: The String will be used in the HTML display.
const TYPE_NAME = "Name";
const TYPE_GENDER = "Gender";
const TYPE_FACT = "Facts";
const TYPE_PARENTS = "Parents"; // child-and-parents relationship from the person to their parents
const TYPE_SPOUSE = "Spouse"; // Couple relationship to a spouse
const TYPE_CHILD = "Children"; // child-and-parents relationship to a child
const TYPE_SOURCE = "Sources"; // attached source
//future: const TYPE_ORDINANCE = "ordinance"; // linked ordinance

// One element of information from the original GedcomX that is either kept on the old person, or copied or moved out to the new person.
class Element {
  constructor(id, item, type, direction, famId) {
    this.id = id; // index in split.elements[]
    this.item = item; // name, gender, fact, field, relationship or source [or eventually ordinance] being decided upon.
    this.type = type; // Type of item (see TYPE_* above)
    this.direction = direction; // Direction for this piece of information: DIR_KEEP/COPY/MOVE
    this.famId = famId; // optional value identifying which family (i.e., spouseId) this relationship element is part of, to group children by spouse.
    this.canExpand = false;
    // Flag for whether following elements of the same type AND with an 'elementSource' should be displayed.
    this.isExpanded = false;
    // Where this came from, if it isn't the main current person.
    this.elementSource = null;
    this.sourceInfo = null;
    // Flag for whether this element is 'selected', so that it will show even when collapsed.
    // This also means it will be kept on the resulting person(s), even though 'elementSource' would otherwise cause it to be ignored.
    this.isSelected = false;
  }

  isVisible() {
    return !this.elementSource || this.isSelected;
  }

  // Tell whether this element is an "extra" value that can be hidden.
  isExtra() {
    return !!this.elementSource;
  }
}

let split = null;

function getRelationshipMaps(gedcomx, personId, coupleMap, parentRelationships, childrenMap) {
  for (let relationship of getList(gedcomx, "relationships").concat(getList(gedcomx, CHILD_REL))) {
    if (relationship.status === DELETED_STATUS || relationship.status === MERGE_DELETED_STATUS) {
      // Skip relationships that did not end up on the "survivor". (Someone may have to re-add these manually later.)
      continue;
    }
    let spouseId = getSpouseId(relationship, personId);
    if (relationship.type === COUPLE_REL) {
      coupleMap.set(spouseId, relationship);
    } else if (isChildRelationship(relationship)) {
      if (personId === getRelativeId(relationship, "child")) {
        parentRelationships.push(relationship);
      } else {
        let childRelList = childrenMap.get(spouseId);
        if (!childRelList) {
          childRelList = [];
          childrenMap.set(spouseId, childRelList);
        }
        childRelList.push(relationship);
      }
    }
  }
}

class Split {
  constructor(gedcomx) {
    this.gedcomx = gedcomx; // Current, merged person's full GedcomX.
    let personId = gedcomx.persons[0].id;
    this.personId = personId;
    // Elements of information, including name, gender, facts, parent relationships, couple relationships, child relationships and sources.
    // couple and child relationships are ordered such that for each couple relationships, child relationships with that spouse
    //   follow in the elements list. Then any child relationships with no spouse id follow after that.
    this.elements = this.initElements(gedcomx, personId);
  }

  initElements(gedcomx, personId) {
    function addElement(item, type, famId) {
      let element = new Element(elementIndex++, item, type, DIR_KEEP, famId);
      if (item.elementSource) {
        element.elementSource = item.elementSource;
        delete item["elementSource"];
      }
      if (type === TYPE_SOURCE) {
        let sourceReference = element.item;
        element.sourceInfo = sourceMap[sourceReference.description];
      }
      elements.push(element);
      return element;
    }
    function addElements(list, type, shouldSetCanExpand) {
      if (list) {
        let isFirst = true;
        for (let item of list) {
          let element = addElement(item, type);
          if (isFirst && shouldSetCanExpand) {
            element.canExpand = true;
          }
          isFirst = false;
        }
      }
    }
    function addRelationshipElements(gedcomx) {
      function addChildrenElements(spouseId) {
        for (let childRel of getList(childrenMap, spouseId)) {
          addElement(childRel, TYPE_CHILD);
        }
      }
      // child-and-parents relationships in which the person is a child, i.e., containing the person's parents
      let parentRelationships = [];
      // map of spouseId -> Couple relationship for that spouse
      let coupleMap = new Map();
      // map of spouseId -> list of child-and-parents relationships where that spouseId is one of the parents; plus <notParentInRel> -> list w/o another parent.
      let childrenMap = new Map();
      getRelationshipMaps(gedcomx, personId, coupleMap, parentRelationships, childrenMap);
      for (let parentRel of parentRelationships) {
        addElement(parentRel, TYPE_PARENTS);
      }
      for (let [spouseId, coupleRel] of coupleMap) {
        addElement(coupleRel, TYPE_SPOUSE);
        addChildrenElements(spouseId);
      }
      for (let spouseId in childrenMap) {
        if (!coupleMap.get(spouseId)) {
          addChildrenElements(spouseId);
        }
      }
    }
    function populateExtraNamesAndFacts() {
      // Tell whether the given newName already exists in names[] (i.e., if they have the same full text on the first name form)
      function alreadyHasName(names, newName) {
        if (names) {
          let targetText = getFullText(newName);
          if (!isEmpty(targetText)) {
            for (let name of names) {
              let fullText = getFullText(name);
              if (targetText === fullText) {
                return true;
              }
            }
          }
        }
        return false;
      }
      function alreadyHasFact(facts, newFact) {
        if (facts) {
          let newFactString = getFactString(newFact);
          for (let fact of facts) {
            let factString = getFactString(fact);
            if (factString === newFactString) {
              return true;
            }
          }
        }
        return false;
      }
      // -- populateExtraNamesAndFacts()
      for (let i = allEntries.length - 1; i >= 0; i--) {
        let entry = allEntries[i];
        let changeInfo = entry.changeInfo[0];
        let operation = extractType(getProperty(changeInfo, "operation"));
        let objectType = extractType(getProperty(changeInfo, "objectType"));
        let objectModifier = extractType(getProperty(changeInfo, "objectModifier"));
        if (objectModifier === "Person" && objectType !== "NotAMatch" && operation !== "Delete") {
          let resultingId = getProperty(changeInfo, "resulting.resourceId");
          let entryPerson = findPersonByLocalId(entry, resultingId);
          let combo = operation + "-" + ((entryPerson.hasOwnProperty("facts") && entryPerson.facts.length === 1) ? "(Fact)" : objectType);
          if (combo === "Create-BirthName" || combo === "Update-BirthName") {
            if (!alreadyHasName(person.names, entryPerson.names[0])) {
              let nameCopy = copyObject(entryPerson.names[0]);
              nameCopy.elementSource = "From person: " + getPersonId(entryPerson);
              extraNames.push(nameCopy);
            }
          }
          else if (combo === "Create-(Fact)") {
            if (!alreadyHasFact(allFacts, entryPerson.facts[0])) {
              let factCopy = copyObject(entryPerson.facts[0]);
              factCopy.elementSource = "From person: " + getPersonId(entryPerson);
              allFacts.push(factCopy);
            }
          }
        }
      }
      let personaIds = [];
      for (let sourceInfo of Object.values(sourceMap)) {
        if (sourceInfo.personaArk && sourceInfo.gedcomx) {
          let persona = findPersonInGx(sourceInfo.gedcomx, shortenPersonArk(sourceInfo.personaArk));
          if (persona && !personaIds.includes(persona.id) && persona.facts) {
            for (let fact of persona.facts) {
              if (!alreadyHasFact(allFacts, fact)) {
                let factCopy = copyObject(fact);
                factCopy.elementSource = "From source: " + sourceInfo.collectionName;
                allFacts.push(factCopy);
              }
            }
            personaIds.push(persona.id);
          }
        }
      }
    }
    // --- initElements()...
    let elementIndex = 0;
    let elements = [];
    let person = gedcomx.persons[0];
    let extraNames = [];
    let allFacts = copyObject(person.facts);
    populateExtraNamesAndFacts();
    fixEventOrder({"facts" : allFacts});
    addElements(person.names, TYPE_NAME, extraNames.length > 0);
    addElements(extraNames, TYPE_NAME);
    addElement(person.gender, TYPE_GENDER);
    addElements(allFacts, TYPE_FACT, allFacts && allFacts.length > (person.facts ? person.facts.length : 0));
    addRelationshipElements(gedcomx); // future: find other relationships that were removed along the way.
    if (person.sources) {
      person.sources.sort(compareSourceReferences);
      addElements(person.sources, TYPE_SOURCE);
    }
    return elements;
  }
}

// Get the other persons who are not selected in the 'mainGroup'
function getOtherPersonRows(grouper, mainGroup) {
  let otherRows = [];
  // Get a list of all the person rows from sourceGrouper that are NOT in 'sourceGroup'.
  for (let group of grouper.mergeGroups) {
    if (group.groupId !== mainGroup.groupId) {
      otherRows.push(...group.personRows);
    }
  }
  return otherRows;
}

function getRowsBySelection(personRows, isSelected) {
  let matchingRows = [];
  for (let personRow of personRows) {
    if (personRow.isSelected === isSelected) {
      matchingRows.push(personRow);
    }
  }
  return matchingRows;
}

// Get a somewhat normalized fact string with type: [<date>; ][<place>; ][<value>]
//  - with leading "0" stripped off of date; ", United States" stripped off of place.
// Not meant to be displayed, just used to see if a fact might be redundant.
function getFactString(fact) {
  return (fact.type ? extractType(fact.type).replaceAll(/ /g, "").replace("Census", "Residence") : "<no type>") + ": " +
    (fact.date && fact.date.original ? fact.date.original.trim().replaceAll(/^0/g, "") : "<no date>") + "; " +
    (fact.place && fact.place.original ? fact.place.original.trim().replaceAll(/, United States$/g, "") : "<no place>") + "; " +
    (fact.value && fact.value.text ? fact.value.text : "<no text>");
}

function compareSourceReferences(a, b) {
  let sourceInfo1 = sourceMap[a.description];
  let sourceInfo2 = sourceMap[b.description];
  let key1 = sourceInfo1 && sourceInfo1.recordDateSortKey ? sourceInfo1.recordDateSortKey : "?";
  let key2 = sourceInfo2 && sourceInfo2.recordDateSortKey ? sourceInfo2.recordDateSortKey : "?";
  return key1.localeCompare(key2);
}

// Get the full text of the first name form of the name object.
function getFullText(name) {
  let nameForm = getFirst(getList(name, "nameForms"));
  let fullText = getProperty(nameForm, "fullText");
  return fullText ? fullText : "<no name>";
}

// Don't delete: Really is used, IntelliJ just can't tell.
function moveElement(direction, elementId) {
  let element = split.elements[elementId];
  element.direction = direction;
  if (element.direction !== DIR_KEEP && element.isExtra() && !element.isSelected) {
    element.isSelected = true;
  }
  updateSplitViewHtml();
}

function toggleSplitExpanded(elementIndex) {
  split.elements[elementIndex].isExpanded = !split.elements[elementIndex].isExpanded;
  updateSplitViewHtml();
}

function toggleElement(elementId) {
  split.elements[elementId].isSelected = !split.elements[elementId].isSelected;
  updateSplitViewHtml();
}

function updateSplitViewHtml() {
  $("#" + SPLIT_VIEW).html(getSplitViewHtml());
}

function updateComboViewHtml() {
  $("#" + COMBO_VIEW).html(getComboViewHtml());
}

function getSplitViewHtml() {
  function makeButton(label, direction, element) {
    let isActive = direction !== element.direction;
    return "<button class='dir-button' " +
      (isActive ? "onclick='moveElement(\"" + direction + "\", " + element.id + ")'" : "disabled") + ">" +
      encode(label) + "</button>";
  }
  function getHeadingHtml(element) {
    let headingClass = (element.type === TYPE_CHILD && prevElement.type === TYPE_SPOUSE) ? "split-children" : "split-heading";
    let tdHeading = "<td class='" + headingClass + "'>";
    let buttonHtml = "";
    if (element.canExpand) {
      if (!prevElement || element.type !== prevElement.type) {
        // For "Names" and "Facts", add an expand/collapse button after the label
        isExpanded = element.isExpanded;
        buttonHtml = "<button class='collapse-button' onclick='toggleSplitExpanded(" + element.id + ")'>" + encode(isExpanded ? "-" : "+") + "</button>";
      }
    } else {
      isExpanded = false;
    }
    return "<tr>"
      + tdHeading + encode(element.type) + buttonHtml + "</td>"
      + tdHeading + "</td>"
      + tdHeading + encode(element.type) + buttonHtml + "</td></tr>\n";
  }
  // -- getSplitViewHtml()
  let html = "<table class='split-table'>\n";
  html += "<thead><tr><th>Remaining Person</th><th></th><th>Split-out Person</th></tr></thead>\n";
  html += "<tbody>";
  let prevElement = null;
  let isExpanded = false;

  for (let element of split.elements) {
    if (element.status === DELETED_STATUS || element.status === MERGE_DELETED_STATUS) {
      continue; // skip elements that have been deleted. (Perhaps we eventually make these available to "reclaim" when splitting out a person)
    }
    if (!prevElement || element.type !== prevElement.type || element.famId !== prevElement.famId) {
      html += getHeadingHtml(element);
    }

    if (isExpanded || element.isVisible()) {
      html += "<tr>";
      // Left column.
      html += getElementHtml(element, split.personId, element.direction !== DIR_MOVE);

      // Center buttons
      html += "<td class='identity-gx'>" + makeButton("<", DIR_KEEP, element) + " " + makeButton("=", DIR_COPY, element) + " " + makeButton(">", DIR_MOVE, element) + "</td>";

      // Right column
      html += getElementHtml(element, split.personId, element.direction === DIR_COPY || element.direction === DIR_MOVE);
    }
    prevElement = element;
  }
  html += "</tbody></table>\n";
  return html;
}

function getElementHtml(element, personId, shouldDisplay) {
  function getParentsHtml(relationship) {
    let parentHtmls = [];
    for (let parentNumber of ["parent1", "parent2"]) {
      let relativeId = getRelativeId(relationship, parentNumber);
      if (relativeId) {
        parentHtmls.push(getRelativeHtml(relativeId, relationship.updated));
      }
    }
    return parentHtmls.join("<br>&nbsp;");
  }

  if (!shouldDisplay) {
    return "<td class='identity-gx'></td>";
  }
  let elementHtml = "";
  switch (element.type) {
    case TYPE_NAME:
      let name = element.item;
      let nameFormHtmls = [];
      for (let nameForm of getList(name, "nameForms")) {
        nameFormHtmls.push(encode(nameForm.fullText ? nameForm.fullText : "<unknown>"));
      }
      elementHtml = "&nbsp;" + nameFormHtmls.join("<br>");
      break;
    case TYPE_GENDER:
      let gender = element.item;
      elementHtml = "&nbsp;" + encode( gender.type ? extractType(gender.type) : "Unknown");
      break;
    case TYPE_FACT:
      elementHtml = "&nbsp;" + getFactHtml(element.item, true);
      break;
    case TYPE_PARENTS:
      elementHtml = "&nbsp;" + getParentsHtml(element.item);
      break;
    case TYPE_SPOUSE:
      let coupleRelationship = element.item;
      elementHtml = "&nbsp;" + getRelativeHtml(getSpouseId(coupleRelationship, personId), coupleRelationship.updated);
      break;
    case TYPE_CHILD:
      let childRel = element.item;
      elementHtml = "&nbsp;&nbsp;&nbsp;&nbsp;" + getRelativeHtml(getRelativeId(childRel, "child"), childRel.updated);
      break;
    case TYPE_SOURCE:
      let sourceInfo = sourceMap[element.item.description];
      if (sourceInfo.personaArk) {
        elementHtml = "<a href='" + sourceInfo.personaArk + "' target='_blank'>" + encode(sourceInfo.collectionName) + "</a>";
      }
      else {
        elementHtml = encode(sourceInfo.collectionName);
      }
      return wrapTooltip(element, elementHtml, sourceInfo.gedcomx ? getGedcomxSummary(sourceInfo.gedcomx, sourceInfo.personId) : null);
    // future: TYPE_ORDINANCE...
  }
  return wrapTooltip(element, elementHtml, element.elementSource ? encode(element.elementSource) : null);
}

function wrapTooltip(element, mainHtml, tooltipHtml) {
  let undecidedClass = element.direction === DIR_NULL ? " undecided" : "";
  if (!tooltipHtml) {
    return "<td class='identity-gx " + undecidedClass + "'>" + mainHtml + "</td>";
  }
  return "<td class='split-extra tooltip" + undecidedClass + "'>"
    + (element.isExtra() ? "<input id='extra-" + element.id + "' type='checkbox' onchange='toggleElement(" + element.id + ")'" + (element.isSelected ? " checked" : "") + ">" : "")
    + "<label for='extra-" + element.id + "' class='tooltip'>" + mainHtml + "<span class='tooltiptext'>" + tooltipHtml + "</span></label></td>";
}

// Get an HTML summary of the info in the given gedcomx file.
function getGedcomxSummary(gedcomx, personId) {
  if (!gedcomx || !personId) {
    return "";
  }

  let person = findPersonInGx(gedcomx, personId);
  let lines = [];
  lines.push(getPersonName(person));
  if (person.facts) {
    for (let fact of person.facts) {
      lines.push(getFactHtml(fact, true));
    }
  }
  //future: Include relatives...
  return lines.join("<br>");
}

function updateGroupName(groupId) {
  let grouper = grouperMap[groupId];
  let mergeGroup = grouper.findGroup(groupId);
  let $mergeGroupLabelNode = $("#" + mergeGroup.groupId);
  mergeGroup.groupName = $mergeGroupLabelNode.text();
}

function updateNote(personRowId, noteId) {
  let personRow = personRowMap[personRowId];
  let $note = $("#" + noteId);
  personRow.note = $note.text();
}

function deleteEmptyGroup(groupId) {
  let grouper = grouperMap[groupId];
  grouper.deleteGroup(groupId);
  updateFlatViewHtml(grouper);
}

function getVerticalGrouperHtml(grouper) {
  function padGroup(groupIndex) {
    if (groupIndex < grouper.mergeGroups.length - 1) {
      html += "<td class='group-divider'></td>";
    }
  }

  function addRow(columnId, rowLabel, shouldAlwaysInclude, personRowFunction) {
    if (shouldAlwaysInclude || grouper.usedColumns.has(columnId)) {
      html += "<tr>" + headerHtml(grouper, columnId, rowLabel, shouldAlwaysInclude, true);
      for (let groupIndex = 0; groupIndex < grouper.mergeGroups.length; groupIndex++) {
        let group = grouper.mergeGroups[groupIndex];
        for (let personRow of group.personRows) {
          html += personRowFunction(personRow);
        }
        padGroup(groupIndex);
      }
      html += "</tr>\n";
    }
  }

  function addGroupNamesRow() {
    // Top row: <blank column header><group header, colspan=#person'rows' in group><gap>...
    html += "<tr><td class='drag-width' id='drag-table'><div class='drag-table-handle'>" + encode("<=width=>") + "</div></td>"; // leave one cell for the left header column
    for (let groupIndex = 0; groupIndex < grouper.mergeGroups.length; groupIndex++) {
      let group = grouper.mergeGroups[groupIndex];
      let colspan = group.personRows.length > 1 ? " colspan='" + group.personRows.length + "'" : "";
      html += "<td class='group-header'" + colspan + ">";
      if (grouper.mergeGroups.length > 1) {
        html += getGroupHeadingHtml(group, groupIndex);
      }
      html += "</td>";
      padGroup(groupIndex);
    }
    html += "<td class='new-group-td'>" + getAddGroupButtonHtml(grouper) + "</td>";
    html += "</tr>\n";
  }

  function td(personRow, cellContentsHtml, shouldDrag) {
    return "<td class='" + personRow.getCellClass() + (shouldDrag ? " drag-width" : "") + "'" + clickInfo(personRow) + ">" +
      (cellContentsHtml ? cellContentsHtml : "") + "</td>";
  }

  function addSpouseFamilyRows() {
    function findFamilyDisplay(personRow, spouseIndex) {
      let index = 0;
      for (let familyDisplay of personRow.familyMap.values()) {
        if (index === spouseIndex) {
          return familyDisplay;
        }
      }
      return null;
    }

    function getMaxSpouses(grouper) {
      let maxSpouses = 0;
      for (let group of grouper.mergeGroups) {
        for (let personRow of group.personRows) {
          let numSpouses = personRow.familyMap.size;
          if (numSpouses > maxSpouses) {
            maxSpouses = numSpouses;
          }
        }
      }
      return maxSpouses;
    }

    function anySpouseHasFacts(grouper, spouseIndex) {
      for (let group of grouper.mergeGroups) {
        for (let personRow of group.personRows) {
          let familyDisplay = findFamilyDisplay(personRow, spouseIndex);
          if (familyDisplay && familyDisplay.spouse && familyDisplay.spouse.facts) {
            return true;
          }
        }
      }
      return false;
    }

    function getSpouseName(personRow, spouseIndex) {
      let familyDisplay = findFamilyDisplay(personRow, spouseIndex);
      return familyDisplay ? familyDisplay.spouse.name : null;
    }

    function getSpouseFacts(personRow, spouseIndex) {
      let familyDisplay = findFamilyDisplay(personRow, spouseIndex);
      return familyDisplay ? familyDisplay.spouse.facts : null;
    }

    function getChildName(personRow, spouseIndex, childIndex) {
      let familyDisplay = findFamilyDisplay(personRow, spouseIndex);
      let childDisplay = familyDisplay && childIndex < familyDisplay.children.length ? familyDisplay.children[childIndex] : null;
      return childDisplay ? childDisplay.name : null;
    }

    function getChildFacts(personRow, spouseIndex, childIndex) {
      let familyDisplay = findFamilyDisplay(personRow, spouseIndex);
      let childDisplay = familyDisplay && childIndex < familyDisplay.children.length ? familyDisplay.children[childIndex] : null;
      return childDisplay && childDisplay.facts ? childDisplay.facts : null;
    }

    // Look through all the person rows in the given grouper, and look at the spouse family with the given index,
    //   see how many children there are, and which ones have facts on them.
    // Return an array of hasChildFacts[n] indicating (a) the maximum number of children for the given spouse index in
    //   any person row; and (b) whether the nth child of that spouse has facts for any of the person rows.
    // (This lets us know how many child rows to include in the vertical view, and whether to include a child facts row for each).
    function seeWhichChildrenHaveFacts(grouper, spouseIndex) {
      let hasChildFacts = [];
      for (let group of grouper.mergeGroups) {
        for (let personRow of group.personRows) {
          let familyDisplay = findFamilyDisplay(personRow, spouseIndex);
          if (familyDisplay) {
            for (let childIndex = 0; childIndex < familyDisplay.children.length; childIndex++) {
              if (childIndex >= hasChildFacts.length) {
                hasChildFacts.push(false);
              }
              if (familyDisplay.children[childIndex].facts) {
                hasChildFacts[childIndex] = true;
              }
            }
          }
        }
      }
      return hasChildFacts;
    }

    let maxSpouses = getMaxSpouses(grouper);
    for (let spouseIndex = 0; spouseIndex < maxSpouses; spouseIndex++) {
      let spouseLabel = "Spouse" + (spouseIndex > 0 ? " " + (spouseIndex + 1) : "");
      addRow(COLUMN_SPOUSE_NAME, spouseLabel, true, personRow => td(personRow, getSpouseName(personRow, spouseIndex)));
      if (anySpouseHasFacts(grouper, spouseIndex)) {
        addRow(COLUMN_SPOUSE_FACTS, spouseLabel + " facts", true, personRow => td(personRow, getSpouseFacts(personRow, spouseIndex)));
      }
      if (displayOptions.shouldShowChildren) {
        // Array of boolean telling whether the nth child row needs facts for any of the person rows.
        let hasChildFacts = seeWhichChildrenHaveFacts(grouper, spouseIndex);
        for (let childIndex = 0; childIndex < hasChildFacts.length; childIndex++) {
          let childLabel = "- Child" + (hasChildFacts.length > 1 ? " " + (childIndex + 1) : "");
          addRow(COLUMN_CHILD_NAME, childLabel, true, personRow => td(personRow, getChildName(personRow, spouseIndex, childIndex)));
          if (hasChildFacts[childIndex]) {
            addRow(COLUMN_CHILD_FACTS, " facts", true, personRow => td(personRow, getChildFacts(personRow, spouseIndex, childIndex)));
          }
        }
      }
    }
  }

  function clickInfo(personRow) {
    return " onclick='handleColumnClick(event, \"" + personRow.id + "\");'";
  }

  // --- getVerticalGrouperHtml ---
  let tabId = grouper.tabId;
  let html = "<table id='vertical-" + grouper.tabId + "'>";
  addGroupNamesRow();

  // Person ID row
  if (tabId !== SOURCES_VIEW) {
    addRow(COLUMN_PERSON_ID, "Person ID", true,
      personRow => td(personRow, personRow.getPersonIdHtml(false), true));
  }
  // Collection name & record date rows
  if (tabId === COMBO_VIEW || tabId === SOURCES_VIEW) {
    addRow(COLUMN_COLLECTION, "Collection", true,
      personRow => personRow.getCollectionHtml(null, clickInfo(personRow)));
    addRow(COLUMN_RECORD_DATE, "Record Date", true,
      personRow => personRow.getRecordDateHtml(null, clickInfo(personRow)));
  }
  // Created timestamp row
  if (tabId === MERGE_VIEW || tabId === FLAT_VIEW) {
    addRow(COLUMN_CREATED, "Created", true,
      personRow => personRow.getTimestampHtml(null, null, clickInfo(personRow)));
  }
  // Person names row
  addRow(COLUMN_PERSON_NAME, "Name", true,
    personRow => td(personRow, personRow.personDisplay.name));

  // Person facts row
  // Future: Put "Birth:", etc., on left, and put events of that time in the same row.
  //  - Able to sort by that. Requires using COLUMN_FACTS + ".Birth" or something in order to sort and display.
  addRow(COLUMN_SPOUSE_FACTS, "Facts", false,
    personRow => td(personRow, personRow.personDisplay.facts));

  // Relative rows: Fathers, mothers, then each spouse with their children.
  addRow(COLUMN_FATHER_NAME, "Father", false,
    personRow => td(personRow, personRow.combineParents(personRow.fathers)));
  addRow(COLUMN_MOTHER_NAME, "Mother", false,
    personRow => td(personRow, personRow.combineParents(personRow.mothers)));
  addSpouseFamilyRows();

  // Notes
  addRow(COLUMN_NOTES, "Notes", true,
    personRow => personRow.getNoteCellHtml('identity-gx', '', ''));
  html += "</table>\n";
  return html;
}

function getGrouperHtml(grouper) {
  if (displayOptions.vertical && (getCurrentTab() === FLAT_VIEW || getCurrentTab() === SOURCES_VIEW || getCurrentTab() === COMBO_VIEW)) {
    return getVerticalGrouperHtml(grouper);
  }
  let html = getTableHeader(grouper, false);
  let numColumns = html.match(/<th/g).length;

  for (let groupIndex = 0; groupIndex < grouper.mergeGroups.length; groupIndex++) {
    let personGroup = grouper.mergeGroups[groupIndex];
    if (grouper.mergeGroups.length > 1) {
      html += "<tr class='group-header'>" + "<td class='group-header' colspan='" + numColumns + "'>" +
        getGroupHeadingHtml(personGroup, groupIndex) + "</td></tr>";
    }
    for (let personRow of personGroup.personRows) {
      html += personRow.getHtml(grouper.usedColumns, grouper.tabId);
    }
  }
  html += "</table>\n";
  html += getAddGroupButtonHtml(grouper);
  return html;
}

function getAddGroupButtonHtml(grouper) {
  return "<button class='add-group-button' onclick='addGroup(\"" + grouper.id + "\")'>New group</button>\n";
}

function getGroupHeadingHtml(personGroup, groupIndex) {
  let isEmptyGroup = isEmpty(personGroup.personRows.length);
  // Close button for empty groups
  return (isEmptyGroup ? "<button class='close-button' onclick='deleteEmptyGroup(\"" + personGroup.groupId + "\")'>X</button>" : "")
    // Group name
    + "<div class='group-name' contenteditable='true' id='" + personGroup.groupId
    + "' onkeyup='updateGroupName(\"" + personGroup.groupId + "\")'>"
    + encode(personGroup.groupName) + "</div>"
    // "Add to Group" button
    + "<button class='add-to-group-button' onclick='addSelectedToGroup(\"" + personGroup.groupId + "\")'>Add to group</button>"
    // "Apply to Split" button
    + (groupIndex < 1 || isEmptyGroup ? "" : "<button class='apply-button' onclick='splitOnGroup(\"" + personGroup.groupId + "\")'>Apply to Split</button>");
}

function sortColumn(columnName, grouperId) {
  let grouper = grouperMap[grouperId];
  grouper.sort(columnName);
  updateFlatViewHtml(grouper);
}

function sortHeader(grouper, columnName, label, spanClass) {
  return "<span "
    + (spanClass ? "class='" + spanClass + "'" : "")
    + (grouper ? "onclick='sortColumn(\"" + columnName + "\", \"" + grouper.id + "\")'" : "")
    + ">" + encode(label) + "</span>";
}

function sortHeaderTh(grouper, columnName, label, colspan) {
  return "<th" + headerId(grouper, columnName) + (colspan ? colspan: "") + " class='drag-width'>" + sortHeader(grouper, columnName, label) + "</th>";
}

function datePlaceLabelHtml(grouper, columnName, label) {
  return sortHeader(grouper, columnName, label, "sort-date")
    + (grouper ? "<span class='sort-place' onclick='sortColumn(\"" + columnName + "-place" + "\", \"" + grouper.id + "\")'>"
      + encode(" place ") + "</span>" : "");
}

function headerId(grouper, columnName) {
  return " id='" + grouper.id + "-th-" + columnName + "'";
}

function headerHtml(grouper, columnName, label, alwaysInclude, nonDraggable) {
  if (alwaysInclude || grouper.usedColumns.has(columnName)) {
    let id = nonDraggable ? "" : headerId(grouper, columnName);
    return "<th" + id + (nonDraggable ? "" : " class='drag-width'") + ">"
      + (columnName.endsWith("-facts") ? datePlaceLabelHtml(grouper, columnName, label) : sortHeader(grouper, columnName, label))
      + "</th>";
  }
  return "";
}

function getTableHeader(grouper, shouldIndent) {
  let colspan = shouldIndent ? " colspan='" + grouper.maxDepth + "'" : "";
  let html = "<table id='table-" + grouper.id + "'>";

  if (grouper.tabId === SOURCES_VIEW || grouper.tabId === COMBO_VIEW) {
    html += sortHeaderTh(grouper, COLUMN_COLLECTION, "Collection");
    html += sortHeaderTh(grouper, COLUMN_RECORD_DATE, "Record Date");
    if (displayOptions.shouldShowAttachedTo) {
      html += sortHeaderTh(grouper, COLUMN_ATTACHED_TO_IDS, "Attached to");
    }
  }
  if (grouper.tabId !== SOURCES_VIEW) {
    html += sortHeaderTh(grouper, COLUMN_PERSON_ID, "Person ID", colspan);
  }
  if (grouper.tabId === MERGE_VIEW || grouper.tabId === FLAT_VIEW) {
    html += sortHeaderTh(grouper, COLUMN_CREATED, "Created");
  }
  html += headerHtml(grouper, COLUMN_PERSON_NAME, "Name", true) +
    headerHtml(grouper, COLUMN_PERSON_NAME, "Facts") +
    headerHtml(grouper, COLUMN_FATHER_NAME, "Father") +
    headerHtml(grouper, COLUMN_MOTHER_NAME, "Mother") +
    headerHtml(grouper, COLUMN_SPOUSE_NAME, "Spouse") +
    headerHtml(grouper, COLUMN_SPOUSE_FACTS, "Spouse facts") +
    headerHtml(grouper, COLUMN_CHILD_NAME, "Children") +
    headerHtml(grouper, COLUMN_CHILD_FACTS, "Child facts") +
    headerHtml(grouper, COLUMN_NOTES, "Notes", true);
  return html;
}

function getMergeHierarchyHtml(entries) {
  let rootMergeNode = getRootMergeNode(entries);
  let maxDepth = findMaxDepth(rootMergeNode);
  let mergeRows = buildMergeRows(rootMergeNode, "", maxDepth - 1, false, [], true);
  let usedColumns = findUsedColumns(mergeRows);

  mergeGrouper = new Grouper(mergeRows, usedColumns, maxDepth, MERGE_VIEW);
  return getMergeGrouperHtml(maxDepth);
}

function getMergeGrouperHtml(maxDepth) {
  let html = getTableHeader(mergeGrouper, true);
  let numColumns = html.match(/<th/g).length + maxDepth;
  for (let mergeRow of mergeGrouper.getAllRows()) {
    html += mergeRow.getHtml(mergeGrouper.usedColumns, MERGE_VIEW);
  }
  html += "<tr><td class='bottom-button-row' colspan='" + numColumns + "'>"
  html += "<button class='apply-button' onclick='splitOnSelectedMergeRows()'>Apply selected rows to Split</button></td></tr>";
  html += "</table>\n";
  return html;
}

function updateMergeHierarchyHtml() {
  $("#" + mergeGrouper.tabId).html(getMergeGrouperHtml(mergeGrouper.maxDepth));
  highlightSelectedRows(mergeGrouper);
}

function getPersonName(person) {
  let name = getFirst(getList(person, "names"));
  let nameForm = getFirst(getList(name, "nameForms"));
  let fullText = getProperty(nameForm, "fullText");
  return fullText ? fullText : "<no name>";
}

function getFactListHtml(person) {
  function isEmptyDeathFact(fact) {
    return fact && fact.type === "http://gedcomx.org/Death" && !fact.date && !fact.place;
  }
  function isVital(factType) {
    return factType === "Birth" || factType === "Death" || factType === "Christening" || factType === "Burial" || factType === "Marriage";
  }
  function shouldIncludeType(factType) {
    return displayOptions.factsToInclude === INCLUDE_ALL_FACTS || isVital(factType);
  }
  function filterFacts(facts) {
    if (!facts || displayOptions.factsToInclude === INCLUDE_NO_FACTS) {
      return [];
    }
    let filtered = [];
    for (let fact of facts) {
      let factType = extractType(fact.type);
      if (shouldIncludeType(factType) && shouldDisplayStatus(fact.status)) {
        filtered.push(fact);
      }
    }
    return filtered;
  }

  let filteredFacts = filterFacts(getList(person, "facts"));
  let factDisplays = [];
  for (let fact of filteredFacts) {
    if (!isEmptyDeathFact(fact)) {
      let factHtml = getFactHtml(fact);
      if (factHtml) {
        factDisplays.push(factHtml);
      }
    }
  }
  return combineHtmlLists(factDisplays);
}

function getParentHtml(gedcomx, personId, parentNumber) {
  let parents = [];
  for (let childRel of getList(gedcomx, CHILD_REL)) {
    if (getRelativeId(childRel, "child") === personId) {
      let timestamp = childRel.updated;
      addRelativeToList(parents, getRelativeId(childRel, parentNumber), timestamp);
      // (Not currently doing siblings)
    }
  }
  return combineHtmlLists(parents);
}

const NO_SPOUSE = "<none>";

function getSpouseId(relationship, personId) {
  if (relationship.type === COUPLE_REL) {
    let isPerson1 = getRelativeId(relationship, "person1") === personId;
    let isPerson2 = getRelativeId(relationship, "person2") === personId;
    if (isPerson1 || isPerson2) {
      return getRelativeId(relationship, isPerson1 ? "person2" : "person1");
    }
  }
  else if (isChildRelationship(relationship)) {
    let isParent1 = getRelativeId(relationship, "parent1") === personId;
    let isParent2 = getRelativeId(relationship, "parent2") === personId;
    if (isParent1 || isParent2) {
      return getRelativeId(relationship, isParent1 ? "parent2" : "parent1");
    }
  }
  return NO_SPOUSE;
}

function isChildRelationship(relationship) {
  return relationship && relationship.hasOwnProperty("child");
}

function combineHtmlLists(list) {
  return list.join("<br>");
}

function addRelativeToList(list, relativeId, timestamp) {
  let relativeHtml = getRelativeHtml(relativeId, timestamp);
  if (relativeHtml) {
    list.push(relativeHtml);
  }
}

function getRelativeHtml(relativeId, timestamp) {
  if (!relativeId) {
    return "";
  }
  return encode(getRelativeName(relativeId, timestamp)) + " <span class='relative-id'>(" + encode(relativeId) + ")</span>";
}

// ====================================================================
// ============ GedcomX manipulation (no HTML) =========================

function getInitialGedcomx(personId) {
  return { "persons": [
      {"id": personId,
        "identifiers": {
          "http://gedcomx.org/Primary": [
            "https://familiysearch.org/ark:/61903/4:1:/" + personId
          ]
        }
      }
    ] };
}

function shortenPersonArk(personArk) {
  return personArk.replaceAll(/.*[/]/g, "").replaceAll(/^4:1:/g, "")
}

function getPersonId(person) {
  function getPersonIdOfType(type) {
    let identifiers = person.identifiers[type];
    if (identifiers && identifiers.length > 0) {
      return shortenPersonArk(identifiers[0]);
    }
  }
  if (!person) {
    return null;
  }
  let personId = getPersonIdOfType("http://gedcomx.org/Persistent");
  if (!personId) {
    personId = getPersonIdOfType("http://gedcomx.org/Primary");
  }
  if (!personId) {
    throw new Error("No Primary or Persistent id for person.");
  }
  return personId;
}

function findPersonInGx(gedcomx, personId) {
  if (gedcomx && personId && gedcomx.hasOwnProperty("persons")) {
    personId = shortenPersonArk(personId);
    for (let person of gedcomx.persons) {
      let gxPersonId = getPersonId(person)
      if (personId === gxPersonId || personId === person.id) {
        return person;
      }
    }
  }
  throw new Error("Could not find person with id " + personId);
}

// Compare two date strings, if they can both be parsed. Return -1 or 1 if they were both parsed and are different; or 0 otherwise.
function compareDates(date1, date2) {
  let dateNum1 = parseDateIntoNumber(date1);
  if (dateNum1) {
    let dateNum2 = parseDateIntoNumber(date2);
    if (dateNum2 && dateNum1 !== dateNum2) {
      return dateNum1 < dateNum2 ? -1 : 1;
    }
  }
  return 0;
}

// Return -1, 0 or 1 if fact1 is 'less than', equal to, or 'greater than' fact 2.
// Sorts first by fact date, if there is one, and otherwise by type
function compareFacts(fact1, fact2) {
  let level1 = typeLevelMap[extractType(fact1["type"])];
  let level2 = typeLevelMap[extractType(fact2["type"])];
  level1 = level1 ? level1 : 0; // convert undefined to 0
  level2 = level2 ? level2 : 0;
  if (level1 !== level2) {
    return level1 < level2 ? -1 : 1;
  }
  let date1 = getProperty(fact1, "date.original");
  let date2 = getProperty(fact2, "date.original");
  return compareDates(date1, date2);
}

// Add the given fact to the given person. Insert it before any other fact that it is
//   earlier than (by date; or birth < christening < most other events < death < burial).
function addFact(person, fact, isOrig, isPartOfMerge) {
  fact.status = getAddStatus(isOrig, isPartOfMerge);
  if (!person.hasOwnProperty("facts")) {
    person.facts = [];
  }
  let factIndex = 0;
  while (factIndex < person.facts.length) {
    if (compareFacts(fact, person.facts[factIndex]) < 0) {
      // new fact is 'less than' the fact at index [factIndex], so insert it there.
      person.facts.splice(factIndex, 0, fact);
      return;
    }
    factIndex++;
  }
  person.facts.push(fact);
}

/**
 * Add or update a Couple relationship on the given gedcomx, as found in the entryGedcomx.
 * - The original and resulting relationships should both have the same Primary identifier.
 * - The original relationship may be empty, and may not exist in 'gedcomx' yet.
 * - If not, just add a copy of it. If it does exist, update the two identifiers but leave any facts intact.
 * @param gedcomx - GedcomX to modify
 * @param entry - Change log entry
 * @param resultingId - 'id' of the Couple relationship with the updated relatives
 * @param isOrig - flag for whether this update is happening during the 'original identity' phase of a person's creation.
 * @param isPartOfMerge - Flag for whether this 'add' or 'update' is part of information coming from the duplicate as part of a merge.
 */
function updateCoupleRelationship(gedcomx, entry, resultingId, isOrig, isPartOfMerge) {
  let resultingRel = findCoupleRelationship(entry, resultingId);
  if (!resultingRel) {
    return;
  }
  // Remove existing relationship (or flag as deleted)
  let relationshipId = getPrimaryIdentifier(resultingRel);
  let existingRel = findEntityByPrimaryIdentifier(getList(gedcomx, "relationships"), relationshipId);
  if (existingRel) {
    removeFromListByPrimaryIdentifier(gedcomx, "relationships", entry.content.gedcomx, isOrig);
  }
  // Add new relationship
  let relCopy = copyObject(resultingRel);
  relCopy.updated = entry.updated;
  relCopy.status = getAddStatus(isOrig, isPartOfMerge);
  delete relCopy["id"]; // Remove temp id of "<longId>.resulting"
  addToList(gedcomx, "relationships", relCopy);
}

/**
 * Add or update a child-and-parents-relationship on the given gedcomx, as found in the entryGedcomx.
 * - The original and resulting relationships should both have the same Primary identifier.
 * - The original relationship may be empty, and may not exist in 'gedcomx' yet.
 * - If not, just add a copy of it. If it does exist, update the three identifiers but leave any facts intact.
 * @param gedcomx - GedcomX to modify
 * @param entry - Change log entry
 * @param resultingId - 'id' of the child-and-parents-relationship with the updated relatives
 * @param isOrig - flag for whether this update is happening during the 'original identity' phase of a person's creation.
 * @param isPartOfMerge - Flag for whether this 'add' or 'update' is part of information coming from the duplicate as part of a merge.
 */
function updateChildAndParentsRelationship(gedcomx, entry, resultingId, isOrig, isPartOfMerge) {
  let resultingRel = findChildAndParentsRelationship(entry, resultingId);
  if (!resultingRel) {
    return;
  }
  let relationshipId = getPrimaryIdentifier(resultingRel);
  let existingRel = findEntityByPrimaryIdentifier(getList(gedcomx, CHILD_REL), relationshipId);
  if (existingRel) {
    // Remove existing relationship (or flag as deleted)
    removeFromListByPrimaryIdentifier(gedcomx, CHILD_REL, entry.content.gedcomx, isOrig);
  }
  // Add new updated relationship
  let relCopy = copyObject(resultingRel);
  relCopy.updated = entry.updated;
  delete relCopy["id"]; // Remove temp id of "<longId>.resulting"
  relCopy.status = getAddStatus(isOrig, isPartOfMerge)
  addToList(gedcomx, CHILD_REL, relCopy);
}

function addToList(listHolder, listName, element, isOrig, isPartOfMerge) {
  if (listHolder.hasOwnProperty(listName)) {
    listHolder[listName].push(element);
  }
  else {
    listHolder[listName] = [element];
  }
  element.status = getAddStatus(isOrig, isPartOfMerge);
}


/**
 * Replace the element in listContainer[listName] that has the same id as elementListContainer[listName][0]
 *   with that element. For example, replace person["names"][2] with elementListContainer["names"][0]
 *   if they both have the same "id" element.
 * @param listContainer - Object (like a person) that has a list named listName, containing elements with an 'id'.
 * @param listName - Name of list to look in
 * @param elementListContainer - Object (like a change log person) that has a list of the given name with a single entry.
 * @param isOrig - Flag for whether the change is happening during the initial creation of the person (part of its "original intended identity")
 * @param isPartOfMerge - Flag for whether this 'add' or 'update' is part of information coming from the duplicate as part of a merge.
 */
function updateInList(listContainer, listName, elementListContainer, isOrig, isPartOfMerge) {
  function hasSameId(a, b) {
    if (a.hasOwnProperty("id") && a["id"] === elementWithId["id"]) {
      return true;
    }
    let idA = getPrimaryIdentifier(a);
    let idB = getPrimaryIdentifier(b);
    return !!(idA && idA === idB);
  }

  let elementWithId = elementListContainer[listName][0];
  let existingList = listContainer[listName];
  if (existingList) {
    for (let i = 0; i < existingList.length; i++) {
      if (hasSameId(existingList[i], elementWithId)) {
        if (setDeletedStatus(existingList[i], isOrig)) {
          existingList[i] = elementWithId;
        } else {
          existingList.push(elementWithId);
        }
        elementWithId.status = getAddStatus(isOrig, isPartOfMerge);
        return;
      }
    }
  }
  console.log("Failed to find element in " + listName + "[] with id " + elementWithId["id"]);
}

/**
 * Remove an element with a primary identifier matching that in elementListContainer[listName][0].identifiers["Primary"][0]
 * @param listContainer - Object (like a person) with a list
 * @param listName - Name of list (like "names" or "sources")
 * @param elementListContainer - Object from change log GedcomX with one element in the given list with an id.
 * @param isOrig - Flag for whether the change is happening during the initial creation of the person (part of its "original intended identity")
 */
function removeFromListByPrimaryIdentifier(listContainer, listName, elementListContainer, isOrig) {
  let existingList = listContainer[listName];
  if (existingList) {
    let identifierToRemove = getPrimaryIdentifier(elementListContainer[listName][0]);
    for (let i = 0; i < existingList.length; i++) {
      let entity = existingList[i];
      let existingIdentifier = getPrimaryIdentifier(entity);
      if (existingIdentifier === identifierToRemove) {
        if (setDeletedStatus(entity, isOrig)) {
          existingList.splice(i, 1);
        }
        return;
      }
    }
    console.log("Failed to find element in " + listName + "[] with id " + identifierToRemove);
  }
  else {
    console.log("Failed to find list '" + listName + "'");
  }
}

/**
 * Remove the element in listContainer[listName] that has the same id as elementListContainer[listName][0]
 *   with that element. For example, remove person["names"][2] if it has the same "id" element as elementListContainer["names"][0]
 * If isOrig is true, then instead of removing it, mark it as deleted.
 * @param listContainer - Object (like a person) that has a list named listName, containing elements with an 'id'.
 * @param listName - Name of list to look in
 * @param elementListContainer - Object (like a change log person) that has a list of the given name with a single entry.
 * @param isOrig - Flag for whether the change is happening during the initial creation of the person (part of its "original intended identity")
 */
function removeFromListById(listContainer, listName, elementListContainer, isOrig) {
  let existingList = listContainer[listName];
  if (existingList) {
    let idToRemove = elementListContainer[listName][0]["id"];
    for (let i = 0; i < existingList.length; i++) {
      let existingId = existingList[i]["id"];
      if (existingId && existingId === idToRemove) {
        if (setDeletedStatus(existingList[i], isOrig)) {
          existingList.splice(i, 1);
        }
        return;
      }
    }
  }
  console.log("Failed to element in list " + listName);
}

function doInList(listContainer, listName, elementListContainer, operation, isOrig, isPartOfMerge) {
  if (operation === "Create") {
    addToList(listContainer, listName, elementListContainer[listName][0], isOrig, isPartOfMerge);
  }
  else if (operation === "Update") {
    updateInList(listContainer, listName, elementListContainer, isOrig, isOrig, isPartOfMerge);
  }
  else if (operation === "Delete") {
    removeFromListById(listContainer, listName, elementListContainer, isOrig);
  }
}

function getFirst(list) {
  return list && list.length > 0 ? list[0] : null;
}

function copyObject(object) {
  return object ? JSON.parse(JSON.stringify(object)) : null;
}

// Copy the survivor's gedcomx object, mapping status to "merge-" + original status.
function copySurvivorGedcomx(gedcomx) {
  function mapStatus(obj) {
    if (obj && obj.status) {
      if (obj.status === ORIG_STATUS || obj.status === ADDED_STATUS || obj.status === DELETED_STATUS || obj.status === CHANGED_STATUS) {
        obj.status = "merge-" + obj.status;
      }
    }
  }

  gedcomx = copyObject(gedcomx);
  for (let person of getList(gedcomx, "persons")) {
    mapStatus(person.gender);
    for (let name of getList(person, "names")) {
      mapStatus(name);
    }
    for (let fact of getList(person, "facts")) {
      mapStatus(fact);
    }
    for (let source of getList(person, "sources")) {
      mapStatus(source);
    }
  }
  for (let relationship of getList(gedcomx, "relationships").concat(getList(gedcomx, CHILD_REL))) {
    mapStatus(relationship);
  }
  //future: Handle memories, too.
  return gedcomx;
}

// Add a fact to a relationship or update one.
function addFactToRelationship(gedcomx, entry, relationshipListName, resultingId, factKey, shouldUpdate, isOrig, isPartOfMerge) {
  let resultingRel = findEntity(entry, relationshipListName, resultingId);
  if (!resultingRel) {
    return;
  }
  let existingRel = findEntityByPrimaryIdentifier(getList(gedcomx, relationshipListName), getPrimaryIdentifier(resultingRel));

  if (existingRel) {
    if (shouldUpdate) {
      updateInList(existingRel, factKey, resultingRel, isOrig, isPartOfMerge);
    }
    else {
      addToList(existingRel, factKey, getList(resultingRel, factKey)[0], isOrig, isPartOfMerge);
    }
  }
  else {
    let relCopy = copyObject(resultingRel);
    delete relCopy["id"]; // get rid of temporary '.resulting' id
    addToList(gedcomx, relationshipListName, relCopy, isOrig, isPartOfMerge);
  }
}

function updateFactInRelationship(gedcomx, entry, relationshipListName, resultingId, factKey, isOrig, isPartOfMerge) {
  addFactToRelationship(gedcomx, entry, relationshipListName, resultingId, factKey, true, isOrig, isPartOfMerge);
}

function deleteFactFromRelationship(gedcomx, entry, relationshipListName, resultingId, factKey, isOrig) {
  let resultingRel = findEntity(entry, relationshipListName, resultingId);
  if (!resultingRel) {
    return;
  }
  let existingRel = findEntityByPrimaryIdentifier(getList(gedcomx, relationshipListName), getPrimaryIdentifier(resultingRel));

  if (existingRel) {
    removeFromListById(existingRel, factKey, resultingRel, isOrig);
  }
}

/**
 * Add or update the persons in the gedcomx referenced by the given relationship (except the main personId).
 * (Future: use relatives' own change log to show what they looked like at the time, instead of what they look like now.)
 * @param gedcomx - GedcomX to update
 * @param entry - Change log entry for a relationship change. Includes a snapshot of the persons involved in the relationship.
 * @param relationship - Relationship object found
 * @param isOrig - Flag for whether this update happened during the 'original identity' period of a person's creation.
 * @param isPartOfMerge - Flag for whether this update is happening because of data coming in during a merge.
 */
function updateRelatives(gedcomx, entry, relationship, isOrig, isPartOfMerge) {
  function addRelativeIdToList(relativeKey) {
    let relativeId = getRelativeId(relationship, relativeKey);
    if (relativeId && relativeId !== entry.personId) {
      relativeIds.push(relativeId);
    }
  }
  let relativeIds = [];
  addRelativeIdToList("person1");
  addRelativeIdToList("person2");
  addRelativeIdToList("parent1");
  addRelativeIdToList("parent2");
  addRelativeIdToList("child");
  for (let relativeId of relativeIds) {
    let relative = findPersonByLocalId(entry, relativeId);
    let foundRelative = false;
    for (let i = 0; i < gedcomx.persons.length && !foundRelative; i++) {
      if (gedcomx.persons[i].id === relativeId) {
        gedcomx.persons[i] = relative;
        foundRelative = true;
      }
    }
    if (!foundRelative) {
      relative.status = getAddStatus(isOrig, isPartOfMerge);
      gedcomx.persons.push(relative);
    }
  }
}

/*
   "Status" idea:
   - "orig": We want to show what a person looked like originally when first created (i.e., when migrated in 2012, or within
     24 hours of being created after that, and before ever being merged).
   - "deleted": But we also want to show what original information was deleted (shown in red or something),
     so instead of removing it from the GedcomX, we mark it with a status of 'deleted', so we can display it if needed.
     One exception is that if we are deleting something 'orig' within that first 24-hour period, we actually remove it,
     since the original identity didn't end up with it, either.
   - "added": We also want to show what information was added after that original identity period, so we can show
     that in a different color (like green) to indicate that it wasn't part of the original identity, but was added later.
      - If something with "added" gets deleted, we do actually remove it, because we don't need to show it as a removed
        part of the original identity. It actually goes away.
   - "changed": Since gender can only have one value, it is marked as "changed" if it has changed after the initial identity
       period. This only happens if it actually changed from Male to Female or vice-versa. "Unknown" is considered "deleted".
   - "merge-orig/added/deleted": After a merge, we want to know which things came in to the person as a result of a merge,
     including everything that "remained" on the survivor. These are marked with "merge-orig" for things that were "orig";
     "merge-added" for things that were added after the original identity, and "merge-deleted" for things that were once
     "orig" or "merge-orig" but were deleted before the most recent merge. When showing a merge node, we will generally
     not show any of the "merge-..." things, because they'll be shown below. But if we "roll up" the merge node, then
     all of these things are available to show.
   - When information is added to a merge node's GedcomX, the normal "added" tag is used.
   - If something is deleted that had a tag of "added", it is removed, since there's no need to display it at all.
   - If something is deleted that had a tag of "orig" or "merge-orig", it is marked with "deleted", since we need to show
     that it was part of the original identity but is now gone, whether it is rolled up (in which case this is the only
     way it will be shown) or not (in which case the original value is in a lower point in the hierarchy).
   - If something is deleted that had a tag of "merge-added", it is marked as "merge-deleted". It will need to be
      displayed when not rolled up, since it appears below, and we need to know it went away. But it can be hidden
      when rolled up, since it was not part of the original identity.
   - Fortunately, this isn't confusing at all.
 */
// (If you change any of these strings, update the corresponding class names in time-machine.css)
const ORIG_STATUS         = 'orig'; // Part of the original identity.
const ADDED_STATUS        = 'added'; // Added after original identity, or after most recent merge
const CHANGED_STATUS      = 'changed'; // Gender changed (M<=>F) after original identity, or after most recent merge.
const DELETED_STATUS      = 'deleted'; // Deleted a value added after the original identity, but before the most recent merge.
const MERGE_ORIG_STATUS   = 'merge-orig'; // On original identity and brought in during merge
const MERGE_ADDED_STATUS  = 'merge-added'; // Add after original identity and brought in during merge
const MERGE_DELETED_STATUS= 'merge-deleted'; // On original identity but deleted before the most recent merge

// Tell whether an object (fact or relationship) should be included, based on
// 1) 'status', the object's status and
// 2) the display options (shouldIncludeAdditions; shouldShowDeletions; shouldIncludeInfoFromMerge)
function shouldDisplayStatus(status) {
  if (!status || status === ORIG_STATUS) {
    return true;
  }
  switch(status) {
    case ADDED_STATUS:
    case CHANGED_STATUS:
      return displayOptions.shouldShowAdditions;
    case DELETED_STATUS:
      return displayOptions.shouldShowAdditions && displayOptions.shouldShowDeletions;
    case MERGE_ORIG_STATUS:
    case MERGE_ADDED_STATUS:
      return displayOptions.shouldRepeatInfoFromMerge;
    case MERGE_DELETED_STATUS:
      return displayOptions.shouldRepeatInfoFromMerge && displayOptions.shouldShowDeletions;
  }
  return true;
}

// See above for details on status.
// Update the given status from orig or merge-orig to deleted; or merge-added to merge-deleted.
// If 'isOrig' is true, then the deletion is being done during the original identity phrase, so the object can be actually deleted.
// Return true if the given entity should be actually deleted (i.e., if the status is "added" or isOrig is true), or false if it should be kept.
function setDeletedStatus(entity, isOrig) {
  let status = entity.status;
  if (status === ADDED_STATUS || isOrig) {
    return true;
  }
  else {
    if (status === ORIG_STATUS || status === MERGE_ORIG_STATUS) {
      status = DELETED_STATUS;
    }
    else if (status === MERGE_ADDED_STATUS) {
      status = MERGE_DELETED_STATUS;
    }
    else if (status === DELETED_STATUS || status === MERGE_DELETED_STATUS) {
      console.log("Deleting deleted gender");
    }
    else {
      console.log("Unrecognized status when deleting gender: " + status);
    }
    entity.status = status;
    return false;
  }
}

function getAddStatus(isOrig, isPartOfMerge) {
  if (isPartOfMerge) {
    return isOrig ? MERGE_ORIG_STATUS : MERGE_ADDED_STATUS;
  }
  return isOrig ? ORIG_STATUS : ADDED_STATUS;
}

/**
 * Apply one change log entry to the given GedcomX record in order to update it.
 * @param gedcomx - GedcomX record to update. Should already have the person for the entry, with the person identifier set.
 * @param entry - Change log entry to apply
 * @param isOrig - Flag for whether this change is part of an initial identity (before merging or 24 hours or end of 2012).
 */
function updateGedcomx(gedcomx, entry, isOrig) {
  let changeInfo = entry.changeInfo[0];
  // Create/Update/Delete/Merge
  let operation = extractType(getProperty(changeInfo, "operation"));
  let objectType = extractType(getProperty(changeInfo, "objectType"));
  let objectModifier = extractType(getProperty(changeInfo, "objectModifier"));
  let combo = operation + "-" + objectType;
  let resultingId = getProperty(changeInfo, operation === "Delete" ? "removed.resourceId" : "resulting.resourceId");
  let isPartOfMerge = entry.mergeSurvivorId || entry.mergeDuplicateId;

  if (operation === "Merge" && objectType === "Person") {
    // Nothing really to do when a merge comes in.
  }
  else if (operation === "Delete" && entry.personId === entry.mergeDuplicateId) {
    // Skip doing deletes off of the person being deleted during a merge, so we can see what they looked like before the merge.
  }
  else if (objectModifier === "Person" && objectType !== "NotAMatch") {
    let gxPerson = findPersonInGx(gedcomx, entry.personId);
    let entryPerson = findPersonByLocalId(entry, resultingId);
    if (entryPerson.hasOwnProperty("facts") && entryPerson.facts.length === 1) {
      combo = operation + "-" + "(Fact)";
    }
    switch (combo) {
      case "Create-Gender":
        gxPerson.gender = entryPerson.gender;
        gxPerson.gender.status = getAddStatus(isOrig, isPartOfMerge);
        break;
      case "Update-Gender":
        entryPerson.gender.status = oppositeGender(gxPerson.gender, entryPerson.gender) ? CHANGED_STATUS : getAddStatus(isOrig);
        gxPerson.gender = entryPerson.gender;
        break;
      case "Delete-Gender":
        if (setDeletedStatus(gxPerson["gender"], isOrig, isPartOfMerge)) {
          delete gxPerson["gender"];
        }
        break;
      case "Create-BirthName":
      case "Update-BirthName":
      case "Delete-BirthName":
        doInList(gxPerson, "names", entryPerson, operation, isOrig, isPartOfMerge);
        break;
      case "Create-SourceReference":
      case "Update-SourceReference":
      case "Delete-SourceReference":
        doInList(gxPerson, "sources", entryPerson, operation, isOrig, isPartOfMerge);
        break;
      case "Create-(Fact)":
        console.assert(entryPerson.hasOwnProperty("facts") && entryPerson.facts.length === 1, "Expected one fact in entry");
        console.assert(extractType(entryPerson["facts"][0].type) === objectType || objectType === "Fact", "Mismatched fact type in fact creation: " + extractType(entryPerson["facts"][0].type) + " != " + objectType);
        addFact(gxPerson, entryPerson.facts[0], isOrig, isPartOfMerge);
        break;
      case "Delete-(Fact)":
        doInList(gxPerson, "facts", entryPerson, operation, isOrig, isPartOfMerge);
        break;
      case "Create-Person":
      // Do nothing: We already have a GedcomX record with an empty person of this ID to start with.
      case "Create-EvidenceReference":
        // Do nothing: We aren't handling memories at the moment.
        break;
      default:
        console.log("Unimplemented change log entry type: " + combo + " for Person");
    }
  }
  else if (objectModifier === "Couple") {
    let resultingRelationship = findCoupleRelationship(entry, resultingId);
    updateRelatives(gedcomx, entry, resultingRelationship, isOrig, isPartOfMerge);
    if (resultingRelationship.hasOwnProperty("facts") && resultingRelationship.facts.length === 1) {
      combo = operation + "-" + "(Fact)";
    }
    switch (combo) {
      case "Restore-Couple":
      case "Create-Spouse1":
      case "Create-Spouse2":
      case "Update-Spouse1":
      case "Update-Spouse2":
        updateCoupleRelationship(gedcomx, entry, resultingId, isOrig, isPartOfMerge);
        break;
      case "Create-(Fact)":
        addFactToRelationship(gedcomx, entry, "relationships", resultingId, "facts", false, isOrig, isPartOfMerge);
        break;
      case "Update-(Fact)":
        updateFactInRelationship(gedcomx, entry, "relationships", resultingId, "facts", isOrig, isPartOfMerge);
        break;
      case "Delete-(Fact)":
        deleteFactFromRelationship(gedcomx, entry, "relationships", resultingId, "facts", isOrig);
        break;
      case "Delete-Couple":
        removeFromListByPrimaryIdentifier(gedcomx, "relationships", entry.content.gedcomx, isOrig);
        break;
      case "Create-SourceReference":
      case "Update-SourceReference":
      case "Delete-SourceReference":
        let existingRelationship = findEntityByPrimaryIdentifier(gedcomx.relationships, getPrimaryIdentifier(resultingRelationship));
        doInList(existingRelationship, "sources", resultingRelationship, operation, isOrig, isPartOfMerge);
        break;
      default:
        console.log("Unimplemented change log entry type: " + combo + " for Couple relationship");
    }
  }
  else if (objectModifier === "ChildAndParentsRelationship") {
    let resultingRelationship = findChildAndParentsRelationship(entry, resultingId);
    updateRelatives(gedcomx, entry, resultingRelationship, isOrig, isPartOfMerge);
    let factKey = resultingRelationship.hasOwnProperty("parent1Facts") ? "parent1Facts" : "parent2Facts"
    if (resultingRelationship.hasOwnProperty(factKey) && resultingRelationship[factKey].length === 1) {
      combo = operation + "-" + "(Fact)";
    }
    switch(combo) {
      case "Update-ChildAndParentsRelationship":
      case "Restore-ChildAndParentsRelationship":
      case "Create-Parent1":
      case "Create-Parent2":
      case "Create-Child":
      case "Update-Parent1":
      case "Update-Parent2":
      case "Update-Child":
        // Go ahead and deal with child-and-parents relationships, since that is how the change log operates.
        updateChildAndParentsRelationship(gedcomx, entry, resultingId, isOrig, isPartOfMerge);
        break;
      case "Create-(Fact)":
        addFactToRelationship(gedcomx, entry, CHILD_REL, resultingId, factKey, false, isOrig, isPartOfMerge);
        break;
      case "Update-(Fact)":
        updateFactInRelationship(gedcomx, entry, CHILD_REL, resultingId, factKey, isOrig, isPartOfMerge);
        break;
      case "Delete-(Fact)":
        deleteFactFromRelationship(gedcomx, entry, CHILD_REL, resultingId, factKey, isOrig);
        break;
      case "Delete-ChildAndParentsRelationship":
        removeFromListByPrimaryIdentifier(gedcomx, CHILD_REL, entry.content.gedcomx, isOrig);
        break;
      case "Create-SourceReference":
      case "Update-SourceReference":
      case "Delete-SourceReference":
        let existingRelationship = findEntityByPrimaryIdentifier(gedcomx[CHILD_REL], getPrimaryIdentifier(resultingRelationship), isOrig, isPartOfMerge);
        doInList(existingRelationship, "sources", resultingRelationship, operation);
        break;
      default:
        console.log("Unimplemented change log entry type: " + combo + " for ChildAndParentsRelationship");
    }
  }
}

function getHelpViewHtml() {
  return `<div class="help">Welcome to the "munged" person splitter prototype!<br>
<h2>Introduction</h2>
<p>Any family tree system can have "munged" person entries that contain information about two or more real humans.
This can come to pass in at least two ways:</p>
<ol>
  <li>A <b>bad merge</b>, i.e., merging two person entries together that really represent two different real humans.</li>
  <li><b>Organically</b>, by adding information about two real humans to the same person entry.</li>
</ol>
<p>"Information" here refers to names, gender, events (like birth or death), characteristics (like occupation),
relationships, source attachments, etc.</p>
<p>Fixing a munged person is often done in several steps:</p>
<ol>
  <li><b>Group</b> the original identities and/or attached sources into those that belong to the same real humans.</li>
  <li><b>Assign</b> information to the "remaining" or "split-out" persons.</li>
  <li><b>Create</b> a new person (or restore a previously-existing one) and move information over to them.</li>
</ol>
<p>This prototype explores how we might <b>group</b> identities and sources, and <b>assign</b> bits of information
in a helpful, efficient and hopefully non-error-prone way. It is <i>not</i> intended to be announcement of any
particular upcoming feature at FamilySearch. While it reads information from Family Tree, it does not actually
update the Family Tree data. That being said, it may be useful in analyzing real cases in order to better fix them
manually for now.</p>
<h2>Instructions</h2>
<p>To use this prototype, first log in to FamilySearch. Then replace the "PID" parameter in the URL with the person
ID of someone in Family Tree that may be munged. Then explore the data in each of the various tabs.</p>
<h3>Display options</h3>
On most of the views, you can do the following:
<ul>
  <li><b>Resize</b>. Drag the column headers to resize the columns.</li>
  <li><b>Sort</b>. Click on a column header to sort (except in Merge view). Click on the "place" word to sort by place.</li>
  <li><b>Select</b>. Click on a row to select or deselect it. Shift-click to select a range of rows.</li>
  <li><b>Group</b>. Click "Create Group" to move the selected rows to a new group, or "Add to group" to add selected rows to it.
    <ul><li>Click on the name of the group to give it a helpful name or add notes.</li></ul>
  </li>
  <li><b>Notes</b>. Click on a cell in the "Notes" field to add a note. (Rich edit like bold and italics are available).</li>
  <li><b>Apply</b>. Click the red "Apply to Split" button to infer what information should be kept/copied/split out in the Split view.</li>
  <li><b>Display options</b>. The display options at the top show or hide information, so you can change your focus and fit things on the screen.
    <ul>
        <li>Facts: display All facts, just vitals (Birth, christening, death, burial and marriage), or no events.</li>
        <li>Show additions: Show information that was added after a person was originally created (i.e., after 24 hours).
            This information has a "+" in front of it.</li>
        <li>Repeat info from merge (Merge view only): Show/hide information that came in only because of the merge.
        When off, only data added after a merge appears on the merge node.</li>
        <li>Include deletions: Show information that was deleted off of the person, as red with strikethrough.</li>
        <li>Show children: Show/hide children, since sometimes they are necessary for decisions, but other times
            they take up too much room to focus on other things.</li>
    </ul>
  </li>
</ul>
<h3>Change Log</h3>
<p>This tab shows all the change log entries for each of the person IDs that have been merged
  together into the current "survivor". It is not meant to be especially helpful with fixing a munged person,
  but was a helpful step in developing the prototype. The entries are sorted with the most recent first and the earliest at
  the bottom. The person IDs are arranged with earliest to get merged out of existence on the right. Hover
  over a change log entry to get a pop-up view of details on that change entry.</p>
<h3>Merge View</h3>
This tab shows a merge hierarchy, showing what the merged persons looked like originally, and how and when they
merged over time.
<ul>
  <li>Click a row to select that row and all the rows that merged into it. Click on child rows to deselect those)</li>
  <li>The red-ish person IDs on the left are the "duplicates" in a merge, and the green ones are the winning "survivors".
  Note that the survivor reuses the same person ID, so a (v2), (v3), etc., is used to distinguish different
  instances of the same person ID.</li>
  <li>Click on the red "Apply selected rows to Split" button to apply information from the
      currently-selected rows to the Split view.</li>
</ul>
<h3>Flat view</h3>
Similar to the Merge view, but only the "leaf nodes" are shown, and sorting and grouping are supported.
<h3>Sources view</h3>
Shows the attached sources and the information that each contains about the person and their relatives.
<ul>
  <li>Sort by "Record Date" to get a good chronological timeline for the person.</li>
  <li>Click on the collection name to open that source in a new tab.</li>
</ul>
<h3>Combo view (usually best)</h3>
Combines the Flat view and Sources view.
<ul>
  <li>Sort by Person Id to sort the Family Tree persons by person ID, and then show under each of them, which
  sources were first attached to that person ID (and sort those by record date).</li>
  <li>This is probably the best view to work in most of the time, as it lets you use the sources to make good
  decisions, but also lets you decide on the Family Tree persons as well.</li>
</ul>
<h3>Split view</h3>
<p>This screen lets you decide, for every bit of information, whether it should remain with the existing person,
be split out to the new person, or be copied so that it is on both (like is typically done with the gender).</p>
<p>Since it would be difficult to know how to best split things up if doing it by hand, use one of the other
  views and click on "Apply to Split" to pre-populate the decisions in the Split view, and then fine-tune it by hand.</p>
<ul>
  <li>Click &lt;, = or &gt; to keep, copy or split out a piece of information.</li>
  <li>Click the "+"/"-" buttons to show/hide names and facts that appear in sources or earlier versions of a
  Family Tree person, but which are not currently on the latest person.</li>
  <li>Check boxes next to any of those "hidden" values to show that they should be kept/added.</li>
  <li>Sometimes you'll have to choose which value (like which of several possible birth dates) you want
  to choose for one person or the other.</li>
</ul>
<h3>Actually fixing a munged person</h3>
The tool unfortunately does not actually split a person for real at this time. It is meant to be a prototype to
quickly explore ideas on how to help someone quickly and correctly split a munged person. For now, you can use
it to figure out what the persons are supposed to look like, and then do a "restore" on one of the former persons
and use this tool to help you add missing information to the restored person, and remove wrong information from
the remaining one.
<h3>Feedback</h3>
If you have questions, feedback or suggestions on this prototype, please send e-mail to 
<a href="mailto:wilsonr@familysearch.org">Randy Wilson</a>.</div>`;
}
