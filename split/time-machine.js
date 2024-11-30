/* Lickety-Splitter - A tool for splitting merged persons in FamilySearch.
   By Randy Wilson, 2023-2024.
 */

// IDs to try out:
//   LZBY-X8J - Clarence Gray. 5 PIDs that all merge into the same one. (Wife Bertha Nickell (later Bishop): L2DF-DRG)
//   9HMF-2S1 - Alice Moore. Example from Kathryn
//  *G2FN-RZY - Theoore Freise, which Robby and Karl were working on. Has lots of data and persons added after some merging.
//   KWNR-S97 - John Taylor. We need to support attached sources w/o indexed personas.
//   G92P-752 - Broken for Robby
//   KWNR-ZYT - Ineffective (duplicate) ordinances
//   LZ62-TSV - Charlemagne. 13000 merges.
//   L25C-9Z7 - Guy with multiple ordinances.
//   GT54-3CQ - Guy with stapled ordinances & a Restore
//   LBNB-8MR - Kaziah Anderson. 2 ows, 1 note, main ID not first in list.

/*
  Cases still not handled yet:
  - Cases where any of the persons in the merge hierarchy have a "Restore".
  - Persons with Memories on them. (Still need to display those and let the user decide where they go).
 */

/* Still to do:
 = Call split endpoint.
 - Handle "Restore". Currently, a restored person causes persons and their sources and ordinances to appear twice in the combo view.
 - Memory rows
 - Include deleted relationships
 - Use higher-level nodes in combo view (to include conclusions added after first 24 hours)
 - Select rows
   - Drag to move to new or existing group
   - Double-click value to select everyone with that value
 - Collapse merge node (and summarize all info in that one row).
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
let $statusDiv = null;

// Flag for whether there is a 'restore' in any of the change logs. If so, we can't handle splitting yet.
let hasRestoreInChangeLog = false;

// Fetch the change log entries for the person given by the change log URL.
function buildSplitter(changeLogUrl, sessionId, $mainTable, $status, shouldFetchOrdinances) {
  $statusDiv = $status;
  let context = parsePersonUrl(changeLogUrl);
  mainPersonId = context.personId;
  if (sessionId) {
    context["sessionId"] = sessionId;
  }

  // Map of personId -> array of change log entries for that person, most recent first.
  let changeLogMap = {};
  // List of urls currently being fetched.
  let fetching = [];

  updateStatus("Fetching change logs...");
  // Recursively fetch this person's change log and that of anyone merged in.
  // Once last change log has been fetched, the last ajax call will call makeChangeLogHtml()
  fetchChangeLog(context.personId, context, changeLogMap, fetching, $mainTable, null, shouldFetchOrdinances);
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
    this.stapledOrdinancePersonId = null; // See notes on getStapledOrdinancePersonId()
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
const SPLIT_PERSON_ID = "<New ID>";

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
  animateRows(comboGrouper);
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
      if (entry.changeInfo && entry.changeInfo.length > 0 && entry.changeInfo[0].operation && entry.changeInfo[0].operation.endsWith("/Merge")) {
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

function updateStatus(message) {
  $statusDiv.append(encode(message) + "<br/>\n");
}

function setStatus(message) {
  $statusDiv.html(encode(message));
}

function clearStatus() {
  $statusDiv.html("");
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
    console.log("Warning: Got " + entry.changeInfo.length + " elements in entry.changeInfo[]. Only expected 1");
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
          html += changeHtml(operation, getNameChangeHtml(originalPerson), getNameChangeHtml(resultingPerson), false);
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
            html += changeHtml(operation, getFactsHtml(originalPerson, true), getFactsHtml(resultingPerson, true), false);
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

function getFactsHtml(entity, includeFactId, key="facts") {
  if (hasFact(entity, key)) {
    let factHtmlList = [];
    for (let fact of entity[key]) {
      factHtmlList.push(getFactHtml(fact, false, includeFactId));
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

function getFactHtml(fact, ignoreStatus, includeFactId) {
  let type = extractType(fact.type);
  let date = fact.date ? fact.date.original : null;
  let place = fact.place ? trimPlace(fact.place.original) : null;
  let value = fact.value ? fact.value : null;
  let statusClass = (fact.status && !ignoreStatus) ? " " + fact.status : "";
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
  if (includeFactId && fact.id) {
    html += "<br>&nbsp;&nbsp;<span class='conclusion-id'>" + encode("Fact id: " + fact.id) + "</span>";
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
    + "<td>" + getFactsHtml(rel, false, factKey) + "</td>"
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
    this.isInitialIdentity = !survivorMergeNode && !duplicateMergeNode;

    this.parentNode = null;
    this.prevNode = survivorMergeNode;
    this.dupNode = duplicateMergeNode;
    this.indent = "";
  }

  isLeafNode() {
    return !this.prevNode && !this.dupNode;
  }

  isLatestVersion() {
    return !this.parentNode || this.parentNode.personId !== this.personId;
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
  constructor(person, nameClass, status, coupleRelationship, shouldIncludeId, childAndParentsRelationship) {
    this.person = person;
    this.name = "<span class='" + nameClass + (status ? " " + status : "") + "'>" + encode(getPersonName(person)) + "</span>";
    this.coupleRelationship = coupleRelationship;
    this.childAndParentsRelationship = childAndParentsRelationship;
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

  getBirthDateNumber(child) {
    let person = child.person;
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

  sortChildren() {
    minimalSort(this.children, this.getBirthDateNumber);
  }
}

// Sort the given list according to the given sort key function, while keeping the elements in as much the same order
//   as possible when there are equal values or no sort keys on some elements.
// Any element that is out of order will be moved up in the list just enough to be before any that are "greater than" it.
function minimalSort(list, getSortNumberFunction) {
  // Sort by (a) sort key, and, if equal, then by (b) original order.
  function compareSortObjects(a, b) {
    let diff = a.sortKey - b.sortKey;
    if (diff === 0) {
      return a.originalIndex - b.originalIndex;
    }
    return diff;
  }

  //--- minimalSort ---
  // Create sort objects
  let sortObjects = [];
  let sortObjectsWithKeys = [];
  for (let i = 0; i < list.length; i++) {
    let sortObject = {
      originalIndex: i,
      minPos: null, // position of the earliest element that is greater than this one
      sortKey: getSortNumberFunction(list[i]),
      element: list[i]
    }
    sortObjects.push(sortObject);
    if (sortObject.sortKey) {
      sortObjectsWithKeys.push(sortObject);
    }
  }

  if (sortObjectsWithKeys.length === 0) {
    // No sort keys, so no sorting needed.
    return;
  }

  sortObjectsWithKeys.sort(compareSortObjects);
  let movedAny = false;
  // Set minPos to be the place where each element (with a sort key) should be moved to.
  let nextObject = sortObjectsWithKeys[sortObjectsWithKeys.length - 1];
  for (let i = sortObjectsWithKeys.length - 2; i >= 0; i--) {
    let sortObject = sortObjectsWithKeys[i];
    if (sortObject.originalIndex > nextObject.originalIndex) {
      sortObject.minPos = nextObject.minPos;
      movedAny = true;
    }
    nextObject = sortObject;
  }

  let sortedObjects = [];
  let withKeysIndex = 0;

  for (let i = 0; i < sortObjects.length; i++) {
    let sortObject = sortObjects[i];
    if (sortObject.minPos === i) {
      // This element is the earliest one that others may be getting inserted in front of.
      while (withKeysIndex < sortObjectsWithKeys.length && sortObjectsWithKeys[withKeysIndex].minPos === i) {
        sortedObjects.push(sortObjectsWithKeys[withKeysIndex++]);
      }
    }
    else if (sortObject.minPos === null) {
      sortedObjects.push(sortObject);
    }
  }
  if (sortedObjects.length !== list.length) {
    console.log("Error: sortedObjects.length (" + sortedObjects.length + ") !== list.length (" + list.length + ")");
  }
  if (movedAny) {
    for (let i = 0; i < list.length; i++) {
      list[i] = sortedObjects[i].element;
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
  if (event.shiftKey) {
    grouper.selectUntil(rowId);
  }
  else {
    grouper.toggleRow(rowId);
  }
}

// Referenced from 'clickInfo()', but IntelliJ doesn't recognize that.
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
// Map of groupId (and also personRowId and grouperId and tabId) -> Grouper object that the groupId or person row is found in.
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
    // Flag for whether to show summaries of 'keep' and 'split' just above the split group (if any).
    this.shouldShowSummaries = false;
    // Flag for whether to show hidden values in the summary rows in the combo view. (Does not affect split view).
    this.shouldExpandHiddenValues = false;
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
  function updateIfVisible(divId, currentValue) {
    let checkbox = $("#" + divId);
    let state = checkbox ? checkbox.prop("checked") : undefined;
    if (state === undefined) {
      checkbox = $("#v-" + divId);
      state = checkbox ? checkbox.prop("checked") : undefined;
    }
    return state === undefined ? currentValue : state;
  }
  displayOptions.factsToInclude = $("input[name = 'fact-level']:checked").val();
  displayOptions.shouldShowChildren = $("#children-checkbox").prop("checked");
  displayOptions.shouldRepeatInfoFromMerge = $("#merge-info-checkbox").prop("checked");
  displayOptions.shouldShowAdditions = $("#additions-checkbox").prop("checked");
  displayOptions.shouldShowDeletions = $("#deletions-checkbox").prop("checked");
  let prevVertical = displayOptions.vertical;
  displayOptions.vertical = $("#vertical-checkbox").prop("checked");
  if (prevVertical !== displayOptions.vertical) {
    resetAnimation = true;
  }
  displayOptions.shouldShowSummaries = updateIfVisible("summary-checkbox", displayOptions.shouldShowSummaries);
  displayOptions.shouldExpandHiddenValues = updateIfVisible("show-extra-values-checkbox", displayOptions.shouldExpandHiddenValues);
  updatePersonFactsDisplay();
  updateIncludedColumns();
  updateTabsHtml();
  displayAvailableOptions();
}

function displayAvailableOptions() {
  let activeTab = getCurrentTab();
  setVisibility("settings", activeTab !== CHANGE_LOG_VIEW && activeTab !== SPLIT_VIEW);
  setVisibility("vertical-option", activeTab === FLAT_VIEW || activeTab === SOURCES_VIEW || activeTab === COMBO_VIEW || activeTab === HELP_VIEW);
  setVisibility("repeat-info-option", true);
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
    // groupId of the group that has most recently had its "Split on Group" button clicked.
    this.splitGroupId = null;
    // Flag for whether to show 'keep' summary and 'split' summary just above the split group (if any).
    this.showSummaries = false;
    for (let mergeRow of mergeRows) {
      grouperMap[mergeRow.id] = this;
    }
    grouperMap[this.id] = this;
    grouperMap[tabId] = this;
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
    console.log("Could not find row with id " + rowId);
    return null;
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
          mergeRow.deselect(true);
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

  isMainPersonIdSelected() {
    for (let group of this.mergeGroups) {
      for (let mergeRow of group.personRows) {
        if (mergeRow.isSelected && mergeRow.personId === mainPersonId && mergeRow.mergeNode && !mergeRow.mergeNode.parentNode) {
          return true;
        }
      }
    }
    return false;
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
  constructor(mergeNode, personId, gedcomx, indent, maxIndent, isDupNode, grouper, sourceInfo, parentRow, ows, summaryDir, isNoteRow) {
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
    this.summaryDirection = summaryDir; // DIR_KEEP or DIR_SPLIT for keep vs. split person summary row. Null if not summary row.
    this.stapledRows = null; // list of other PersonRows that are "stapled" to this one and must be kept in the same group.
    this.isNoteRow = isNoteRow; // flag for whether this is just a "Note" row, so gedcomx has 1 person with only "notes".
    this.isNoteCollapsed = false;
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
    function personIdAndRecordDate(personId, sourceInfo, ows, isNoteRow) {
      let recordDateSortKey = getRecordDateSortKey(sourceInfo, ows);
      let sortPersonId = sourceInfo && sourceInfo.attachedToPersonId ? sourceInfo.attachedToPersonId : personId;
      if (ows && ows.originalPersonId) {
        sortPersonId = ows.originalPersonId;
      }
      if (sortPersonId === mainPersonId) {
        sortPersonId = "_" + sortPersonId; // make the main person ID sort on top.
      }
      return sortPersonId + (isNoteRow ? "note" : "") + (isEmpty(recordDateSortKey) ? "" : "_" + recordDateSortKey);
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
      case COLUMN_PERSON_ID:          sortKey = personIdAndRecordDate(this.personId, this.sourceInfo, this.ows, this.isNoteRow); break;
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
    if (sortKey === "<no name>") {
      sortKey = null; // Make no-name items sort to bottom.
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
          familyDisplay.children.push(new PersonDisplay(findPersonInGx(gedcomx, childId), "child", relationship.status,null, includePersonId, relationship)); // future: add lineage facts somehow.
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

  getRowPersonCells(gedcomx, personId, rowClass, usedColumns, bottomClass, allRowsClass, rowSpan, splitDirection) {
    function addColumn(key, rowspan, content, extraClass) {
      if (usedColumns.has(key)) {
        html += "<td class='" + rowClass + extraClass + "'" + rowspan + ">" + (content ? content : "") + "</td>";
      }
    }

    // htmlHolder is an array of 0 or 1 HTML strings. If not empty, and we're adding a new row, add this just before closing the row.
    function startNewRowIfNotFirst(isFirst, rowClass, htmlHolder, isSummaryRow) {
      if (!isFirst) {
        if (htmlHolder.length > 0) {
          html += htmlHolder.pop();
        }
        html += "</tr>\n";
        if (isSummaryRow) {
          html += "<tr class='summary-row'>";
        }
        else {
          html += "<tr" + (rowClass ? " class='" + rowClass + "' onclick='handleRowClick(event, \"" + rowClass + "\")'" : "") + ">";
        }
      }
      return false;
    }

    function getButtonsHtml(item, isKeep) {
      let element = split.elements[item.elementIndex];
      // Up, =, down buttons
      let buttonsHtml = (isKeep ? "" : makeButton("↑", DIR_KEEP, element))
        + makeButton("=", DIR_COPY, element)
        + (isKeep ? makeButton("↓", DIR_MOVE, element) : "") + " ";
      if (displayOptions.shouldExpandHiddenValues) {
        const elementId = 'element-checkbox-' + element.elementIndex
        // Add checkbox for information that is not on the current merged person.
        buttonsHtml += "<input id='" + elementId + "'"
          + (element.isExtra() ? "" : " class='current-value-checkbox'")
          + " type='checkbox' onchange='toggleElement(" + element.elementIndex + ")'"
          + (element.isSelected ? " checked" : "") + "> "
          + "<label for='" + elementId + "'></label>"; // so that label::before works in current-value-checkbox class.
      }
      return buttonsHtml;
    }

    function shouldDisplaySummaryElement(objectWithElementIndex) {
      let element = split.elements[objectWithElementIndex.elementIndex];
      return element.isVisible() || displayOptions.shouldExpandHiddenValues;
    }

    // Wrap the contents of a table cell in a div with an id that can be used to animate the cell's contents.
    // item: the object with an elementIndex that this cell is displaying, representing an element in the Split object.
    // isKeep: true if this cell is displaying the 'keep' version of the element, false if it's displaying the 'split' version.
    // contentHtml: the HTML content of the cell to display.
    // isFacts: true if this cell is displaying facts for a spouse or child (which is not an independently-selectable element
    //          and thus doesn't have its own buttons or element id. These divs will get an id ending in ".facts")
    function wrapElement(item, isKeep, contentHtml, isFacts) {
      let cellId = getCellId(item.elementIndex, isKeep, isFacts);
      return "<div class='element-wrapper' id='" + cellId + "'>"
        + (isFacts ? "" : getButtonsHtml(item, isKeep)) + contentHtml + "</div>";
    }

    function getSummaryNamesHtml(person) {
      function getNameFormsHtml(name) {
        // Combine multiple name forms into a single string separated by "/", like "Kim Jeong-Un / 김정은 / 金正恩".
        let nameFormHtmls = [];
        for (let nameForm of getList(name, "nameForms")) {
          nameFormHtmls.push(nameForm.fullText ? nameForm.fullText : "<unknown>");
        }
        return encode(nameFormHtmls.join(" / "));
      }

      let namesHtml = "<td class='" + rowClass + bottomClass + "'" + rowSpan + ">";
      if (person.names && person.names.length > 0) {
        let namesHtmlList = [];
        for (let n = 0; n < person.names.length; n++) {
          let name = person.names[n];
          if (shouldDisplaySummaryElement(name)) {
            namesHtmlList.push(wrapElement(name, splitDirection === DIR_KEEP, getNameFormsHtml(name)));
          }
        }
        namesHtml += namesHtmlList.join("<br>");
      }
      else {
        namesHtml += encode("<no name>");
      }
      return namesHtml + "</td>\n";
    }

    function getSummaryFactsHtml(person) {
      let factsHtml = "<td class='" + rowClass + bottomClass + "'" + rowSpan + ">";
      if (person.facts && person.facts.length > 0) {
        for (let fact of person.facts) {
          if (shouldDisplaySummaryElement(fact)) {
            factsHtml += wrapElement(fact, splitDirection === DIR_KEEP, getFactHtml(fact, true, false)) + "<br>";
          }
        }
      }
      return factsHtml + "</td>\n";
    }

    function getSummaryParentsHtml(direction) {
      if (usedColumns.has("father-name") || usedColumns.has("mother-name")) {
        // Instead of a list of father names in one column, and a list of mother names in the other,
        //   put each pair of parents on each line, like "Fred Williams & Judy Smith", and let the couple be selectable.
        let parentsHtml = "<td class='" + rowClass + bottomClass + "'" + rowSpan +
          (usedColumns.has("father-name") && usedColumns.has("mother-name") ? " colspan='2'" : "") + ">";
        for (let element of split.elements) {
          if (element.type === TYPE_PARENTS && (element.direction === direction || element.direction === DIR_COPY)) {
            parentsHtml += wrapElement(element, direction === DIR_KEEP, getParentsHtml(element.item, encode(" & "))) + "<br>\n";
          }
        }
        return parentsHtml + "</td>\n";
      }
    }

    function getNoteColspan() {
      let colspan = 1; // name
      for (let column of [COLUMN_PERSON_FACTS, COLUMN_FATHER_NAME, COLUMN_MOTHER_NAME,
        COLUMN_SPOUSE_NAME, COLUMN_SPOUSE_FACTS, COLUMN_CHILD_NAME, COLUMN_CHILD_FACTS]) {
        if (usedColumns.has(column)) {
          colspan++;
        }
      }
      return colspan > 1 ? " colspan='" + colspan + "'" : "";
    }

    // === getRowPersonCells ===
    let html = "";
    if (this.isSummaryRow()) {
      html += getSummaryNamesHtml(this.person);
      html += getSummaryFactsHtml(this.person);
      html += getSummaryParentsHtml(splitDirection);
    }
    else if (this.isNoteRow) {
      html += "<td class='note-row " + rowClass + bottomClass + "'" + getNoteColspan() + " id='note-row-cell-" + this.id + "'>" +
        this.getNoteRowContentHtml() + "</td>\n";
    }
    else {
      html += "<td class='" + rowClass + bottomClass + "'" + rowSpan + ">" + this.personDisplay.name + "</td>\n";
      addColumn("person-facts", rowSpan, this.personDisplay.facts, bottomClass);
      addColumn("father-name", rowSpan, this.combineParents(this.fathers), bottomClass);
      addColumn("mother-name", rowSpan, this.combineParents(this.mothers), bottomClass);
    }

    let isFirstSpouse = true;
    let noteCellHtmlHolder = this.getNoteCellHtml(rowClass, bottomClass, rowSpan);

    if (this.families.length > 0 && !this.isNoteRow) {
      for (let spouseIndex = 0; spouseIndex < this.families.length; spouseIndex++) {
        let spouseFamily = this.families[spouseIndex];
        isFirstSpouse = startNewRowIfNotFirst(isFirstSpouse, allRowsClass, noteCellHtmlHolder, this.isSummaryRow());
        let familyBottomClass = spouseIndex === this.families.length - 1 ? bottomClass : "";
        let childrenRowSpan = getRowspanParameter(displayOptions.shouldShowChildren ? spouseFamily.children.length : 1);

        let spouseNameHtml = spouseFamily.spouse ? spouseFamily.spouse.name : "";
        let spouseFactsHtml = spouseFamily.spouse ? spouseFamily.spouse.facts : "";
        if (this.isSummaryRow()) {
          // Wrap the spouse name and facts in a div that can be animated. Also add buttons to the spouseNameHtml.
          spouseNameHtml = wrapElement(spouseFamily.spouse.coupleRelationship, splitDirection === DIR_KEEP, spouseNameHtml);
          spouseFactsHtml = wrapElement(spouseFamily.spouse.coupleRelationship, splitDirection === DIR_KEEP, spouseFactsHtml, true);
        }
        addColumn("spouse-name", childrenRowSpan, spouseNameHtml, familyBottomClass);
        addColumn("spouse-facts", childrenRowSpan, spouseFactsHtml, familyBottomClass);

        if (spouseFamily.children.length > 0 && displayOptions.shouldShowChildren) {
          let isFirstChild = true;
          for (let childIndex = 0; childIndex < spouseFamily.children.length; childIndex++) {
            let child = spouseFamily.children[childIndex];
            isFirstChild = startNewRowIfNotFirst(isFirstChild, allRowsClass, noteCellHtmlHolder, this.isSummaryRow());
            let childBottomClass = childIndex === spouseFamily.children.length - 1 ? familyBottomClass : "";

            let childNameHtml = child.name;
            let childFactsHtml = child.facts;
            if (this.isSummaryRow()) {
              // Wrap the child name and facts in a div that can be animated. Also add buttons to the childNameHtml.
              childNameHtml = wrapElement(child.childAndParentsRelationship, splitDirection === DIR_KEEP, childNameHtml);
              childFactsHtml = wrapElement(child.childAndParentsRelationship, splitDirection === DIR_KEEP, childFactsHtml, true);
            }
            addColumn(COLUMN_CHILD_NAME, "", childNameHtml, childBottomClass);
            addColumn(COLUMN_CHILD_FACTS, "", childFactsHtml, childBottomClass);
          }
        } else {
          addColumn(COLUMN_CHILD_NAME, "", "", familyBottomClass);
          addColumn(COLUMN_CHILD_FACTS, "", "", familyBottomClass);
        }
      }
    }
    else if (!this.isNoteRow) {
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
    clearStatus();
    if (!this.isSelected) {
      $("." + this.id).addClass(ROW_SELECTION);
      $("." + this.getIdClass().trim()).addClass(ROW_SELECTION);
      this.isSelected = true;
      for (let childRow of this.childRows) {
        childRow.select();
      }
      if (this.stapledRows) {
        for (let stapledRow of this.stapledRows) {
          stapledRow.select();
        }
        setStatus("Extraction ordinances and corresponding sources will be kept together.");
      }
    }
  }

  deselect(shouldIgnoreStapled) {
    clearStatus();
    if (this.isSelected) {
      $("." + this.id).removeClass(ROW_SELECTION);
      $("." + this.getIdClass()).removeClass(ROW_SELECTION);
      this.isSelected = false;
      for (let childRow of this.childRows) {
        childRow.deselect();
      }
      if (!shouldIgnoreStapled && this.stapledRows) {
        for (let stapledRow of this.stapledRows) {
          stapledRow.deselect();
        }
      }
    }
  }

  isSourceRow() {
    return this.sourceInfo;
  }

  isOwsRow() {
    return this.ows;
  }

  isSummaryRow() {
    return this.summaryDirection;
  }

  getIdClass() {
    return "cell-" + this.id;
  }

  getCellClass(tabId) {
    let cellClass;
    if (this.isSummaryRow()) {
      cellClass = "summary-row";
    }
    else if (this.isSourceRow()) {
      cellClass = "source-row";
    }
    else if (this.isOwsRow()) {
      cellClass = "ord-row";
    }
    else if (this.isNoteRow) {
      cellClass = "note-row";
    }
    else {
      cellClass ="merge-id" + (tabId === MERGE_VIEW && this.isDupNode ? "-dup" : "");
    }
    return cellClass + " " + this.getIdClass();
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
    else if (this.summaryDirection === DIR_KEEP) {
      html += "<b>Person to keep</b>";
    }
    else if (this.summaryDirection === DIR_MOVE) {
      html += "<b>Person to split out</b>";
    }
    else if (this.isNoteRow) {
      html += "Note: " + this.getNoteSubjectHtml();
    }
    return html + "</td>";
  }

  getNoteSubjectHtml() {
    let noteSubject = this.gedcomx.persons[0].notes[0].subject;
    return noteSubject ? encode(noteSubject) : "";
  }

  getNoteRowContentHtml() {
    let text = this.gedcomx.persons[0].notes[0].text;
    if (!text) {
      return "";
    }
    let html = "";
    if (text.length > 120 || text.includes("\n")) {
      html += "<img alt='" + (this.isNoteCollapsed ? "(more)" : "(less)")
        + "' class='arrow-image' src='https://familysearch.github.io/gedcomx-viewer/graph/images/arrows/" + (this.isNoteCollapsed ? "right" : "down")
        + ".png' onclick='toggleCollapseNote(event, \"" + this.id + "\")'>";
      if (this.isNoteCollapsed) {
        if (text.length > 120) {
          text = text.substring(0, 120) + "...";
        }
        if (text.includes("\n")) {
          text = text.replace(/\n[\s\S]*/, "...");
        }
      }
    }
    return html + encode(text).replaceAll("\n", "<br>");
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
    if (this.isSourceRow() || this.isOwsRow() || this.isNoteRow) {
      let personId = this.getPersonId();
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

  getPersonId() {
    if (this.isSourceRow()) {
      return this.sourceInfo.attachedToPersonId;
    }
    if (this.isOwsRow()) {
      return this.ows.originalPersonId;
    }
    return this.personId;
  }

  // get HTML for this person row
  getHtml(usedColumns, tabId, isKeep) {
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
    let html;
    if (this.isSummaryRow()) {
      html = "<tr class='summary-row'>";
    }
    else {
      html = "<tr class='" + this.id + "' onclick='handleRowClick(event, \"" + this.id + "\")' id='" + getRowId(tabId, this.id) + "'>";
    }
    let shouldIndent = tabId === MERGE_VIEW;
    let colspan = shouldIndent ? " colspan='" + (1 + this.maxIndent - this.indent.length) + "'" : "";
    let bottomClass = " main-row";
    let rowClasses = "class='" + this.getCellClass(tabId) + bottomClass + "'";

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
    let rowClass = this.isNoteRow ? 'note-row' : 'identity-gx';
    html += this.getRowPersonCells(this.gedcomx, this.personId, rowClass, usedColumns, bottomClass, this.id, rowSpan, isKeep ? DIR_KEEP : DIR_MOVE);
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
  // Add an ordinance PersonRow as a "child" of a FT person row.
  addOwsChild(owsPersonRow) {
    this.childOwsRows.push(owsPersonRow);
  }
}

function toggleCollapseNote(event, rowId) {
  doNotSelect(event);
  let personRow = personRowMap[rowId];
  if (personRow) {
    personRow.isNoteCollapsed = !personRow.isNoteCollapsed;
    $("#note-row-cell-" + rowId).html(personRow.getNoteRowContentHtml());
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
  fixMergeNodeEventOrder(latestMergeNode);
  return latestMergeNode;
}

function fixMergeNodeEventOrder(mergeNode) {
  if (mergeNode.gedcomx) {
    fixEventOrders(mergeNode.gedcomx);
  }
  if (!mergeNode.isLeafNode()) {
    fixMergeNodeEventOrder(mergeNode.prevNode);
    fixMergeNodeEventOrder(mergeNode.dupNode);
  }
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
 * Build MergeRow array, representing the HTML table rows for each MergeNode in the list or hierarchy.
 * Indentation strings use the following codes to decide what connector to include at each indentation position (for merge hierarchy):
 *   O=none, I = vertical, L = L-connector, T = vertical line with horizontal connector
 * @param mergeNode - MergeNode to use for building a row
 * @param maxIndent - maximum number of indentations for any merge node
 * @param shouldIncludeMergeNodes - Flag for whether to include non-leaf-nodes in the resulting array.
 * @param personSourcesMap - Map of personId -> list of sourceInfo objects first attached to that person Id (or null if not included)
 * @param parentRow - Parent PersonRow (from a higher merge history node).
 * @param personOrdinanceMap - Map of personId -> list of OrdinanceWorkSets for that person. null => ignore
 * @param shouldIncludeNoteRows - Flag for whether to include person note rows.
 * @returns Array of MergeRow entries (i.e., the array mergeRows)
 */
function buildMergeRows(mergeNode, maxIndent, shouldIncludeMergeNodes, personSourcesMap, parentRow, personOrdinanceMap, shouldIncludeNoteRows) {
  const mergeRows = [];
  updateMergeRows(mergeNode, "", maxIndent, false, mergeRows, shouldIncludeMergeNodes, personSourcesMap, parentRow, personOrdinanceMap, shouldIncludeNoteRows);
  if (!shouldIncludeMergeNodes) {
    // Clear out children of merge nodes so that selecting a parent node won't select child nodes.
    for (let mergeRow of mergeRows) {
      mergeRow.childRows = [];
    }
  }
  return mergeRows;
}

/**
 * Build MergeRow array, representing the HTML table rows for each MergeNode in the list or hierarchy.
 * Indentation strings use the following codes to decide what connector to include at each indentation position (for merge hierarchy):
 *   O=none, I = vertical, L = L-connector, T = vertical line with horizontal connector
 * @param mergeNode - MergeNode to use for building a row
 * @param indent - String indicating what kind of connector to put at each indentation position.
 * @param maxIndent - maximum number of indentations for any merge node
 * @param isDupNode - Flag for whether this is a "duplicate" node (as opposed to the survivor of a merge)
 * @param mergeRows - Array of MergeRows to add to
 * @param shouldIncludeMergeNodes - Flag for whether to include non-leaf-nodes in the resulting array.
 * @param personSourcesMap - Map of personId -> list of sourceInfo objects first attached to that person Id (or null if not included)
 * @param parentRow - Parent PersonRow (from a higher merge history node).
 * @param personOrdinanceMap - Map of personId -> list of OrdinanceWorkSets for that person. null => ignore
 * @param shouldIncludeNoteRows - Flag for whether to include person note rows.
 * @returns Array of MergeRow entries (i.e., the array mergeRows)
 */
function updateMergeRows(mergeNode, indent, maxIndent, isDupNode, mergeRows, shouldIncludeMergeNodes, personSourcesMap, parentRow, personOrdinanceMap, shouldIncludeNoteRows) {
  this.indent = indent;
  let mergeRow = null;
  if (shouldIncludeMergeNodes || mergeNode.isLatestVersion()) {
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
          if (ows.roleInOws === "ORD_PRINCIPAL") {
            let owsPersonRow = new PersonRow(null, ows.originalPersonId, ows.gedcomx, 0, 0, false, null, null, null, ows);
            mergeRows.push(owsPersonRow);
            mergeRow.addOwsChild(owsPersonRow);
          }
        }
      }
    }
    if (shouldIncludeNoteRows) {
      const noteRecords = getNoteRecords(findPersonInGx(mergeNode.gedcomx, mergeNode.personId));
      if (noteRecords) {
        for (let noteRecord of noteRecords) {
          let noteRow = new PersonRow(null, mergeNode.personId, noteRecord, 0, 0, false, null, null, null, null, null, true);
          mergeRows.push(noteRow);
        }
      }
    }
  }
  if (!mergeNode.isLeafNode()) {
    let indentPrefix = indent.length > 0 ? (indent.substring(0, indent.length - 1) + (isDupNode ? "I" : "O")) : "";
    updateMergeRows(mergeNode.dupNode, indentPrefix + "T", maxIndent, true, mergeRows, shouldIncludeMergeNodes, personSourcesMap, mergeRow, personOrdinanceMap, shouldIncludeNoteRows);
    updateMergeRows(mergeNode.prevNode, indentPrefix + "L", maxIndent, false, mergeRows, shouldIncludeMergeNodes, personSourcesMap, mergeRow, personOrdinanceMap, shouldIncludeNoteRows);
  }
}

// If the person has notes, then return a list of mostly-empty gedcomx records, each with just one person with
//   just a personId and notes. Excludes notes that were inherited from a merge
function getNoteRecords(person) {
  const noteRecords = [];
  if (person && person.notes) {
    for (let note of person.notes) {
      let noteRecord = {
        "persons": [{
          "id": person.id,
          "identifiers": person.identifiers,
          "notes": [note]
        }]
      };
      noteRecords.push(noteRecord);
    }
  }
  return noteRecords;
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

function mainPersonIdSelected(grouperId) {
  let grouper = grouperMap[grouperId];
  if (grouper.isMainPersonIdSelected()) {
    alert("The main person Id (" + mainPersonId + ") must remain in the first group, so that it is above the 'person to keep' in the split summary.");
    return true;
  }
  return false;
}

// Function called when the "New group" button is clicked in the Flat view.
// If any rows are selected, they are moved to the new group.
// If this is only the second group, then the first group begins displaying its header.
function createGroup(grouperId) {
  if (mainPersonIdSelected(grouperId)) {
    return;
  }
  let grouper = grouperMap[grouperId];
  let mergeRows = grouper.removeSelectedRows();
  let mergeGroup = new MergeGroup("Group " + (grouper.mergeGroups.length + 1), mergeRows, grouper);
  grouper.mergeGroups.push(mergeGroup);
  updateFlatViewHtml(grouper);
}

function moveSelectedToGroup(groupId) {
  if (mainPersonIdSelected(groupId)) {
    return;
  }
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

// Map of rowId -> {x, y} of where that row was last time.
let prevPositionMap = new Map();
let resetAnimation = false;

function initPrevRowPositions() {
  switch (getCurrentTab()) {
    case FLAT_VIEW: animateRows(flatGrouper, true); break;
    case SOURCES_VIEW: animateRows(sourceGrouper, true); break;
    case COMBO_VIEW: animateRows(comboGrouper, true); break;
  }
}

function notSamePosition(a, b) {
  return Math.abs(a.left - b.left) > .5 || Math.abs(a.top - b.top) > .5;
}

const animationSpeed = 500;
function animateRows(grouper) {
  if (!grouper || grouper !== grouperMap[getCurrentTab()]) {
    return;
  }
  if (!displayOptions.vertical) {
    for (let group of grouper.mergeGroups) {
      let newPositionMap = new Map();
      for (let personRow of group.personRows) {
        let rowId = getRowId(grouper.tabId, personRow.id);
        let $row = $("#" + rowId);
        newPositionMap.set(rowId, {"left": $row.offset().left, "top": $row.offset().top});
      }
      for (let personRow of group.personRows) {
        let rowId = getRowId(grouper.tabId, personRow.id);
        let $row = $("#" + rowId);
        let prevPosition = prevPositionMap.get(rowId);
        let newPosition = newPositionMap.get(rowId);
        prevPositionMap.set(rowId, newPosition);
        if (!resetAnimation && prevPosition && (prevPosition.left || prevPosition.top) && (newPosition.left || newPosition.top) && notSamePosition(prevPosition, newPosition)) {
          // animate row's position from prevPosition to new position
          $row.css({
            "position": "relative",
            "left": prevPosition.left - newPosition.left,
            "top": prevPosition.top - newPosition.top,
            "width": "100%"
          });
          $row.animate({"left": 0, "top": 0}, animationSpeed);
        }
      }
    }
  }
  // Animate cells of summary elements
  if (displayOptions.shouldShowSummaries && grouper.splitGroupId) {
    function animateSummaryCell(cellId, prevPosition, newPosition, otherPosition) {
      if (!resetAnimation && newPosition && (newPosition.left || newPosition.top)) {
        if (otherPosition && !prevPosition) {
          // If going from "Keep" to "Copy" or "Split", then animate from the old keep to the new split position
          // (whether moving or copying). And vice versa.
          prevPosition = otherPosition;
        }
        let $cell = $("#" + cellId);
        if ($cell && prevPosition && (prevPosition.left || prevPosition.top)) {
          $cell.css({"position": "relative", "left": prevPosition.left - newPosition.left, "top": prevPosition.top - newPosition.top, "width": "100%"});
          $cell.animate({"left": 0, "top": 0}, animationSpeed);
        }
      }
    }

    function animateSummaryElement(element, doRelativeFacts) {
      let keepCellId = getCellId(element.elementIndex, true, doRelativeFacts);
      let splitCellId = getCellId(element.elementIndex, false, doRelativeFacts);
      let prevKeepPos = prevPositionMap.get(keepCellId);
      let prevSplitPos = prevPositionMap.get(splitCellId);
      let newKeepPos = newPositionMap.get(keepCellId);
      let newSplitPos = newPositionMap.get(splitCellId);
      animateSummaryCell(keepCellId, prevKeepPos, newKeepPos, prevSplitPos);
      animateSummaryCell(splitCellId, prevSplitPos, newSplitPos, prevKeepPos);
      prevPositionMap.set(keepCellId, newKeepPos);
      prevPositionMap.set(splitCellId, newSplitPos);
    }

    let newPositionMap = new Map();
    for (let element of split.elements) {
      for (let isKeep of [true, false]) {
        for (let isFacts of [false, true]) {
          // (Spouse and Child summary elements can have a facts column that is not independently selectable)
          if (!isFacts || (element.type === TYPE_SPOUSE || element.type === TYPE_CHILD)) {
            let cellId = getCellId(element.elementIndex, isKeep, isFacts);
            let $cell = $("#" + cellId);
            if ($cell && $cell.offset()) {
              newPositionMap.set(cellId, {"left": $cell.offset().left, "top": $cell.offset().top});
            }
          }
        }
      }
    }
    for (let element of split.elements) {
      animateSummaryElement(element, false);
      if (element.type === TYPE_SPOUSE || element.type === TYPE_CHILD) {
        animateSummaryElement(element, true);
      }
    }
  }
  resetAnimation = false;
}

function getCellId(elementIndex, isKeep, isFacts) {
  return getCurrentTab() + "_element-" + elementIndex + "_" + (isKeep ? "keep" : "split") + (isFacts ? "_facts" : "");
}

function updateFlatViewHtml(grouper) {
  $("#" + grouper.tabId).html(getGrouperHtml(grouper));
  highlightSelectedRows(grouper);
  makeTableHeadersDraggable();
  animateRows(grouper);
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
  let mergeRows = buildMergeRows(rootMergeNode, maxDepth - 1, false);
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
  let personAndPersonaRows = buildMergeRows(rootMergeNode, maxDepth - 1, false, personSourcesMap, null, personOrdinanceMap, true);
  linkStapledOrdinancesToRecordPersonas(personAndPersonaRows);
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

// Summary person rows.
let keepPersonRow = null;
let splitPersonRow = null;

function updateSummaryRows() {
  function makeSummaryPersonRow(isKeep) {
    let gedcomx = split.getSplitGedcomx(isKeep);
    return new PersonRow(null, isKeep ? mainPersonId : SPLIT_PERSON_ID, gedcomx, 0, 0,
      false, mergeGrouper, null, null, null, isKeep ? DIR_KEEP : DIR_MOVE);
  }
  keepPersonRow = makeSummaryPersonRow(true);
  splitPersonRow = makeSummaryPersonRow(false);
}

function performSplit(grouperId) {
  if (hasRestoreInChangeLog) {
    alert("This person has a 'Restore' in the change log, and the split tool can't handle that yet.");
    return;
  }
  let grouper = grouperMap[grouperId];
  let splitObject = createSplitObject(grouper);
  if (confirm("This is a <b>message</b>")) {
    alert("Splitting...");
  }
  else {
    alert("Split cancelled.");
  }
}

/*
  TfPersonSplitSpecification, from tf-json-binding:
  // Extracted person specifications. Things to add to the "split" person.
  private Map<String, List<String>> changeIdsOfConclusionsToCopyByPersonId;
  private Map<String, List<String>> changeIdsOfEntityRefsToCopyByPersonId;
  private Map<String, List<String>> changeIdsOfNotesToCopyByPersonId;
  private List<String> idsOfCoupleRelationshipsToCopy;
  private List<String> idsOfParentChildRelationshipsToCopy;

  private List<TfConclusion> conclusionsToAdd; // Conclusions to copy from a source persona to the "split" person.
  todo: List<TfConclusion> conclusionsToEdit; // Conclusions to add to the Combined/"keep" person

  // Combined person specifications. Things to add to the "keep" person.
  private Map<String, List<String>> changeIdsOfConclusionsToEditByPersonId;
  private Map<String, List<String>> changeIdsOfEntityRefsToEditByPersonId;
  private Map<String, List<String>> changeIdsOfNotesToEditByPersonId;
  //todo: List<String> idsOfCoupleRelationshipsToEdit;
  //todo: List<String> idsOfParentChildRelationshipsToEdit;

  // Things to delete off of the "Combined"/"keep" person (usually just things copied/moved to the "split" person).
  private List<String> idsOfConclusionsToDelete;
  private List<String> idsOfEntityRefsToDelete;
  private List<String> idsOfNotesToDelete;
  private List<String> idsOfCoupleRelationshipsToDelete;
  private List<String> idsOfParentChildRelationshipsToDelete;

{
  "changeIdsOfConclusionsToCopyByPersonId": {
    "LVMX-L8V": [
      "32264060-705b-11e4-b54e-0116774671f6_0_1"
    ],
    "GNQ7-6Q4": [
      "36c4c070-3ae1-11ed-af4b-33eb603be4ec_0_2"
    ],
    "L25C-9Z7": [
      "8577eda0-fdb7-11e5-849b-012805c2048b_0_0"
    ]
  },
  "changeIdsOfEntityRefsToCopyByPersonId": {
    "L25C-9Z7": [
      "77a18470-73b9-11eb-b2b1-55a0140ac0d5_0_0"
    ]
  }
}
  TfConclusion:
    conclusionId
    type: NAME, GENDER, FACT, CONTRIBUTION_TRACKED_ID, UNKNOWN
    commandUuid
    attribution: TfAttribution
      changeMessage
      modified (presumably timestamp)
      contributor.id
      submitter.id
    // NAME:
    preferred: boolean
    value: TfConclusionValue [Compatible with GedcomX Name object, assuming 'type' can be a URI]
      type
      nameForms[]:
        lang
        fullText
        order (String)
        parts[]:
          type
          value
   // GENDER [Compatible with GedcomX]
    value.type
   // FACT [Compatible with GedcomX
    type
    value: TfFactValue
      date: TfFactDate
        original
        formal
        normalized[].lang, .value
      place: TfFactPlace
        original
        names[].lang, .value [In GedcomX, this is "normalized"[].lang, .value]
        // In GedcomX, latitude and longitude are in a PlaceDescription referenced by the PlaceReference object.
        latitude, longitude (Double)
        // In GedcomX, the PlaceDescription object has a ResourceReference with a place URI ending in a place ID.
        id (Integer)
      value
      // Not part of standard GedcomX:
      userDefinedType
      userDefinedDataType
      userCertified (for LIFE_SKETCH conclusions)
      generatedNumber (for GENERATION conclusions)
      associatedParent

 */

class SplitObject {
  constructor(grouper) {
    // Maps of personId -> list of changeIds from that personId's change log to copy to the "split" ("extracted") person,
    //   or to add (aka "edit") to the "keep" ("combined") person.
    this.changeIdsOfConclusionsToCopyByPersonId = {};
    this.changeIdsOfEntityRefsToCopyByPersonId = {};
    this.changeIdsOfNotesToCopyByPersonId = {};

    this.changeIdsOfConclusionsToEditByPersonId = {};
    this.changeIdsOfEntityRefsToEditByPersonId = {};
    this.changeIdsOfNotesToEditByPersonId = {};

    // Lists of TfConclusion objects, created from conclusions on source personas rather than from Family Tree change log entries.
    //   (Similar to GedcomX, but see above for differences.)
    // List of TfConclusion objects to add to the "split" (extracted) person.
    this.conclusionsToAdd = [];
    // List of TfConclusion objects to add to the "keep" (combined) person
    //todo: this.conclusionsToEdit = [];

    // List of relationship IDs to copy to the "split" ("extracted") person. Presumably, the Combined/keep person ID
    //   in these relationships will be replaced with the new person's ID.
    this.idsOfCoupleRelationshipsToCopy = [];
    this.idsOfParentChildRelationshipsToCopy = [];

    //List of relationship IDs to add to the "keep" ("combined") person. But how would we know which person ID
    //  to replace with the new person's ID?
    //todo: this.idsOfCoupleRelationshipsToEdit = [];
    //todo: this.idsOfParentChildRelationshipsToEdit = [];

    // List of change IDs for conclusions, entity refs and notes to delete from the combined person
    this.idsOfConclusionsToDelete = [];
    this.idsOfEntityRefsToDelete = [];
    this.idsOfNotesToDelete = [];
    // List of relationship IDs to delete from the combined person.
    this.idsOfCoupleRelationshipsToDelete = [];
    this.idsOfParentChildRelationshipsToDelete = [];

    this.initSplitObject(grouper);
  }

  /*
  // Type of information in each element. Note: The String will be used in the HTML display.
const TYPE_NAME = "Name";
const TYPE_GENDER = "Gender";
const TYPE_FACT = "Facts";
const TYPE_PARENTS = "Parents"; // child-and-parents relationship from the person to their parents
const TYPE_SPOUSE = "Spouse"; // Couple relationship to a spouse
const TYPE_CHILD = "Children"; // child-and-parents relationship to a child
const TYPE_SOURCE = "Sources"; // attached source
const TYPE_ORDINANCE = "Ordinances"; // linked ordinance

   */
  initSplitObject(grouper) {
    function getSourceString(sourceDescription) {
      let title = sourceDescription.titles ? sourceDescription.titles[0].value : null;
      let ark = sourceDescription.identifiers ? sourceDescription.identifiers["http://gedcomx.org/Persistent"][0] : null;
      return joinNonNullElements([title, ark], ": ");
    }

    function getEntryChangeTypeAndInfo(entry) {
      let changeInfo = entry.changeInfo[0];
      let operation = extractType(getProperty(changeInfo, "operation"));
      let resultingId = getProperty(changeInfo, "resulting.resourceId");
      if (operation === "Create" || operation === "Change") {
        let objectType = extractType(getProperty(changeInfo, "objectType"));
        let objectModifier = extractType(getProperty(changeInfo, "objectModifier"));
        if (objectModifier === "Person" && objectType !== "NotAMatch") {
          let entryPerson = findPersonByLocalId(entry, resultingId);
          if (entryPerson.hasOwnProperty("facts") && entryPerson.facts.length === 1) {
            return [TYPE_FACT, getFactString(entryPerson.facts[0])];
          }
          else {
            switch (objectType) {
              case "BirthName":
                return [TYPE_NAME, getPersonName(entryPerson)];
              case "Gender":
                return [TYPE_GENDER, entryPerson.gender.type ? extractType(entryPerson.gender.type) : "Unknown"];
              case "SourceReference":
                return [TYPE_SOURCE, getSourceString(entryPerson.sources[0])];
              case "Note":
                let note = entryPerson.notes[0];
                return [TYPE_NOTE, joinNonNullElements([note.subject, note.text], ": ")];
            }
          }
        }
        else if (objectModifier === "Couple" && (objectType === "Couple" || objectType.startsWith("Spouse"))) {
          const rel = findCoupleRelationship(entry, resultingId);
          if (rel) {
            const relationshipId = extractType(rel.identifiers["http://gedcomx.org/Primary"][0]);
            return [TYPE_SPOUSE, relationshipId];
          }
          else {
            console.log("Warning: Could not find Couple relationship with resultingId " + resultingId);
          }
        }
        else if (objectModifier === "ChildAndParentsRelationship") {
          const rel = findChildAndParentsRelationship(entry, resultingId);
          if (rel) {
            const relationshipId = extractType(rel.identifiers["http://gedcomx.org/Primary"][0]);
            if (objectType === "ChildAndParentsRelationship") {
              if (rel.child && rel.child.resourceId === entry.personId) {
                objectType = "Child";
              }
              else if (rel.parent1 && rel.parent1.resourceId === entry.personId) {
                objectType = "Parent1";
              }
              else if (rel.parent2 && rel.parent2.resourceId === entry.personId) {
                objectType = "Parent2";
              }
            }
            switch (objectType) {
              case "Parent1":
              case "Parent2":
                return [TYPE_PARENTS, relationshipId];
              case "Child":
                return [TYPE_CHILD, relationshipId];
            }
          }
          else {
            console.log("Warning: Could not find relationship with resultingId " + resultingId);
          }
        }
      }
      return null;
    }

    function getElementInfoString(element) {
      switch (element.type) {
        case TYPE_NAME:
          const name = element.item;
          return getPersonName({names: [name]}); // simulate person object with just a name
        case TYPE_FACT:
          const fact = element.item;
          return getFactString(fact);
        case TYPE_GENDER:
          const gender = element.item;
          return gender.type ? extractType(gender.type) : "Unknown"
        case TYPE_PARENTS:
        case TYPE_CHILD:
          const parentsAndChildRelationship = element.item;
          return extractType(parentsAndChildRelationship.identifiers["http://gedcomx.org/Primary"][0]);
        case TYPE_SPOUSE:
          const coupleRelationship = element.item;
          return extractType(coupleRelationship.identifiers["http://gedcomx.org/Primary"][0])
        case TYPE_SOURCE:
          const sourceDescription = element.item;
          return getSourceString(sourceDescription);
        case TYPE_ORDINANCE:
          const ows = element.item;
          return ows.owsId;
      }
    }

    function getKeepAndSplitPersonIds(grouper) {
      let keepPersonIds = [];
      let splitPersonIds = [];

      for (let group of grouper.mergeGroups) {
        let listToAddTo = group.groupId === grouper.splitGroupId ? splitPersonIds : keepPersonIds;
        for (let personRow of group.personRows) {
          if (personRow.mergeRow && personRow.mergeRow.personId) {
            listToAddTo.push(personRow.mergeRow.personId);
          }
        }
      }
      return [keepPersonIds, splitPersonIds];
    }

    // personChangeMap: map of personId -> change entry for a change with a particular info string for a particular type
    //    of info for that person id.
    // Return the latest change entry for the person IDs in the appropriate list (keepPersonIds for direction DIR_KEEP,
    //   splitPersonIds for direction DIR_MOVE, and bothIds for direction DIR_COPY). If there is no matching change
    //   entry for the appropriate list, look in the other. If none is found, then return null.
    function chooseBestChangeEntry(personChangeMap, keepPersonIds, splitPersonIds, bothIds, direction) {
      function getLatestEntry(personIds, otherPersonIds) {
        let latestEntry = null;
        for (let personId of personIds) {
          let entry = personChangeMap.get(personId);
          if (entry) {
            if (!latestEntry || entry.updated > latestEntry.updated) {
              latestEntry = entry;
            }
          }
        }
        if (!latestEntry && otherPersonIds) {
          latestEntry = getLatestEntry(otherPersonIds, null);
        }
        return latestEntry;
      }

      let bestEntry = null;
      if (direction === DIR_KEEP) {
        bestEntry = getLatestEntry(keepPersonIds, splitPersonIds);
      }
      else if (direction === DIR_MOVE) {
        bestEntry = getLatestEntry(splitPersonIds, keepPersonIds);
      }
      else if (direction === DIR_COPY) {
        bestEntry = getLatestEntry(bothIds, null);
      }
      return bestEntry;
    }

    // Map of information type -> infoString -> personId -> change entry
    // Where
    // - 'type' is the split element type  (TYPE_NAME...TYPE_SOURCE)
    // - 'infoString' is a string representation of the information (e.g., a full name, a fact "type: date; place", etc.)
    // - 'personId' are the person IDs of the persons that have this information in their change log,
    function getTypeInfoPersonChangeMap() {
      const typeInfoPersonIdChangeEntryMap = new Map();

      for (let entry of allEntries) {
        let [type, info] = getEntryChangeTypeAndInfo(entry);
        let personId = entry.personId;
        let infoPersonChangeMap = computeIfAbsent(typeInfoPersonIdChangeEntryMap, type, () => new Map());
        let personChangeMap = computeIfAbsent(infoPersonChangeMap, info, () => new Map());
        if (!personChangeMap.has(personId)) {
          // Entries are sorted newest to oldest, so if we have already seen this value on this person ID,
          //   then it's older and can be ignored.
          personChangeMap.set(personId, entry);
        }
      }
      for (let owsId of owsRefMap.keys()) {
        let infoPersonChangeMap = computeIfAbsent(typeInfoPersonIdChangeEntryMap, TYPE_ORDINANCE, () => new Map());
        let personChangeMap = computeIfAbsent(infoPersonChangeMap, owsId, () => new Map());
        let ows = owsMap.get(owsId);
        let personId = ows.originalPersonId;
        if (!personChangeMap.has(personId)) {
          personChangeMap.set(personId, ows);
        }
      }
      return typeInfoPersonIdChangeEntryMap;
    }

    function addToChangeIdMap(changeIdMap, personId, changeId) {
      let changeIdList = computeIfAbsent(changeIdMap, personId, () => []);
      changeIdList.push(changeId);
    }

    function updateSplitMaps(changeEntry, direction, keepMap, splitMap, isCurrent) {
      let personId = changeEntry.personId;
      let changeId = changeEntry.id;
      switch (direction) {
        case DIR_KEEP:
          if (!isCurrent) {
            addToChangeIdMap(keepMap, personId, changeId);
          }
          break;
        case DIR_MOVE:
          addToChangeIdMap(splitMap, personId, changeId);
          if (isCurrent) {
            this.idsOfConclusionsToDelete.push(changeId);
          }
          break;
        case DIR_COPY:
          if (!isCurrent) {
            addToChangeIdMap(keepMap, personId, changeId);
          }
          addToChangeIdMap(splitMap, personId, changeId);
          break;
      }
    }

    function updateSplitLists(changeEntry, direction, keepList, splitList) {
      let personId = changeEntry.personId;
      let changeId = changeEntry.id;
      switch (direction) {
        case DIR_KEEP:
          keepList.push(changeId);
          break;
        case DIR_MOVE:
          splitList.push(changeId);
          if (personId === mainPersonId) {
            //todo: We don't know that this is a current conclusion, so we may not need to delete it.
            // (We could add to delete list and then check later?)
            this.idsOfConclusionsToDelete.push(changeEntry.id);
          }
          break;
        case DIR_COPY:
          keepList.push(personId);
          splitList.push(personId);
          break;
      }
    }

// - 'change entry' is the LATEST change entry with that info string for that person Id.
    const typeInfoPersonIdChangeEntryMap = getTypeInfoPersonChangeMap();

    let [keepPersonIds, splitPersonIds] = getKeepAndSplitPersonIds(grouper);
    let bothIds = keepPersonIds.concat(splitPersonIds);
    let currentTypeInfoMap = getLatestTypeInfoMap(grouper);

    for (let element of split.elements) {
      let isCurrent = !element.isExtra();
      let infoString = getElementInfoString(element);
      let infoPersonChangeMap = typeInfoPersonIdChangeEntryMap.get(element.type);
      // Map of personId -> latest change entry with that info string for that person ID.
      let personChangeMap = infoPersonChangeMap.get(infoString);
      // If there are multiple person IDs with the same info string, then
      //  a) find the most recent one where the personId is in the group that the element is in
      //     (i.e., in the keep group if the element is a keep or copy element; or in the split
      //     group if the element is a split or copy element).
      //  b) If the person ID isn't in the right group, take the most recent from the other group.
      //  c) If there isn't a change log entry at all that has the info, then this info is coming
      //     from a source instead, so it will go in the "conclusionsToAdd" list.
      let changeEntry = chooseBestChangeEntry(personChangeMap, keepPersonIds, splitPersonIds, bothIds, element.direction);
      if (changeEntry) {
        switch (element.type) {
          case TYPE_NAME:
          case TYPE_FACT:
          case TYPE_GENDER:
            updateSplitMaps(changeEntry, element.direction, this.changeIdsOfConclusionsToEditByPersonId, this.changeIdsOfConclusionsToCopyByPersonId, isCurrent);
            break;
          case TYPE_PARENTS:
          case TYPE_CHILD:
            updateSplitLists(changeEntry, element.direction, null /*todo:this.idsOfParentChildRelationshipsToEdit*/, this.idsOfParentChildRelationshipsToCopy, isCurrent);
            break;
          case TYPE_SPOUSE:
            break;
          case TYPE_SOURCE:
          case TYPE_ORDINANCE:
            updateSplitMaps(changeEntry, element.direction, this.changeIdsOfEntityRefsToEditByPersonId, this.changeIdsOfEntityRefsToCopyByPersonId, isCurrent);
            break;
          case TYPE_NOTE:
            updateSplitMaps(changeEntry, element.direction, this.changeIdsOfNotesToEditByPersonId, this.changeIdsOfNotesToCopyByPersonId, isCurrent);
            break;
        }
      }
    }
    /*
    todo: Filter out changes that are already on the keep person, i.e., currently conclusions, entity refs or ordinances.
    todo: Figure out what to do about 'main' vs. 'alternate' names.
     - On split: First name is main, and others are alternate, even if the change id has them as the opposite.
     - On keep: Current name is main if being kept, and all others alternate. If current name isn't being kept,
      then first name from change ids is main, if any, otherwise, first from conclusions is main. All others alternate.
      a) Keep current, do nothing else => do nothing.
      b) Replace current with another one, and perhaps add others => Put in list.
         - Need API to ignore name vs. alternate
         - No way to indicate which one is first? Or will ordered object be respected? In that case, put
            preferred one's person ID first, and preferred name in first element of array. Then everything
            else is an 'alternate' name.
      c) Keep current, add another => Impossible. "Edit" will replace the current with the one in the 'edit' list.
         - Unless: Put current in 'edit' list as the first one, and all others are 'alternate'.
      d) BUT, it would be more straightforward to require deleting the current if not keeping it...
    todo: Figure out what to do about vitals, i.e., b,chr,d,bur. When to make it an alternate?
      a) Keep current birth, don't add => do nothing.
      b) Replace current birth with another one, and perhaps add others => put in list (see above for which is first)
      c) Keep current birth but add another => impossible, unless pull trick above.
    todo: Figure out how to create relationships that aren't on the current person.
      a) Relationship was deleted during merge and is still not active.
         => Find person ID in list of merged persons and use that.
      b) Relationship was deleted during merge and later that person's ID was replaced with a new person ID.
         => Find change entry with information about the relationship, and create a new relationship with the
            same person IDs (except with the keep or split person's id), same conclusions.
            But give attribution to the user doing the split, since they are the ones creating the relationship now.
    => Figure out which split.elements are 'current', so we know when to delete, etc...
    todo: - Instead of "edit", should we have separate "replace" and "add" lists?
    todo: Make sure the 'keep' person gets at least one name.
    */
  }
}

function createSplitObject(grouper) {
  let split = new SplitObject(grouper);
  // Map of changeId -> {type, info string, GedcomX item}
  let changeIdMap = null;
  // Display the split object in the console for debugging.
  //todo...
  // For the keep person:
  // - Find the root merge node (or the PersonRow for the person in the grouper) to get the GedcomX.
  // - Get a map of info -> html for current info (conclusions, entity refs, notes).
  // - Display (a) current info, (b) keep info, (c) split info
}

// Use the selected PersonRows in the merge hierarchy view to select
function splitOnSelectedMergeRows() {
  let unselectedMergeRows = getRowsBySelection(mergeGrouper.mergeGroups[0].personRows, false);
  let selectedMergeRows = getRowsBySelection(mergeGrouper.mergeGroups[0].personRows, true);
  splitOnInfoInGroup(MERGE_VIEW, unselectedMergeRows, selectedMergeRows);
  updateTabsHtml();
  //todo: Make this work in conjunction with the combo view...
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
    grouper.splitGroupId = groupId;
    displayOptions.shouldShowSummaries = true;
    updateTabsHtml();
    // $("#tabs").tabs("option", "active", viewList.indexOf(SPLIT_VIEW));
  }
}

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
  function gatherSourcesAndNotesFromGroup(personRows, sourceIdSet, noteIdSet) {
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
        for (let note of getList(person, "notes")) {
          if (shouldIncludeStatus(note)) {
            noteIdSet.add(note.id);
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
  function gatherOwsFromGroup(personRows, owsIdSet, mainPersonId) {
    for (let personRow of personRows) {
      if (tabId === FLAT_VIEW || tabId === MERGE_VIEW) {
        // No ordinance work set rows, so move ordinances over if this row's person ID was the one the ordinance was originally done for.
        for (let ows of getList(personOrdinanceMap, mainPersonId)) {
          if (ows.principalPersonId === personRow.personId) {
            owsIdSet.add(ows.owsId);
          }
        }
      }
      else {
        if (personRow.ows) {
          owsIdSet.add(personRow.ows.owsId);
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
  // Set of source ID numbers that are being kept or split out
  let keepSourceIds = new Set();
  let splitSourceIds = new Set();
  let keepNoteIds = new Set();
  let splitNoteIds = new Set();
  gatherSourcesAndNotesFromGroup(splitRows, splitSourceIds, splitNoteIds);
  gatherSourcesAndNotesFromGroup(keepRows, keepSourceIds, keepNoteIds);
  let keepOwsIds = new Set();
  let splitOwsIds = new Set();
  gatherOwsFromGroup(splitRows, splitOwsIds, mainPersonId);
  gatherOwsFromGroup(keepRows, keepOwsIds, mainPersonId);
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
      case TYPE_NOTE:
        setDirectionBasedOnSetInclusion(element, element.item.id, keepNoteIds, splitNoteIds);
        break;
      case TYPE_ORDINANCE:
        setDirectionBasedOnSetInclusion(element, element.item.owsId, keepOwsIds, splitOwsIds);
        break;
    }
  }
  updateSummaryRows();
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
const TYPE_NOTE = "Notes";
const TYPE_ORDINANCE = "Ordinances"; // linked ordinance

// One element of information from the original GedcomX that is either kept on the old person, or copied or moved out to the new person.
// - Includes, names, facts and relationships.
// - Also includes sources, ordinances and notes, even though the UI handles these by moving them between groups.
class Element {
  constructor(elementIndex, item, type, direction, famId) {
    this.elementIndex = elementIndex; // index in split.elements[]
    this.item = item; // name, gender, fact, field, relationship, source, note or ordinance being decided upon.
    item.elementIndex = elementIndex; // Set this item's index into the GedcomX object, so we can find it later.
    this.type = type; // Type of item (see TYPE_* above)
    this.direction = direction; // Direction for this piece of information: DIR_KEEP/COPY/MOVE
    this.famId = famId; // optional value identifying which family (i.e., spouseId) this relationship element is part of, to group children by spouse.
    this.relative = null; // spouse or child GedcomX person.
    this.canExpand = false;
    // Flag for whether following elements of the same type AND with an 'elementSource' (i.e., not from the current person) should be displayed.
    this.isExpanded = false;
    // Where this came from, if it isn't the main current person.
    this.elementSource = null;
    this.sourceInfo = null;
    // Flag for whether this element is 'selected', so that it will show even when collapsed.
    // This also means it will be kept on the resulting person(s), even though 'elementSource' would otherwise cause it to be ignored.
    this.isSelected = false;
  }

  isVisible() {
    return !this.isExtra() || this.isSelected;
  }

  // Tell whether this element is an "extra" value that can be hidden, i.e., one from a source.
  // todo: Decide whether this should really reflect (a) values currently on the latest combined person; or
  // (b) values on the original identity of the person with the combined person's person ID. (<- Seems arbitrary).
  isExtra() {
    if (this.elementSource) {
      return true;
    }
    switch(this.item.status) {
      case ORIG_STATUS:          // Part of the original identity.
      case ADDED_STATUS:         // Added after original identity, or after most recent merge
      case CHANGED_STATUS:       // Gender changed (M<: // Deleted a value added after the original identity, but before the most recent merge.
      case MERGE_ORIG_STATUS:    // On original identity of duplicate and brought in during merge
      case MERGE_ADDED_STATUS:   // Added after original identity of duplicate and brought in during merge
      case KEPT_ORIG_STATUS:     // On original identity of survivor and kept during merge
      case KEPT_ADDED_STATUS:    // Added after original identity of survivor and kept during merge
        return false;
      case MERGE_DELETED_STATUS: // On duplicate but deleted before the most recent merge
      case KEPT_DELETED_STATUS:  // On survivor but deleted before the most recent merge
        return true;
    }
    // return !!this.elementSource;
  }
}

let split = null;

/* Class representing all the decisions about how to split a person.
   Contains a list of elements, each of which represents a piece of information that needs to be decided upon.
   Each element can be kept on the "survivor" (direction=DIR_KEEP), moved to the "split" (direction=DIR_MOVE),
     copied to both (direction=DIR_COPY), or left undecided (direction=DIR_NULL).
   Elements that come from a source that are not marked as 'selected' are not kept on either person.
 */
class Split {
  constructor(gedcomx) {
    this.gedcomx = gedcomx; // Current, merged person's full GedcomX.
    let personId = gedcomx.persons[0].id;
    this.personId = personId;
    // Elements of information, including name, gender, facts, parent relationships, couple relationships,
    //   child relationships, sources and ordinances.
    // Couple and child relationships are ordered such that for each couple relationships, child relationships with that spouse
    //   follow in the elements list. Then any child relationships with no spouse id follow after that.
    this.elements = this.initElements(gedcomx, personId);
  }

  initElements(gedcomx, personId) {

    function addElement(item, type, famId, personIdForFacts) {
      if (!item) {
        return null;
      }
      let element = new Element(elementIndex++, item, type, DIR_KEEP, famId);
      if (personIdForFacts) {
        let relative = findPersonInGx(gedcomx, personIdForFacts);
        if (relative) {
          element.relative = relative;
        }
      }
      if (item.elementSource) {
        element.elementSource = item.elementSource;
        delete item["elementSource"];
      }
      if (type === TYPE_SOURCE) {
        let sourceReference = element.item;
        element.sourceInfo = sourceMap[sourceReference.description];
      }
      elements.push(element);
      if (!element.isExtra()) {
        // By default, select all elements that are on the current, combined person.
        element.isSelected = true;
      }
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
          addElement(childRel, TYPE_CHILD, spouseId, getRelativeId(childRel, "child"));
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
        addElement(coupleRel, TYPE_SPOUSE, spouseId, spouseId);
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
            if (!alreadyHasName(person.names, entryPerson.names[0])) { //todo: && !alreadyHasName(extraNames, entryPerson.names[0])) {
              let nameCopy = copyObject(entryPerson.names[0]);
              nameCopy.elementSource = "From person: " + getPersonId(entryPerson);
              extraNames.push(nameCopy);
            }
          }
          else if (combo === "Create-(Fact)") {
            if (!alreadyHasFact(allFacts, entryPerson.facts[0])) { //todo: && !alreadyHasFact(extraFacts, entryPerson.facts[0])) {
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
    if (person.notes) {
      addElements(person.notes, TYPE_NOTE);
    }
    if (personOrdinanceMap) {
      let owsList = personOrdinanceMap.get(personId);
      if (owsList) {
        owsList = owsList.filter(ows => ows.roleInOws === "ORD_PRINCIPAL");
        owsList.sort((a, b) => a.ordinances[0].ordinanceSortKey.localeCompare(b.ordinances[0].ordinanceSortKey));
        addElements(owsList, TYPE_ORDINANCE);
      }
    }
    return elements;
  }

  // Get a GedcomX object constructed from the split 'elements' list, either for the 'keep' side (true) or the 'split' side (false)
  getSplitGedcomx(isKeep) {
    let personId = isKeep ? mainPersonId : SPLIT_PERSON_ID;
    let mainPerson = { "id" : personId,
      "identifiers" : {
        "http://gedcomx.org/Primary" : [ "https://familysearch.org/ark:/61903/4:1:" + personId ]
      }
    };
    let gedcomx = {
      "persons" : [ mainPerson ]
    };
    for (let element of this.elements) {
      let item = element.item;
      if (element.direction === DIR_COPY || (element.direction === DIR_KEEP && isKeep) || (element.direction === DIR_MOVE && !isKeep)) {
        switch (element.type) {
          case TYPE_NAME:
            addToList(mainPerson, "names", item);
            break;
          case TYPE_GENDER:
            mainPerson.gender = item;
            break;
          case TYPE_FACT:
            addToList(mainPerson, "facts", item);
            break;
          case TYPE_SPOUSE:
            addToList(gedcomx, "relationships", this.copyObjectWithElement(item));
            break;
          case TYPE_PARENTS:
          case TYPE_CHILD:
            // Operate on a copy of the relationship, since we might modify the person IDs
            addToList(gedcomx, CHILD_REL, this.copyObjectWithElement(item));
            break;
          // Ignore sources and ordinances, because they are already displayed separately as part of the groups.
        }
      }
    }
    let relativeIds= new Set();
    if (gedcomx.relationships) {
      // The GedcomX created for the 'keep' or 'split' half has relationships between the person and various relatives.
      // For each relationship, add the relative's ID to the given set, so that we can add those persons into the GedcomX as well.
      // Also, if !isKeep, then map the person ID of the mainPersonId to SPLIT_PERSON_ID.
      for (let relationship of gedcomx.relationships) {
        this.fixRelative(isKeep, relationship.person1, relativeIds);
        this.fixRelative(isKeep, relationship.person2, relativeIds);
      }
    }
    if (gedcomx[CHILD_REL]) {
      for (let rel of gedcomx[CHILD_REL]) {
        this.fixRelative(isKeep, rel.parent1, relativeIds);
        this.fixRelative(isKeep, rel.parent2, relativeIds);
        this.fixRelative(isKeep, rel.child, relativeIds);
      }
    }
    for (let person of this.gedcomx.persons) {
      if (relativeIds.has(person.id)) {
        gedcomx.persons.push(person);
      }
    }
    return gedcomx;
  }

  fixRelative(isKeep, relativeReference, relativeIdSet) {
    if (relativeReference) {
      let relativeId = relativeReference.resourceId; // if it is null, parse it from the resource after the "#"
      if (relativeId !== mainPersonId) {
        relativeIdSet.add(relativeId);
      } else if (!isKeep) {
        relativeReference.resourceId = SPLIT_PERSON_ID;
        relativeReference.resource = "https://familysearch.org/ark:/61903/4:1:" + SPLIT_PERSON_ID;
      }
    }
  }

  // Copy an item that happens to also have an 'element' pointer back to the element that contained the item.
  // Temporarily set this value to null, and then restore it to both the original item and the copy.
  copyObjectWithElement(item) {
    let element = item.element;
    item.element = null;
    let copy = copyObject(item);
    item.element = element;
    copy.element = element;
    return copy;
  }
}

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

function moveElement(direction, elementId) {

  // When moving a spouse, move all the children of that spouse as well. They can be moved back individually.
  function moveChildrenOfSpouse() {
    for (let i = elementId + 1; i < split.elements.length; i++) {
      let childElement = split.elements[i];
      if (childElement.type === TYPE_CHILD && childElement.famId === element.famId) {
        childElement.direction = direction;
      } else {
        return;
      }
    }
  }

  // When moving a child, have that child's parent become "copy" in both, if not already.
  function copyParentOfChild() {
    for (let i = elementId - 1; i >= 0; i--) {
      let spouseElement = split.elements[i];
      if (spouseElement.type === TYPE_SPOUSE && spouseElement.famId === element.famId) {
        spouseElement.direction = DIR_COPY;
        return;
      }
      else if (spouseElement.type !== TYPE_CHILD || spouseElement.famId !== element.famId) {
        return;
      }
    }
  }

  //=== moveElement ===
  let element = split.elements[elementId];
  element.direction = direction;
  if (element.direction !== DIR_KEEP && element.isExtra() && !element.isSelected) {
    element.isSelected = true;
  }
  if (element.type === TYPE_SPOUSE) {
    moveChildrenOfSpouse();
  }
  if (element.type === TYPE_CHILD) {
    copyParentOfChild();
  }
  updateSummaryRows();
  updateSplitViewHtml();
  updateFlatViewHtml(comboGrouper);
}

function toggleSplitExpanded(elementIndex) {
  split.elements[elementIndex].isExpanded = !split.elements[elementIndex].isExpanded;
  updateSummaryRows();
  updateSplitViewHtml();
  updateFlatViewHtml(comboGrouper);
}

function isSingleValuedElement(element) {
  if (element.type === TYPE_FACT) {
    const factType = extractType(element.item.type);
    return factType === "Birth" || factType === "Christening" || factType === "Death" || factType === "Burial";
  }
  return false;
}

function toggleElement(elementId) {
  const element = split.elements[elementId];
  element.isSelected = !element.isSelected;
  if (element.isSelected && isSingleValuedElement(element)) {
    // If this is a single-valued element, then deselect all other elements of the same type,
    //   for elements that are the same direction or both directions.
    for (let i = 0; i < split.elements.length; i++) {
      const otherElement = split.elements[i];
      if (i !== elementId && otherElement.type === element.type && otherElement.item.type === element.item.type &&
          (otherElement.direction === element.direction || otherElement.direction === DIR_COPY || element.direction === DIR_COPY)) {
        split.elements[i].isSelected = false;
      }
    }
  }
  updateSummaryRows();
  updateSplitViewHtml();
  updateFlatViewHtml(comboGrouper);
}

function updateSplitViewHtml() {
  $("#" + SPLIT_VIEW).html(getSplitViewHtml());
}

function updateComboViewHtml() {
  $("#" + COMBO_VIEW).html(getComboViewHtml());
}

function makeButton(label, direction, element) {
  let isActive = direction !== element.direction;
  if (isActive) {
    return "<button class='dir-button' onclick='moveElement(\"" + direction + "\", " + element.elementIndex + ")'>" +
      encode(label) + "</button>";
  }
  return "<button class='dir-button' disabled>" +
    encode(label) + "</button>";
}

function getSplitViewHtml() {
  function getHeadingHtml(element) {
    let headingClass = (element.type === TYPE_CHILD && prevElement.type === TYPE_SPOUSE) ? "split-children" : "split-heading";
    let tdHeading = "<td class='" + headingClass + "'>";
    let buttonHtml = "";
    if (element.canExpand) {
      if (!prevElement || element.type !== prevElement.type) {
        // For "Names" and "Facts", add an expand/collapse button after the label
        isExpanded = element.isExpanded;
        buttonHtml = "<button class='collapse-button' onclick='toggleSplitExpanded(" + element.elementIndex + ")'>" + encode(isExpanded ? "-" : "+") + "</button>";
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
  html += "<thead><tr><th>Person to keep</th><th></th><th>Person to split out</th></tr></thead>\n";
  html += "<tbody>";
  let prevElement = null;
  let isExpanded = false;

  for (let element of split.elements) {
    if (element.status === DELETED_STATUS || element.status === MERGE_DELETED_STATUS) {
      continue; // skip elements that have been deleted. (Perhaps we eventually make these available to "reclaim" when splitting out a person)
    }
    if (!prevElement || element.type !== prevElement.type || element.famId !== prevElement.famId) {
      html += getHeadingHtml(element); // may update isExpanded
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

function getParentsHtml(relationship, delimiterHtml = "<br>&nbsp;") {
  let parentHtmls = [];
  for (let parentNumber of ["parent1", "parent2"]) {
    let relativeId = getRelativeId(relationship, parentNumber);
    if (relativeId) {
      parentHtmls.push(getRelativeHtml(relativeId, relationship.updated));
    }
  }
  return parentHtmls.join(delimiterHtml);
}

function getElementHtml(element, personId, shouldDisplay) {

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
      elementHtml = "&nbsp;" + getFactHtml(element.item, true, false);
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
    case TYPE_NOTE:
      elementHtml = getSimpleNoteHtml(element.item);
      break;
    case TYPE_ORDINANCE:
      let ows = element.item;
      elementHtml = ows.getOrdinancesHtml();
      break;
  }
  return wrapTooltip(element, elementHtml, element.elementSource ? encode(element.elementSource) : null);
}

function getSimpleNoteHtml(note) {
  let pair = [];
  if (note.subject) {
    pair.push(encode(note.subject).replaceAll("\n", "; "));
  }
  if (note.text) {
    pair.push(encode(note.text).replaceAll("\n", "<br>"));
  }
  return pair.join(": ");
}

function getExtraValueCheckbox(element) {
  return "<input id='extra-" + element.elementIndex + "' type='checkbox' " +
    (element.isExtra() ? "" : " class='current-value-checkbox'")
    + "onchange='toggleElement(" + element.elementIndex + ")'" + (element.isSelected ? " checked" : "") + ">";
}

function wrapTooltip(element, mainHtml, tooltipHtml) {
  let undecidedClass = element.direction === DIR_NULL ? " undecided" : "";
  if (!tooltipHtml) {
    return "<td class='identity-gx " + undecidedClass + "'>" + mainHtml + "</td>";
  }
  return "<td class='split-extra tooltip" + undecidedClass + "'>"
    + getExtraValueCheckbox(element)
    + "<label for='extra-" + element.elementIndex + "' class='tooltip'>" + mainHtml + "<span class='tooltiptext'>" + tooltipHtml + "</span></label></td>";
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

  function shouldInclude(element, type, isKeep) {
    return element.type === type
      && (displayOptions.shouldExpandHiddenValues || element.isVisible())
      && (element.direction === DIR_COPY || (isKeep && element.direction === DIR_KEEP) || (!isKeep && element.direction === DIR_MOVE))
  }

  function horizontalButtonsHtml(element, isKeep) {
    let html = (isKeep ? "" : makeButton("<", DIR_KEEP, element))
    + makeButton("=", DIR_COPY, element)
    + (isKeep ? makeButton(">", DIR_MOVE, element) : "");
    let checkbox = getExtraValueCheckbox(element);
    return html + (checkbox ? checkbox : " ");
  }

  function getSummaryCellHtml(columnIdForRow, isKeep, relativeElement) {
    if (columnIdForRow === COLUMN_MOTHER_NAME && grouper.usedColumns.has(COLUMN_FATHER_NAME)) {
      return ""; // mother column is grouped in same row as father row, so no cell used.
    }
    let rowspan = (columnIdForRow === COLUMN_FATHER_NAME && grouper.usedColumns.has(COLUMN_MOTHER_NAME)) ? " rowspan='2'" : "";
    let html = "<td class='summary-row" + (columnIdForRow === COLUMN_PERSON_ID ? " drag-width" : "") + "'" + rowspan + ">";
    let personRow = isKeep ? keepPersonRow : splitPersonRow;
    switch (columnIdForRow) {
      case COLUMN_PERSON_ID:
        html += personRow.getPersonIdHtml(false);
        break;
      case COLUMN_COLLECTION:
        if (isKeep) {
          html += "<b>Person to keep</b>";
        }
        else {
          html += "<b>Person to split out</b>";
        }
        break;
      case COLUMN_PERSON_NAME:
        let nameRows = [];
        split.elements.forEach(element => {
          if (shouldInclude(element, TYPE_NAME, isKeep)) {
            nameRows.push(horizontalButtonsHtml(element, isKeep) + getFullText(element.item));
          }
        });
        html += nameRows.join("<br>\n");
        break;

      case COLUMN_PERSON_FACTS:
        let factRows = [];
        split.elements.forEach(element => {
          if (shouldInclude(element, TYPE_FACT, isKeep)) {
            factRows.push(horizontalButtonsHtml(element, isKeep) + getFactHtml(element.item, true));
          }
        });
        html += factRows.join("<br>\n");
        break;
      case COLUMN_FATHER_NAME:
      case COLUMN_MOTHER_NAME:
        // Father & mother are grouped into the same row (with rowspan=2 if both are present)
        let parentRows = [];
        split.elements.forEach(element => {
          if (shouldInclude(element, TYPE_PARENTS, isKeep)) {
            parentRows.push(horizontalButtonsHtml(element, isKeep) + getParentsHtml(element.item, "<br>&amp; "));
          }
        });
        html += parentRows.join("<br>\n");
        break;
      case COLUMN_SPOUSE_NAME:
      case COLUMN_CHILD_NAME:
        if (relativeElement) {
          html += horizontalButtonsHtml(relativeElement, isKeep)
            + getRelativeHtml(relativeElement.relative.id, relativeElement.item.updated);
        }
        break;
      case COLUMN_SPOUSE_FACTS:
      case COLUMN_CHILD_FACTS:
        if (relativeElement) {
          html += getFactsHtml(relativeElement.relative, isKeep);
        }
        break;
      case COLUMN_ATTACHED_TO_IDS:
      case COLUMN_CREATED:
      case COLUMN_RECORD_DATE:
        // Leave blank.
        break;

        /*
        const TYPE_NAME = "Name";
        const TYPE_GENDER = "Gender";
        const TYPE_FACT = "Facts";
        const TYPE_PARENTS = "Parents"; // child-and-parents relationship from the person to their parents
        const TYPE_SPOUSE = "Spouse"; // Couple relationship to a spouse
        const TYPE_CHILD = "Children"; // child-and-parents relationship to a child
         */
    }
    return html + "</td>";
  }

  function addRow(columnIdForRow, rowLabel, shouldAlwaysInclude, personRowFunction, keepRelativeElement, splitRelativeElement) {
    if (shouldAlwaysInclude || grouper.usedColumns.has(columnIdForRow)) {
      html += "<tr>" + headerHtml(grouper, columnIdForRow, rowLabel, shouldAlwaysInclude, true);
      for (let groupIndex = 0; groupIndex < grouper.mergeGroups.length; groupIndex++) {
        let group = grouper.mergeGroups[groupIndex];
        if (group.groupId === grouper.splitGroupId) {
          if (displayOptions.shouldShowSummaries) {
            html += getSummaryCellHtml(columnIdForRow, true, keepRelativeElement);
            html += getSummaryCellHtml(columnIdForRow, false, splitRelativeElement);
            padGroup(groupIndex - 1);
          }
          else {
            html += "<td></td>";
          }
        }
        for (let personRow of group.personRows) {
          html += personRowFunction(personRow);
        }
        padGroup(groupIndex);
      }
      html += "</tr>\n";
    }
  }

  function addGroupNamesRow() {
    // Top row: <drag width control><group header, colspan=#person'rows' in group><gap>...
    // If viewing summaries, then also include <gap><show summaries button><gap><show hidden button>
    html += "<tr><td class='drag-width' id='drag-table'><div class='drag-table-handle'>" + encode("<=width=>") + "</div></td>"; // leave one cell for the left header column
    for (let groupIndex = 0; groupIndex < grouper.mergeGroups.length; groupIndex++) {
      let group = grouper.mergeGroups[groupIndex];
      if (group.groupId === grouper.splitGroupId) {
        // <td><show summaries button></td>[<gap><td><show hidden values button></td><gap>]
        html += "<td class='group-header'>" + showSummariesButtonHtml(true) + "</td>";
        if (displayOptions.shouldShowSummaries) {
          html += "<td class='group-header'>" + showHiddenValuesButtonHtml(true) + "</td>";
          padGroup(groupIndex - 1);
        }
      }
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
    class FamInfo {
      constructor(famId) {
        this.famId = famId;
        this.spouseElement = null;
        this.childElements = [];
      }
    }

    function getFamInfos(splitDirection) {
      if (!displayOptions.shouldShowSummaries || !grouper.splitGroupId) {
        return null;
      }
      let famInfos = [];
      let famIdMap = new Map();
      for (let element of split.elements) {
        if ((element.direction === DIR_COPY || element.direction === splitDirection) &&
            (element.type === TYPE_SPOUSE || element.type === TYPE_CHILD)) {
          let famInfo = famIdMap.get(element.famId);
          if (!famInfo) {
            famInfo = new FamInfo(element.famId);
            famIdMap.set(element.famId, famInfo);
            famInfos.push(famInfo);
          }
          if (element.type === TYPE_SPOUSE) {
            if (famInfo.spouseElement) {
              console.log("Error: multiple spouse elements for family " + element.famId);
            }
            famInfo.spouseElement = element;
          }
          else if (element.type === TYPE_CHILD) {
            famInfo.childElements.push(element);
          }
        }
      }
      return famInfos;
    }

    function findFamilyDisplay(personRow, spouseIndex) {
      let index = 0;
      for (let familyDisplay of personRow.familyMap.values()) {
        if (index === spouseIndex) {
          return familyDisplay;
        }
      }
      return null;
    }

    function getMaxSpouses() {
      let maxSpouses = 0;
      for (let group of grouper.mergeGroups) {
        for (let personRow of group.personRows) {
          let numSpouses = personRow.familyMap.size;
          if (numSpouses > maxSpouses) {
            maxSpouses = numSpouses;
          }
        }
      }
      if (keepFamInfos && keepFamInfos.length > maxSpouses) {
        maxSpouses = keepFamInfos.length;
      }
      if (splitFamInfos && splitFamInfos.length > maxSpouses) {
        maxSpouses = splitFamInfos.length;
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
      for (let famInfos of summaryFamInfoLists) {
        if (famInfos && spouseIndex < famInfos.length) {
          let famInfo = famInfos[spouseIndex];
          if (famInfo.spouseElement && !isEmpty(famInfo.spouseElement.relative.facts)) {
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
      // Look at the summary elements
      for (let famInfos of summaryFamInfoLists) {
        if (famInfos && spouseIndex < famInfos.length) {
          let famInfo = famInfos[spouseIndex];
          for (let childIndex = 0; childIndex < famInfo.childElements.length; childIndex++) {
            if (childIndex >= hasChildFacts.length) {
              hasChildFacts.push(false);
            }
            if (!isEmpty(famInfo.childElements[childIndex].relative.facts)) {
              hasChildFacts[childIndex] = true;
            }
          }
        }
      }
      return hasChildFacts;
    }

    const keepFamInfos = getFamInfos(DIR_KEEP);
    const splitFamInfos = getFamInfos(DIR_MOVE);
    const summaryFamInfoLists = [keepFamInfos, splitFamInfos];

    const maxSpouses = getMaxSpouses();
    for (let spouseIndex = 0; spouseIndex < maxSpouses; spouseIndex++) {
      let spouseLabel = "Spouse" + (spouseIndex > 0 ? " " + (spouseIndex + 1) : "");
      let keepFamInfo = keepFamInfos && spouseIndex < keepFamInfos.length ? keepFamInfos[spouseIndex] : null;
      let splitFamInfo = splitFamInfos && spouseIndex < splitFamInfos.length ? splitFamInfos[spouseIndex] : null;
      let keepSpouseElement = keepFamInfo ? keepFamInfo.spouseElement : null;
      let splitSpouseElement = splitFamInfo ? splitFamInfo.spouseElement : null;

      addBlankRow();
      addRow(COLUMN_SPOUSE_NAME, spouseLabel, true,
          personRow => td(personRow, getSpouseName(personRow, spouseIndex)),
        keepSpouseElement, splitSpouseElement);
      if (anySpouseHasFacts(grouper, spouseIndex)) {
        addRow(COLUMN_SPOUSE_FACTS, spouseLabel + " facts", true,
            personRow => td(personRow, getSpouseFacts(personRow, spouseIndex)),
          keepSpouseElement, splitSpouseElement);
      }
      if (displayOptions.shouldShowChildren) {
        // Array of boolean telling whether the nth child row needs facts for any of the person rows.
        let hasChildFacts = seeWhichChildrenHaveFacts(grouper, spouseIndex);
        for (let childIndex = 0; childIndex < hasChildFacts.length; childIndex++) {
          let childLabel = "- Child" + (hasChildFacts.length > 1 ? " " + (childIndex + 1) : "");
          let keepChildElement = keepFamInfo && childIndex < keepFamInfo.childElements.length ? keepFamInfo.childElements[childIndex] : null;
          let splitChildElement = splitFamInfo && childIndex < splitFamInfo.childElements.length ? splitFamInfo.childElements[childIndex] : null;
          addRow(COLUMN_CHILD_NAME, childLabel, true,
              personRow => td(personRow, getChildName(personRow, spouseIndex, childIndex)),
            keepChildElement, splitChildElement);
          if (hasChildFacts[childIndex]) {
            addRow(COLUMN_CHILD_FACTS, " facts", true,
                personRow => td(personRow, getChildFacts(personRow, spouseIndex, childIndex)),
              keepChildElement, splitChildElement);
          }
        }
      }
    }
  }

  function clickInfo(personRow) {
    return " onclick='handleColumnClick(event, \"" + personRow.id + "\");'";
  }

  function addBlankRow() {
    html += "<tr><th class='blank-row'></th><td class='blank-row' colspan='100%'></td></tr>\n";
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
  addRow(COLUMN_PERSON_FACTS, "Facts", false,
    personRow => td(personRow, personRow.personDisplay.facts));

  // Relative rows: Fathers, mothers, then each spouse with their children.
  if (grouper.usedColumns.has(COLUMN_FATHER_NAME) || grouper.usedColumns.has(COLUMN_MOTHER_NAME)) {
    addBlankRow();
  }
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

function showSummariesButtonHtml(isVertical) {
  return "<input type='checkbox' id='" + (isVertical ? "v-" : "") + "summary-checkbox' onChange='handleOptionChange()'" +
  (displayOptions.shouldShowSummaries ? " checked" : "") + ">Show summaries</input>";
}

function showHiddenValuesButtonHtml(isVertical) {
  return "<input type='checkbox' id='" + (isVertical ? "v-" : "") + "show-extra-values-checkbox' onChange='handleOptionChange()'" +
    (displayOptions.shouldExpandHiddenValues ? " checked" : "") + ">Show extra values</input>";
}

function getRowId(tabId, personRowId) {
  return (displayOptions.vertical ? "v_" : "") + tabId + "-" + personRowId;
}

function getGrouperHtml(grouper) {
  if (displayOptions.vertical && (grouper.tabId === FLAT_VIEW || grouper.tabId === SOURCES_VIEW || grouper.tabId === COMBO_VIEW)) {
    return getVerticalGrouperHtml(grouper);
  }
  let html = getTableHeader(grouper, false);
  let numColumns = html.match(/<th/g).length;

  for (let groupIndex = 0; groupIndex < grouper.mergeGroups.length; groupIndex++) {
    let personGroup = grouper.mergeGroups[groupIndex];
    if (personGroup.groupId === grouper.splitGroupId) {
      html += "<tr class='group-header'><td class='group-header' colspan='3'>" +
        showSummariesButtonHtml(false) + "</td>" +
        "<td class='group-header' colspan='" + (numColumns - 3) +"'>";
      if (displayOptions.shouldShowSummaries) {
        // Don't bother showing "show extra values" checkbox if we're not showing summaries.
        html += showHiddenValuesButtonHtml(false);
        html += "<button class='perform-split-button' onclick='performSplit(\"" + grouper.id + "\")'>Perform Split</button>";
      }
      html += "</td></tr>\n";
      if (displayOptions.shouldShowSummaries) {
        html += getSummaryHtml(true, grouper);
        html += "<tr class='summary-divider'><td class='summary-divider' colspan='" + numColumns + "'></td></tr>";
        html += getSummaryHtml(false, grouper);
      }
    }
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

function getSummaryHtml(isKeep, grouper) {
  let personRow = isKeep ? keepPersonRow : splitPersonRow;
  return personRow.getHtml(grouper.usedColumns, grouper.tabId, isKeep);
}

function getAddGroupButtonHtml(grouper) {
  return "<button class='add-group-button' onclick='createGroup(\"" + grouper.id + "\")'>New group</button>\n";
}

function getGroupHeadingHtml(personGroup, groupIndex) {
  let isEmptyGroup = isEmpty(personGroup.personRows);
  // Close button for empty groups
  return (isEmptyGroup ? "<button class='close-button' onclick='deleteEmptyGroup(\"" + personGroup.groupId + "\")'>X</button>" : "")
    // Group name
    + "<div class='group-name' contenteditable='true' id='" + personGroup.groupId
    + "' onkeyup='updateGroupName(\"" + personGroup.groupId + "\")'>"
    + encode(personGroup.groupName) + "</div>"
    // "Add to Group" button
    + "<button class='add-to-group-button' onclick='moveSelectedToGroup(\"" + personGroup.groupId + "\")'>Add to group</button>"
    // "Apply to Split" button
    + (groupIndex < 1 || isEmptyGroup ? "" : "<button class='apply-button' onclick='splitOnGroup(\"" + personGroup.groupId + "\")'>Preview split</button>");
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
    headerHtml(grouper, COLUMN_PERSON_FACTS, "Facts") +
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
  let mergeRows = buildMergeRows(rootMergeNode, maxDepth - 1, true);
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
    const isHierarchyView = getCurrentTab() === MERGE_VIEW;
    for (let fact of facts) {
      let factType = extractType(fact.type);
      if (shouldIncludeType(factType) && shouldDisplayStatus(fact.status, isHierarchyView)) {
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

function joinNonNullElements(list, delimiter) {
  return list.filter(Boolean).join(delimiter);
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

// Add a copy of the given fact to the given person. Insert it before any other fact that it is
//   earlier than (by date; or birth < christening < most other events < death < burial).
function addFact(person, fact, isOrig, isPartOfMerge) {
  let factCopy = copyObject(fact);
  factCopy.status = getAddStatus(isOrig, isPartOfMerge);
  if (!person.hasOwnProperty("facts")) {
    person.facts = [];
  }
  let factIndex = 0;
  while (factIndex < person.facts.length) {
    if (compareFacts(factCopy, person.facts[factIndex]) < 0) {
      // new fact is 'less than' the fact at index [factIndex], so insert it there.
      person.facts.splice(factIndex, 0, factCopy);
      return;
    }
    factIndex++;
  }
  person.facts.push(factCopy);
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
  let elementCopy = copyObject(element);
  if (listHolder.hasOwnProperty(listName)) {
    listHolder[listName].push(elementCopy);
  }
  else {
    listHolder[listName] = [elementCopy];
  }
  elementCopy.status = getAddStatus(isOrig, isPartOfMerge);
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
 * @param origElementListContainer - Original container (like a person) before making a copy of it, to get id from it.
 *            (This is from the change log entry, so won't have a status).
 */
function updateInList(listContainer, listName, elementListContainer, isOrig, isPartOfMerge, origElementListContainer) {
  function hasSameId(a, b) {
    if (a.hasOwnProperty("id") && a["id"] === b["id"]) {
      return true;
    }
    let idA = getPrimaryIdentifier(a);
    let idB = getPrimaryIdentifier(b);
    return !!(idA && idA === idB);
  }

  let updatedElementWithId = copyObject(elementListContainer[listName][0]);
  let origElementWithId = origElementListContainer ? origElementListContainer[listName][0] : updatedElementWithId;
  let existingList = listContainer[listName];
  if (existingList) {
    for (let i = existingList.length - 1; i >= 0; i--) {
      if (hasSameId(existingList[i], origElementWithId)) {
        if (isSameInformation(updatedElementWithId, existingList[i], listName)) {
          updatedElementWithId.status = existingList[i].status;
          existingList[i] = updatedElementWithId;
        }
        else {
          if (setDeletedStatus(existingList[i], isOrig)) {
            existingList[i] = updatedElementWithId;
          } else {
            existingList.push(updatedElementWithId);
          }
          updatedElementWithId.status = getAddStatus(isOrig, isPartOfMerge);
        }
        return;
      }
    }
  }
  console.log("Failed to find element in " + listName + "[] with id " + updatedElementWithId["id"]);
}

function isSameInformation(a, b, listName) {
  function same(path) {
    return getProperty(a, path) === getProperty(b, path);
  }
  switch (listName) {
    case "names":
      return a["nameForms"][0]["fullText"] === b["nameForms"][0]["fullText"];
    case "facts":
      return same("type") && same("date.original") && same("place.original") && same("value");
    case "sources":
      return same("about");
    case "notes":
      return same("subject") && same("text");
  }
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

function doInList(listContainer, listName, elementListContainer, operation, isOrig, isPartOfMerge, origElementListContainer) {
  if (operation === "Create") {
    addToList(listContainer, listName, elementListContainer[listName][0], isOrig, isPartOfMerge);
  }
  else if (operation === "Update") {
    updateInList(listContainer, listName, elementListContainer, isOrig, isPartOfMerge, origElementListContainer);
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
        obj.status = "kept-" + obj.status;
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
    for (let note of getList(person, "notes")) {
      mapStatus(note);
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
   - "deleted": But we also want to show what original information was deleted (shown in red),
     so instead of removing it from the GedcomX, we mark it with a status of 'deleted', so we can display it if needed.
     One exception is that if we are deleting something 'orig' within that first 24-hour period, we actually remove it,
     since the original identity didn't end up with it, either.
   - "added": We also want to show what information was added after that original identity period, so we can show
     that in a different color (like green) to indicate that it wasn't part of the original identity, but was added later.
      - If something with "added" gets deleted, we do actually remove it, because we don't need to show it as a removed
        part of the original identity. It actually goes away.
   - "changed": Since gender can only have one value, it is marked as "changed" if it has changed after the initial identity
       period. This only happens if it actually changed from Male to Female or vice-versa. "Unknown" is considered "deleted".
   - "merge-orig/added/deleted": After a merge, we want to know which things came in to the person as a result of a merge.
     These are marked with "merge-orig" for things that were "orig"; "merge-added" for things that were added after the
     original identity, and "merge-deleted" for things that were once "orig" or "merge-orig" but were deleted before the
     most recent merge. When showing a merge node, we will generally not show any of the "merge-..." things, because
     they'll be shown below. But if we "roll up" the merge node, then all of these things are available to show.
   - "kept-orig/added/deleted": After a merge, we want to know which things are on the merge node because they were already
     there before the merge, so that we can show/hide this in the merge hierarchy view. In the flat or combo view, we
     want to be able to know which things were 'kept-orig' for this person id separately from those that were 'merge-orig'
     that came in from another person id during a merge.
   - When information is added to a merge node's GedcomX, the normal "added" tag is used.
   - If something is deleted that had a tag of "added", it is removed, since there's no need to display it at all.
   - If something is deleted during the original period, before a merge, it will be removed completely, since it was likely a mistake.
   - If something is deleted later that had a tag of "orig" or "merge-orig" or "kept-orig", it is marked with "deleted", since we need to show
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
const MERGE_ORIG_STATUS   = 'merge-orig'; // On original identity of duplicate and brought in during merge
const MERGE_ADDED_STATUS  = 'merge-added'; // Added after original identity of duplicate and brought in during merge
const MERGE_DELETED_STATUS= 'merge-deleted'; // On duplicate but deleted before the most recent merge
const KEPT_ORIG_STATUS    = 'kept-orig'; // On original identity of survivor and kept during merge
const KEPT_ADDED_STATUS   = 'kept-added'; // Added after original identity of survivor and kept during merge
const KEPT_DELETED_STATUS = 'kept-deleted'; // On survivor but deleted before the most recent merge

// Tell whether an object (fact or relationship) should be included, based on
// 1) 'status', the object's status and
// 2) the display options (shouldIncludeAdditions; shouldShowDeletions; shouldIncludeInfoFromMerge)
function shouldDisplayStatus(status, isHierarchyView) {
  if (!status || status === ORIG_STATUS) {
    return true;
  }
  switch(status) {
    // Future: May need to refine this for merge hierarchy view, in which case we'll need to pass in 'isMergeHierarchy'
    case ADDED_STATUS:
    case CHANGED_STATUS:
      return displayOptions.shouldShowAdditions;
    case DELETED_STATUS:
      return displayOptions.shouldShowDeletions && displayOptions.shouldShowAdditions;
    case MERGE_ORIG_STATUS:
    case MERGE_ADDED_STATUS:
      return displayOptions.shouldRepeatInfoFromMerge;
    case MERGE_DELETED_STATUS:
      return displayOptions.shouldShowDeletions && displayOptions.shouldRepeatInfoFromMerge;
    case KEPT_ORIG_STATUS:
      return displayOptions.shouldRepeatInfoFromMerge || !isHierarchyView;
    case KEPT_ADDED_STATUS:
      return displayOptions.shouldShowAdditions && (displayOptions.shouldRepeatInfoFromMerge || !isHierarchyView);
    case KEPT_DELETED_STATUS:
      return displayOptions.shouldShowDeletions && (displayOptions.shouldRepeatInfoFromMerge || !isHierarchyView);
  }
  return true;
}

// See above for details on status.
// Update the given status from orig or merge-orig to deleted; or merge-added to merge-deleted.
// If 'isOrig' is true, then the deletion is being done during the original identity phrase, so the object can be actually deleted.
// If 'isPartOfMerge' is true, then the deletion is being done off of the survivor during a merge.
// Return true if the given entity should be actually deleted (i.e., if the status is "added" or isOrig is true), or false if it should be kept.
function setDeletedStatus(entity, isOrig, isPartOfMerge) {
  let status = entity.status;
  if (status === ADDED_STATUS || isOrig) {
    return true;
  }
  else {
    if (status === ORIG_STATUS) {
      status = isPartOfMerge ? KEPT_DELETED_STATUS : DELETED_STATUS;
    }
    else if (status === MERGE_ORIG_STATUS || status === MERGE_ADDED_STATUS) {
      status = MERGE_DELETED_STATUS;
    }
    else if (status === KEPT_ORIG_STATUS || status === KEPT_ADDED_STATUS) {
      status = KEPT_DELETED_STATUS;
    }
    else if (status === DELETED_STATUS || status === MERGE_DELETED_STATUS) {
      console.log("Deleting deleted gender or something.");
    }
    else {
      console.log("Unrecognized status when deleting gender or something: " + status);
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
  let origId = getProperty(changeInfo, "original.resourceId");
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
    let origPerson = findPersonByLocalId(entry, origId);
    let entryPerson = findPersonByLocalId(entry, resultingId);
    if (entryPerson.hasOwnProperty("facts") && entryPerson.facts.length === 1) {
      combo = operation + "-" + "(Fact)";
    }
    switch (combo) {
      case "Create-Gender":
        gxPerson.gender = copyObject(entryPerson.gender);
        gxPerson.gender.status = getAddStatus(isOrig, isPartOfMerge);
        break;
      case "Update-Gender":
        let prevGender = gxPerson.gender;
        gxPerson.gender = copyObject(entryPerson.gender);
        gxPerson.gender.status = oppositeGender(gxPerson.gender, prevGender) ? CHANGED_STATUS : getAddStatus(isOrig);
        break;
      case "Delete-Gender":
        if (setDeletedStatus(gxPerson["gender"], isOrig, isPartOfMerge)) {
          delete gxPerson["gender"];
        }
        break;
      case "Create-BirthName":
      case "Update-BirthName":
      case "Delete-BirthName":
        doInList(gxPerson, "names", entryPerson, operation, isOrig, isPartOfMerge, origPerson);
        break;
      case "Create-SourceReference":
      case "Update-SourceReference":
      case "Delete-SourceReference":
        doInList(gxPerson, "sources", entryPerson, operation, isOrig, isPartOfMerge, origPerson);
        break;
      case "Create-(Fact)":
        console.assert(entryPerson.hasOwnProperty("facts") && entryPerson.facts.length === 1, "Expected one fact in entry");
        console.assert(extractType(entryPerson["facts"][0].type) === objectType || objectType === "Fact", "Mismatched fact type in fact creation: " + extractType(entryPerson["facts"][0].type) + " != " + objectType);
        addFact(gxPerson, entryPerson.facts[0], isOrig, isPartOfMerge);
        break;
      case "Delete-(Fact)":
        doInList(gxPerson, "facts", entryPerson, operation, isOrig, isPartOfMerge);
        break;
      case "Update-(Fact)":
        doInList(gxPerson, "facts", entryPerson, operation, isOrig, isPartOfMerge, origPerson);
        break;
      case "Create-Person":
      // Do nothing: We already have a GedcomX record with an empty person of this ID to start with.
      case "Create-EvidenceReference":
        // Do nothing: We aren't handling memories at the moment.
        break;
      case "Create-Note":
      case "Update-Note":
      case "Delete-Note":
        doInList(gxPerson, "notes", entryPerson, operation, isOrig, isPartOfMerge, origPerson);
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

<h2>Instructions</h2>
<p>To use this prototype, first log in to FamilySearch. Then replace the "PID" parameter in the URL with the person
ID of someone in Family Tree that may be munged. Then explore the data in each of the various tabs.</p>
<h3>Display options</h3>
On most of the views, you can do the following:
<ul>
  <li><b>Resize</b>. Drag the column headers to resize the columns.</li>
  <li><b>Sort</b>. Click on a column header to sort (except in Merge view). Click on the "place" word to sort by place instead of date.</li>
  <li><b>Select</b>. Click on a row to select or deselect it. Shift-click to select a range of rows. Hit "escape" to clear selections.</li>
  <li><b>Group</b>. Click "Create Group" to move the selected rows to a new group, or "Add to group" to add selected rows to it.
    <ul><li>Click on the name of the group to give it a helpful name or add notes.</li></ul>
  </li>
  <li><b>Notes</b>. Click on a cell in the "Notes" field to add a note for your own use. (Rich edit like bold and italics are available).</li>
  <li><b>Apply</b>. Click the purple "Preview split" button to use that group as the one to split out.
                    This will cause a summary view to appear in the Combo View.</li>
  <li><b>Display options</b>. The display options at the top show or hide information, so you can change your focus and 
       fit things on the screen. Sometimes it's helpful to hide some information temporarily.
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
  <li>Click on the purple "Preview split" button to apply information from that group to the Split view.</li>
  <li>This will also create two "Summary" rows: One with the person to "keep", and the other with the person to "split out."</li>
  <ul>
    <li>Click the up or down arrows next to a name, fact, pair of parents, spouse or child to move that information to the
        other group, or click "=" to copy it to both.</li>
    <li>Values with a checkbox next to them are from a source or from a person that was merged out of existence.
        Check those values to keep them.</li>
    <li>Toggle the "Show extra values" checkbox to show or hide these extra values.</li>
  </ul>
</ul>
<h3>Split view</h3>
<p>This screen lets you decide, for every bit of information, whether it should remain with the existing person,
be split out to the new person, or be copied so that it is on both (if the information is true about both people).</p>
<p>Since it would be difficult to know how to best split things up if doing it by hand, use one of the other
  views and click on "Preview split" to pre-populate the decisions in the Split view, and then fine-tune it by hand.</p>
<ul>
  <li>Click &lt;, = or &gt; to keep, copy or split out a piece of information.</li>
  <li>Click the "+"/"-" buttons to show/hide names and facts that appear in sources or earlier versions of a
  Family Tree person, but which are not currently on the latest person.</li>
  <li>Check boxes next to any of those "hidden" values to show that they should be kept/added.</li>
  <li>Sometimes you'll have to choose which value (like which of several possible birth dates) you want
  to choose for one person or the other.</li>
  <li>As mentioned above, the Combo view has a corresponding pair of "summary" rows that are in sync with the Split view.
      It may be easier to make decisions in the Combo view, where you can see the information from the other views.</li>
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
