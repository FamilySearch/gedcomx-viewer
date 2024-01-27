// IDs to try out:
//   LZBY-X8J - Clarence Gray. 5 PIDs that all merge into the same one. (Wife Bertha Nickell (later Bishop): L2DF-DRG)
//   9HMF-2S1 - Alice Moore. Example from Kathryn
//   G2FN-RZY - Theoore Freise, which Robby and Karl were working on. Has lots of data and persons added after some merging.

/* Still to do:
 - Select rows
   - Drag to move to new or existing group
   - Double-click value to select everyone with that value
 - Combined "identity" (original) vs. "end" view.
   - Styles for (a) original identity data, (b) original data that was later deleted,
     (c) data added after original identity, (d) added data that was later deleted
 - Toolbar with options for:
   - Facts: all, vitals, none
   - Children show/hide.
 - Collapse merge node (and summarize all info in that one row).
 - Combined person/sources view.
 - Ordinances
 - Memories
 - Move "lollipops" (conclusions made after creation or merge) separately from identities.
*/

// Array of all entries from all change logs, sorted from newest to oldest timestamp, and then by column.
let allEntries = [];

// Note that these are fetched after the ChangeLogHtml is built, so if a user hovers over a cell,
//   it will only include the extra info (like source title or relative name) if that has been fetched.
// Map of source URL -> {title: <title>, ark: <ark>, [and perhaps, gx: <recordGx>]} (initially source URL -> null until fetched).
let sourceMap = {}

// Map of relative personId -> timestamp -> {"name":, "gender":, "lifespan"} (and, eventually, "ts-name": name at that timestamp).
//   where the timestamps are all the timestamps at which a change log of the main person(s) reference that relative.
//   (Initially, the name is just the name given in the change log, which appears to be the latest name)
//   todo: fetch relatives' change logs and replace the latest name with the name at the time of the timestamp.
let relativeMap = {}

// Map of duplicatePersonId -> array of [{ "survivor": <survivorPersonId>, "timestamp": <timestamp of merge>}]
let mergeMap = {}

// Fetch the change log entries for the person given by the change log URL.
function buildChangeLogView(changeLogUrl, sessionId, $mainTable, $status) {
  let context = parsePersonUrl(changeLogUrl);
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
  fetchChangeLog(context.personId, context, changeLogMap, fetching, $mainTable, $status)
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
 */
function fetchChangeLog(personId, context, changeLogMap, fetching, $mainTable, $status, nextUrl=null) {
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
  if (receivedNextUrl) {
    $status.html($status.html().replace("Fetching next change log for " + personId, "Received next change log for " + personId));
  } else {
    let logHtml = $status.html();
    logHtml = logHtml.replace("Fetching change log for " + personId, "Received change log for " + personId);
    $status.html(logHtml);
  }
  fetching.splice(fetching.indexOf(personId), 1); // Remove personId from the fetching array
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
  if (fetching.length === 0) {
    // All the change logs that needed to be fetched have now been fetched, and this is the last one.
    // So create the Html.
    makeMainHtml(context, changeLogMap, $mainTable);
    // Then, kick off the fetching of relatives and sources info, and update the table when done.
    fetchRelativesAndSources(changeLogMap, $status, context);
  }
}

const CHILD_REL = "child-and-parents-relationships"
const COUPLE_REL = "http://gedcomx.org/Couple"
const PARENT_CHILD_REL = "http://gedcomx.org/ParentChild"

function fetchRelativesAndSources(changeLogMap, $status, context) {
  // Populate sourceMap[sourceUrl] = null, and relativeMap[relativeId] = null,
  // so that the keys of these maps can be used to fill in the values.
  for (let personId of Object.keys(changeLogMap)) {
    let entries = changeLogMap[personId];
    for (let entry of entries) {
      let timestamp = entry.updated.toString();
      if (entry.content && entry.content.gedcomx) {
        let gedcomx = entry.content.gedcomx;
        gatherSources(gedcomx.persons);
        // gatherSources(gedcomx.relationships);
        // gatherSources(gedcomx[CHILD_REL])
        gatherNames(gedcomx, timestamp,"relationships", ["person1", "person2"]);
        gatherNames(gedcomx, timestamp, CHILD_REL, ["parent1", "parent2", "child"]);
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
      }
    });
  }
}

function gatherSources(list) {
  if (list) {
    for (let entity of list) {
      let sourceUrl = getSourceUrl(entity);
      if (sourceUrl) {
        sourceMap[sourceUrl] = null;
      }
    }
  }
}

function getSourceUrl(entity) {
  if (entity && entity.sources && entity.sources.length > 0) {
    return entity.sources[0].description;
  }
}

function gatherNames(gedcomx, timestamp, listName, personKeys) {
  if (gedcomx[listName]) {
    for (let relationship of gedcomx[listName]) {
      for (let relative of personKeys) {
        if (relationship[relative]) {
          let relativeId = relationship[relative].resourceId;
          for (let person of gedcomx.persons) {
            if (person.id === relativeId) {
              let tsMap = relativeMap[relativeId];
              if (!tsMap) {
                tsMap = {}
                relativeMap[relativeId] = tsMap;
              }
              tsMap[timestamp] = person.display;
            }
          }
        }
      }
    }
  }
}

class SourceInfo {
  constructor(sd) {
    this.title = ("titles" in sd && sd.titles.length && "value" in sd.titles[0]) ? sd.titles[0].value : "";
    this.isExtraction = sd.resourceType === "FSREADONLY";
    this.ark = ("about" in sd) ? sd.about : null;
    this.gx = null;
  }
}

function receiveSourceDescription(gedcomx, $status, context, fetching, sourceUrl, sourceMap) {
  if (gedcomx && "sourceDescriptions" in gedcomx && gedcomx.sourceDescriptions.length) {
    let sourceInfo = new SourceInfo(gedcomx.sourceDescriptions[0]);
    sourceMap[sourceUrl] = sourceInfo;
    fetching.splice(fetching.indexOf(sourceUrl), 1)
    if (sourceInfo.ark.includes("ark:/61903/")) {
      fetching.push(sourceInfo.ark);
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
        url: sourceInfo.ark,
        success: function (gedcomx) {
          receivePersona(gedcomx, $status, context, fetching, sourceInfo);
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

function getMainPersonaArk(gx) {
  let sd = getSourceDescription(gx, null);
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

function receivePersona(gedcomx, $status, context, fetching, sourceInfo) {
  fixEventOrders(gedcomx);
  sourceInfo.gx = gedcomx;
  fetching.splice(fetching.indexOf(sourceInfo.ark), 1);
  let personaArk = getMainPersonaArk(gedcomx);
  if (personaArk !== sourceInfo.ark) {
    // This persona has been deprecated & forwarded or something, so update the 'ark' in sourceInfo to point to the new ark.
    sourceInfo.ark = personaArk;
    sourceInfo.collectionName = getCollectionName(gedcomx);
  }
  if (fetching.length) {
    setStatus($status, "Fetching " + fetching.length + "/" + sourceMap.size + " sources...");
  }
  else {
    finishedReceivingSources($status);
  }
}

function finishedReceivingSources($status) {
  clearStatus($status);
  let sourcesHtml = getSourcesViewHtml();
  $("#" + SOURCES_VIEW).html(sourcesHtml);
  makeTableHeadersDraggable();
}

// context - Map containing baseUrl, personId (of the main person), and optional "sessionId"
function formatTimestamp(ts) {
  function pad(n) {
    return String(n).padStart(2, '0');
  }
  let date = new Date(ts);
  return "<span class='ts-date'>" + String(date.getFullYear()) + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
    "</span> <span class='ts-time'>" + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) +
    "." + String(ts).slice(String(ts).length - 3) + "</span>";
}


// ==================== HTML ===================================
// changeLogMap - Map of personId -> GedcomX of the change log for that personId.
const MERGE_VIEW = "merge-hierarchy";
const FLAT_VIEW = "flat-view";
const SOURCES_VIEW = "sources-view";

function makeMainHtml(context, changeLogMap, $mainTable) {
  let personMinMaxTs = {};
  let personIds = [];
  let allEntries = combineEntries(context.personId, changeLogMap, personIds, personMinMaxTs);
  let html =
    "<div id='tabs'><ul>\n" +
    "  <li><a href='#change-logs-table'><span>Change Logs</span></a></li>\n" +
    "  <li><a href='#" + MERGE_VIEW + "'><span>Merge view</span></a></li>\n" +
    "  <li><a href='#" + FLAT_VIEW + "'><span>Flat view</span></a></li>\n" +
    "  <li><a href='#" + SOURCES_VIEW + "'><span>Sources view</span></a></li>\n" +
    // Display Options
    "  <li><div id='settings'><form id='fact-level-radio' onchange='handleOptionChange()'>Facts: " +
    "<input type='radio' name='fact-level' id='fact-" + INCLUDE_ALL_FACTS + "' value='" + INCLUDE_ALL_FACTS + "'>All</input>" +
    "<input type='radio' name='fact-level' id='fact-" + INCLUDE_VITAL_FACTS + "' value='" + INCLUDE_VITAL_FACTS + "'>Vitals</input>" +
    "<input type='radio' name='fact-level' id='fact-" + INCLUDE_NO_FACTS + "' value='" + INCLUDE_NO_FACTS + "'>None</input></form>, " +
    "Display children: <input type='checkbox' id='children-checkbox' onchange='handleOptionChange()'></div></li>" +
    "</ul>\n" +
    "<div id ='change-logs-table'>" + getChangeLogTableHtml(allEntries, personIds, personMinMaxTs) + "</div>\n" +
    "<div id='" + MERGE_VIEW + "'>" + getMergeHierarchyHtml(allEntries) + "</div>\n" +
    "<div id='" + FLAT_VIEW + "'>" + getFlatViewHtml(allEntries) + "</div>\n" +
    "<div id='" + SOURCES_VIEW + "'>Sources grid...</div>\n" +
    "<div id='details'></div>\n";// +
    // "<div id='rel-graphs-container'>\n" +
    // "  <div id='close-rel-graphs' onclick='hideRelGraphs()'>X</div>\n" +
    // "  <div id='rel-graphs'></div>\n" +
    // "</div>\n";
  html += "</div>";
  $mainTable.html(html);
  $("#rel-graphs-container").hide();
  $("#tabs").tabs({active: 2});
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

let pressed = false;
let start = undefined;
let startX;
let startWidth;

function makeTableHeadersDraggable() {
  $("table th").mousedown(function(e) {
    start = $(this);
    pressed = true;
    startX = e.pageX;
    startWidth = $(this).width();
    $(start).addClass("resizing");
  });

  $(document).mousemove(function(e) {
    if(pressed) {
      $(start).width(startWidth+(e.pageX-startX));
      e.preventDefault();
    }
  });

  $(document).mouseup(function() {
    if(pressed) {
      $(start).removeClass("resizing");
      pressed = false;
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
          "class='timestamp" + rowClass + "'>" + formatTimestamp(entry.updated) + "</td>";
    }

    for (let column = 0; column < personIds.length; column++) {
      let personId = personIds[column];
      if (column === entry.column) {
        html += "<td class='entry" + rowClass + "' id='entry-" + entry.entryIndex + "' onMouseover='showDetails(" + entry.entryIndex + ")' onMouseout='hideDetails()'>" + getEntryHtml(entry) + "</td>";
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
            let mergeList = mergeMap[removedPersonId];
            if (!mergeList) {
              mergeList = [];
              mergeMap[removedPersonId] = mergeList;
            }
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

function showDetails(entryIndex){
  let html = getEntryDetailsHtml(entryIndex);
  let $entryElement = $("#entry-" + entryIndex);
  let $details = $("#details");
  $details.html(html);
  let offset = $entryElement.offset();
  let entryLeft = offset.left;
  let entryRight = entryLeft + $entryElement.width();
  let windowWidth = $(document).width();
  if (entryLeft > windowWidth - entryRight) {
    // More room to left of entry element than to right.
    $details.css('left', '');
    $details.css('right', windowWidth - entryLeft + 10);
  }
  else {
    $details.css('right', '');
    $details.css('left', entryRight + 10);
  }
  $details.css('top', offset.top);
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
          html += changeHtml(operation, getName(originalPerson), getName(resultingPerson));
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
        let subjectClass = (note.text && note.text.includes(note.subject)) ? "note-redundant-subject" : "note-subject";
        html += "<span class='" + subjectClass + "'>" + encode("Subject: " + note.subject.replaceAll("\n", "; ")) + "</span><br>\n";
      }
      if (note.text) {
        html += "Note: <span class='note'>" + encode(note.text).replaceAll("\n", "<br>\n") + "</span><br>\n";
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
  let mergeList = mergeMap[removedPersonId];
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

function getFactHtml(fact) {
  let type = extractType(fact.type);
  let date = fact.date ? fact.date.original : null;
  let place = fact.place ? fact.place.original : null;
  let value = fact.value ? fact.value : null;
  let html = "<span class='fact-type'>" + encode(type ? type : "<unknown fact type>");
  if (date || place || value) {
    html += ":</span> ";
    if (value) {
      html += "<span class='value'>" + encode(value + (date || place ? ";" : "")) + "</span>";
    }
    if (date && place) {
      html += "<span class='date'>" + encode(date + ";") + "</span> <span class='place'>" + encode(place) + "</span>";
    } else {
      html += date ? "<span class='date'>" + encode(date) + "</span>" : "<span class='place'>" + encode(place) + "</span>";
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
  return rel[key.toLowerCase()] ? rel[key.toLowerCase()].resourceId : null;
}

function getRelativeName(relativeId, timestamp) {
  let tsMap = relativeMap[relativeId];
  if (tsMap) {
    let relativeDisplay = tsMap[timestamp];
    if (relativeDisplay && relativeDisplay.name) {
      return relativeDisplay.name;
    }
  }
  return "";
}

function getSourceReferenceHtml(entity) {
  let sourceUrl = getSourceUrl(entity);
  let sourceInfo = sourceMap[sourceUrl];
  if (sourceInfo && ("title" in sourceInfo || "ark" in sourceInfo)) {
    let title = "title" in sourceInfo ? "<span class='source-title'>" + encode(sourceInfo.title) + "</span><br>" : "";
    let ark = "ark" in sourceInfo ? "<span class='source-ark'>" + encode(sourceInfo.ark) + "</span><br>" : "";
    return "<br>" + title + ark + "<br>\n" + getChangeMessage(sourceInfo);
  }
}

function getName(person) {
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
    // Flag for whether changes have been applied to the GedcomX after
    this.isLater = false;
    let survivorGx = survivorMergeNode ? survivorMergeNode.getLatestGx() : null;
    // GedcomX within 24 hours of the person's creation, or at the initial time of merge.
    this.gedcomx = survivorGx ? copySurvivorGx(survivorGx) : getInitialGedcomx(personId);
    // GedcomX with all changes applied up until the next merge.
    this.endGx = null;

    this.parentNode = null;
    this.prevNode = survivorMergeNode;
    this.dupNode = duplicateMergeNode;
    this.indent = "";
  }

  getLatestGx() {
    return this.endGx ? this.endGx : this.gedcomx;
  }

  isLeafNode() {
    return !this.prevNode && !this.dupNode;
  }

  /**
   * Update the GedcomX of this MergeNode with one change log entry.
   * - If the entry is within 24 hours of the first entry (or happened in 2012, during the Great Migration), add it to 'identityGx'.
   * - Otherwise, add it to 'endGx' (creating it from a copy of identityGx if it hasn't been created yet)
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
    else if (!this.endGx && this.firstEntry && hasBeenLongEnough(entry.updated, this.firstEntry.updated, entry)) {
      // We got an entry that is over 24 hours after the first one for this person (and after 2012),
      // so start applying changes to a new copy of the GedcomX that represents the "latest"
      // instead of the 'initial identity'.
      this.endGx = copyObject(this.gedcomx);
    }
    let gedcomx = this.endGx ? this.endGx : this.gedcomx;
    let isInitialIdentity = !this.endGx && !this.prevNode && !this.dupNode;
    updateGedcomx(gedcomx, entry, isInitialIdentity);
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
  constructor(person, nameClass, coupleRelationship, shouldIncludeId) {
    this.person = person;
    this.name = "<span class='" + nameClass + "'>" + encode(getPersonName(person)) + "</span>";
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
    for (let grouper of [mergeGrouper, flatGrouper, sourceGrouper]) {
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

// ===============
// Map of groupId -> Grouper object that the groupId is found in.
let grouperMap = {};
// Map of personRowId -> PersonRow object with that id
let personRowMap = {};
// Grouper objects to handle selection logic in each view.
let mergeGrouper;
let flatGrouper;
let sourceGrouper;

// Global id used for MergeRow, MergeGroup and Grouper.
let nextPersonRowId = 0;
const ROW_SELECTION = 'selected';


const INCLUDE_NO_FACTS = "none";
const INCLUDE_VITAL_FACTS = "vital";
const INCLUDE_ALL_FACTS = "all";

class DisplayOptions {
  constructor() {
    // Option (INCLUDE_NO/VITAL/ALL_FACTS) for which facts to display.
    this.factsToInclude = INCLUDE_ALL_FACTS;
    this.shouldDisplayChildren = false;
    // Flag for whether to include 'identity' (up to 24 hours after creation or 2012 + 2015 source attachments)
    // and also 'latest' (just before merge).
    this.shouldIncludeBeforeAfter = false;
  }
}

let displayOptions = new DisplayOptions();

// Set the displayed options according to the global displayOptions variable's contents.
function initOptionsDisplay() {
  $("#fact-" + displayOptions.factsToInclude).prop("checked", true);
  $("#children-checkbox").prop("checked", displayOptions.shouldDisplayChildren);
}

function handleOptionChange() {
  displayOptions.factsToInclude = $("input[name = 'fact-level']:checked").val();
  displayOptions.shouldDisplayChildren = $("#children-checkbox").prop("checked");
  updatePersonFactsDisplay();
  updateIncludedColumns();
  updateTabsHtml();
}

function updatePersonFactsDisplay() {
  for (let grouper of [mergeGrouper, flatGrouper, sourceGrouper]) {
    for (let personRow of grouper.getAllRows()) {
      personRow.updatePersonDisplay();
    }
  }
}

function updateIncludedColumns() {
  for (let grouper of [mergeGrouper, flatGrouper, sourceGrouper]) {
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
    this.usedColumns = usedColumns;
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
  constructor(mergeNode, personId, gedcomx, endGedcomx, indent, maxIndent, isDupNode, grouper, collectionName, personaArk) {
    this.sortKey = "";
    this.person = findPersonInGx(gedcomx, personId);
    this.personId = personId;
    this.collectionName = collectionName;
    this.personaArk = personaArk;
    this.gedcomx = gedcomx;
    this.id = "mr-" + nextPersonRowId++;
    personRowMap[this.id] = this;
    grouperMap[this.id] = grouper;
    this.mergeNode = mergeNode;
    this.personDisplay = new PersonDisplay(this.person, "person");
    this.families = []; // Array of FamilyDisplay, one per spouse (and children with that spouse), and one more for any children with no spouse.
    this.fathers = []; // Array of PersonDisplay. Unknown-gender parents are also included here. (Note that parents are not paired up).
    this.mothers = []; // Array of PersonDisplay
    this.isSelected = false;
    this.origOrder = 0;
    this.note = "";
    // Map of personId -> PersonDisplay for mothers and fathers.
    let fatherMap = {};
    let motherMap = {};
    // Map of spouseId -> FamilyDisplay for that spouse and children with that spouse.
    // Also, "<none>" -> FamilyDisplay for list of children with no spouse.
    let familyMap = {};
    let includePersonId = !collectionName;
    this.handleCoupleAndTernaryRelationships(gedcomx, personId, fatherMap, motherMap, familyMap, includePersonId);
    this.handleParentChildRelationships(gedcomx, personId, fatherMap, motherMap, familyMap, includePersonId);
    this.sortFamilies();

    if (endGedcomx) {
      this.endRow = new PersonRow(null, personId, endGedcomx, null);
    }
    this.indent = indent;
    this.maxIndent = maxIndent;
    this.isDupNode = isDupNode;
  }

  updatePersonDisplay() {
    function updateRelativeFacts(relatives) {
      for (let relative of relatives) {
        relative.updateFacts();
      }
    }
    this.personDisplay.updateFacts();
    updateRelativeFacts(this.fathers);
    updateRelativeFacts(this.mothers);
    for (let family of this.families) {
      if (family.spouse) {
        family.spouse.updateFacts();
      }
      updateRelativeFacts(family.children);
    }
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

    switch (columnName) {
      case "collection":
        sortKey = this.collectionName;
        break;
      case "person-id":
        sortKey = this.personId;
        break;
      case "person-name":        sortKey = getPersonName(this.person);             break;
      case "person-facts":       sortKey = getFirstFactDate(this.person);          break;
      case "person-facts-place": sortKey = getFirstFactPlace(this.person);         break;
      case "father-name":        sortKey = getFirstRelativeName(this.fathers);     break;
      case "mother-name":        sortKey = getFirstRelativeName(this.mothers);     break;
      case "spouse-name":        sortKey = getFirstSpouseName(this.families);      break;
      case "spouse-facts":       sortKey = getFirstSpouseFactDate(this.families);  break;
      case "spouse-facts-place": sortKey = getFirstSpouseFactPlace(this.families); break;
      case "child-name":         sortKey = getFirstChildName(this.families);       break;
      case "child-facts":        sortKey = getFirstChildFactDate(this.families);   break;
      case "child-facts-place":  sortKey = getFirstChildFactPlace(this.families);  break;
      case "notes":              sortKey = this.note;                              break;
    }
    this.sortKey = sortKey;
  }

  handleParentChildRelationships(gedcomx, personId, fatherMap, motherMap, familyMap, includePersonId) {
    // Map of childId to array of {parentId, parentChildRelationship}
    let childParentsMap = this.buildChildParentsMap(gedcomx);

    for (let [childId, parentIds] of childParentsMap) {
      if (childId === personId) {
        for (let parentIdAndRel of parentIds) {
          let parentId = parentIdAndRel.parentId;
          let parent = findPersonInGx(gedcomx, parentId);
          let gender = getGender(parent);
          let parentMap = gender === "Female" ? motherMap : fatherMap;
          if (!parentMap[parentId]) {
            addParentToMap(parentMap, gedcomx, parentId, gender === "Female" ? this.mothers : this.fathers, includePersonId);
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
              let familyDisplay = familyMap[parentId];
              if (familyDisplay) {
                // This child is a child of a spouse of the main person, so add it to that couple's family
                familyDisplay.children.push(new PersonDisplay(findPersonInGx(gedcomx, childId), "child", null, includePersonId)); // future: add lineage facts somehow.
                foundOtherParent = true;
              }
            }
          }
          if (!foundOtherParent) {
            let familyDisplay = familyMap["<none>"];
            if (!familyDisplay) {
              familyDisplay = new FamilyDisplay(null);
              familyMap["<none>"] = familyDisplay;
              this.families.push(familyDisplay);
            }
            familyDisplay.children.push(new PersonDisplay(findPersonInGx(gedcomx, childId), "child", null, includePersonId)); // future: add lineage facts somehow.
          }
        }
      }
    }
  }

  handleCoupleAndTernaryRelationships(gedcomx, personId, fatherMap, motherMap, familyMap, includePersonId) {
    for (let relationship of getList(gedcomx, "relationships").concat(getList(gedcomx, CHILD_REL))) {
      let isChildRel = isChildRelationship(relationship);
      let spouseId = getSpouseId(relationship, personId);
      if (spouseId === "<notParentInRel>") {
        if (personId === getRelativeId(relationship, "child")) {
          addParentToMap(fatherMap, gedcomx, getRelativeId(relationship, "parent1"), this.fathers, includePersonId);
          addParentToMap(motherMap, gedcomx, getRelativeId(relationship, "parent2"), this.mothers, includePersonId);
        }
      } else {
        if (!spouseId && isChildRel) {
          spouseId = "<none>";
        }
        let familyDisplay = familyMap[spouseId];
        if (!familyDisplay) {
          let spouseDisplay = spouseId === "<none>" ? null : new PersonDisplay(findPersonInGx(gedcomx, spouseId), "spouse", relationship, includePersonId);
          familyDisplay = new FamilyDisplay(spouseDisplay);
          familyMap[spouseId] = familyDisplay;
          this.families.push(familyDisplay);
        }
        if (isChildRel) {
          let childId = getRelativeId(relationship, "child");
          familyDisplay.children.push(new PersonDisplay(findPersonInGx(gedcomx, childId), "child", null, includePersonId)); // future: add lineage facts somehow.
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
      if (relationship.type === PARENT_CHILD_REL) {
        let parentId = getRelativeId(relationship, "person1");
        let childId = getRelativeId(relationship, "person2");
        let parentIdAndRel = {
          parentId: parentId,
          parentChildRelationship: relationship
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
      if (family.children.length > 0 && displayOptions.shouldDisplayChildren) {
        numChildrenRows += family.children.length;
      }
      else {
        numChildrenRows += 1;
      }
    }
    return numChildrenRows === 0 ? 1 : numChildrenRows;
  }

  getRowPersonCells(gedcomx, personId, rowClass, usedColumns, bottomClass, allRowsClass) {
    function addColumn(key, rowspan, content, extraClass) {
      if (usedColumns.has(key)) {
        html += "<td class='" + rowClass + extraClass + "'" + rowspan + ">" + (content ? content : "") + "</td>";
      }
    }

    function combineParents(parents) {
      let parentsList = [];
      if (parents) {
        for (let parent of parents) {
          parentsList.push(parent.name);
        }
      }
      return parentsList.join("<br>");
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
    addColumn("father-name", rowspan, combineParents(this.fathers), bottomClass);
    addColumn("mother-name", rowspan, combineParents(this.mothers), bottomClass);
    let isFirstSpouse = true;
    let noteId = this.id + "-note";
    let noteCellHtmlHolder = ["<td class='note " + rowClass + bottomClass + "' onclick='doNotSelect(event)' contenteditable='true'" + rowspan
      + " id='" + noteId + "' onkeyup='updateNote(\"" + this.id + "\", \"" + noteId + "\")'>" + encode(this.note) + "</td>"];

    if (this.families.length > 0) {
      for (let spouseIndex = 0; spouseIndex < this.families.length; spouseIndex++) {
        let spouseFamily = this.families[spouseIndex];
        isFirstSpouse = startNewRowIfNotFirst(isFirstSpouse, allRowsClass, noteCellHtmlHolder);
        let familyBottomClass = spouseIndex === this.families.length - 1 ? bottomClass : "";
        let childrenRowSpan = getRowspanParameter(displayOptions.shouldDisplayChildren ? spouseFamily.children.length : 1);
        addColumn("spouse-name", childrenRowSpan, spouseFamily.spouse ? spouseFamily.spouse.name : "", familyBottomClass);
        addColumn("spouse-facts", childrenRowSpan, spouseFamily.spouse ? spouseFamily.spouse.facts : "", familyBottomClass);
        if (spouseFamily.children.length > 0 && displayOptions.shouldDisplayChildren) {
          let isFirstChild = true;
          for (let childIndex = 0; childIndex < spouseFamily.children.length; childIndex++) {
            let child = spouseFamily.children[childIndex];
            isFirstChild = startNewRowIfNotFirst(isFirstChild, allRowsClass, noteCellHtmlHolder);
            let childBottomClass = childIndex === spouseFamily.children.length - 1 ? familyBottomClass : "";
            addColumn("child-name", "", child.name, childBottomClass);
            addColumn("child-facts", "", child.facts, childBottomClass);
          }
        } else {
          addColumn("child-name", "", "", familyBottomClass);
          addColumn("child-facts", "", "", familyBottomClass);
        }
      }
    }
    else {
      addColumn("spouse-name", "", "", bottomClass);
      addColumn("spouse-facts", "", "", bottomClass);
      addColumn("child-name", "", "", bottomClass);
      addColumn("child-facts", "", "", bottomClass);
    }
    if (noteCellHtmlHolder.length > 0) {
      html += noteCellHtmlHolder.pop();
    }
    return html;
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
      this.isSelected = true;
    }
  }

  deselect() {
    if (this.isSelected) {
      $("." + this.id).removeClass(ROW_SELECTION);
      this.isSelected = false;
    }
  }

  getRowLabelHtml(shouldIncludeVersion) {
    if (this.collectionName) {
      if (this.personaArk) {
        return "<a href='" + this.personaArk + "' target='_blank'>" + encode(this.collectionName) + "</a>";
      }
      return encode(this.collectionName);
    }
    else {
      return encode(this.personId + (shouldIncludeVersion && this.mergeNode && this.mergeNode.version > 1 ? " (v" + this.mergeNode.version + ")" : ""));
    }
  }

  // get HTML for this person row
  getHtml(usedColumns, shouldIndent) {
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

    let rowSpan = getRowspanParameter(this.getNumChildrenRows() + (this.endRow ? this.endRow.getNumChildrenRows() : 0));
    let html = "<tr class='" + this.id + "' onclick='handleRowClick(event, \"" + this.id + "\")'>";
    if (shouldIndent) {
      html += getIndentationHtml(this.indent.split(""));
    }
    let colspan = shouldIndent ? " colspan='" + (1 + this.maxIndent - this.indent.length) : "";

    let rowLabel = this.getRowLabelHtml(shouldIndent);
    let bottomClass = " main-row";
    html += "<td class='merge-id" + (shouldIndent && this.isDupNode ? "-dup" : "") + bottomClass + "'" + rowSpan + colspan + "'>"
      + rowLabel + " " + (this.mergeNode ? formatTimestamp(this.mergeNode.firstEntry.updated) : "") + "</td>";

    // Person info
    if (this.endRow) {
      html += this.endRow.getRowPersonCells(this.endRow.gedcomx, this.personId, 'end-gx', usedColumns, "", this.id);
      html += "</tr>\n<tr>";
    }
    let rowClass = this.mergeNode && !this.mergeNode.isLeafNode() ? 'merge-node' : 'identity-gx';
    html += this.getRowPersonCells(this.gedcomx, this.personId, rowClass, usedColumns, bottomClass, this.id);
    html += "</tr>\n";
    return html;
  }
}

function doNotSelect(event) {
  event.stopPropagation();
}

function addParentToMap(parentIdDisplayMap, gedcomx, parentId, parentList, includePersonId) {
  if (parentId && !parentIdDisplayMap[parentId]) {
    let parentDisplay = new PersonDisplay(findPersonInGx(gedcomx, parentId), "parent", null, includePersonId);
    parentIdDisplayMap[parentId] = parentDisplay;
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
  let personNodeMap = {};
  let latestMergeNode = null;

  for (let i = allEntries.length - 1; i >= 0; i--) {
    let entry = allEntries[i];
    if (extractType(getProperty(entry.changeInfo[0], "objectType")) === "NotAMatch") {
      // Skip "NotAMatch" entries because they get added onto both people, even if one is already merged/tombstoned.
      continue;
    }
    let personId = entry.personId;
    let mergeNode = personNodeMap[personId];
    if (!mergeNode) {
      mergeNode = new MergeNode(personId);
      personNodeMap[personId] = mergeNode;
    }
    // When a merge happens, the 'duplicate' gets relationships removed and then a person delete in its change log.
    // But we want to display the person as they were just before the merge, so we will ignore those changes.
    if (isMergeEntry(entry)) {
      let duplicateMergeNode = personNodeMap[entry.mergeDuplicateId];
      delete personNodeMap[entry.mergeDuplicateId];
      mergeNode = mergeNode.merge(duplicateMergeNode);
      personNodeMap[personId] = mergeNode;
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
 * @returns Array of MergeRow entries (i.e., the array mergeRows)
 */
function buildMergeRows(mergeNode, indent, maxIndent, isDupNode, mergeRows, shouldIncludeMergeNodes) {
  this.indent = indent;
  if (shouldIncludeMergeNodes || mergeNode.isLeafNode()) {
    let mergeRow = new PersonRow(mergeNode, mergeNode.personId, mergeNode.gedcomx, displayOptions.shouldIncludeBeforeAfter ? mergeNode.endGx : null, indent, maxIndent, isDupNode, null, null);
    mergeRows.push(mergeRow);
  }
  if (!mergeNode.isLeafNode()) {
    let indentPrefix = indent.length > 0 ? (indent.substring(0, indent.length - 1) + (isDupNode ? "I" : "O")) : "";
    buildMergeRows(mergeNode.dupNode, indentPrefix + "T", maxIndent, true, mergeRows, shouldIncludeMergeNodes);
    buildMergeRows(mergeNode.prevNode, indentPrefix + "L", maxIndent, false, mergeRows, shouldIncludeMergeNodes);
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
      if (displayOptions.shouldDisplayChildren) {
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
    if (sourceInfo.ark && sourceInfo.gx) {
      let personaId = findPersonInGx(sourceInfo.gx, shortenPersonArk(sourceInfo.ark)).id;
      if (!personaIds.has(personaId)) {
        personaRows.push(new PersonRow(null, personaId, sourceInfo.gx, null, 0, 0, false, null, sourceInfo.collectionName, sourceInfo.ark));
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
  return getGrouperHtml(sourceGrouper, true);
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

function getGrouperHtml(grouper) {
  let html = getTableHeader(grouper.usedColumns, grouper.maxDepth, false, grouper);
  let numColumns = html.match(/<th>/g).length;
  for (let groupIndex = 0; groupIndex < grouper.mergeGroups.length; groupIndex++) {
    let personGroup = grouper.mergeGroups[groupIndex];
    if (grouper.mergeGroups.length > 1) {
      html += "<tr class='group-header'><td class='group-header' colspan='" + numColumns + "'>"
          + (isEmpty(personGroup.personRows.length) ? "<button class='close-button' onclick='deleteEmptyGroup(\"" + personGroup.groupId + "\")'>X</button>" : "")
          + "<div class='group-name' contenteditable='true' id='" + personGroup.groupId
          + "' onkeyup='updateGroupName(\"" + personGroup.groupId + "\")'>"
          + encode(personGroup.groupName)
          + "</div><button class='add-to-group-button' onclick='addSelectedToGroup(\"" + personGroup.groupId + "\")'>Add to group</button></td></tr>\n";
    }
    for (let personRow of personGroup.personRows) {
      html += personRow.getHtml(grouper.usedColumns, false);
    }
  }
  html += "</table>\n";
  html += "<button id='add-group' onclick='addGroup(\"" + grouper.id + "\")'>New group</button>\n";
  return html;
}

function sortColumn(columnName, grouperId) {
  let grouper = grouperMap[grouperId];
  grouper.sort(columnName);
  updateFlatViewHtml(grouper);
}

function getTableHeader(usedColumns, maxDepth, shouldIndent, grouper) {
  function sortHeader(columnName, label, spanClass) {
    return "<span "
        + (spanClass ? "class='" + spanClass + "'" : "")
        + (grouper ? "onclick='sortColumn(\"" + columnName + "\", \"" + grouper.id + "\")'" : "")
        + ">" + encode(label) + "</span>";
  }
  function datePlaceLabelHtml(columnName, label) {
    return sortHeader(columnName, label, "sort-date")
    + (grouper ? "<span class='sort-place' onclick='sortColumn(\"" + columnName + "-place" + "\", \"" + grouper.id + "\")'>" + encode(" place ") + "</span>" : "");
  }
  function cell(columnName, label, alwaysInclude) {
    if (alwaysInclude || usedColumns.has(columnName)) {
      return "<th>"
          + (columnName.endsWith("-facts") ? datePlaceLabelHtml(columnName, label) : sortHeader(columnName, label))
          + "</th>";
    }
    return "";
  }

  let colspan = shouldIndent ? " colspan='" + maxDepth + "'" : "";
  return "<table id='change-log-hierarchy'><th" + colspan + ">"
      + (grouper && grouper.tabId === SOURCES_VIEW ? sortHeader("collection", "Collection") : sortHeader("person-id", "Person ID"))
      + cell("person-name", "Name", true)
      + cell("person-facts", "Facts")
      + cell("father-name", "Father")
      + cell("mother-name", "Mother")
      + cell("spouse-name", "Spouse")
      + cell("spouse-facts", "Spouse facts")
      + cell("child-name", "Children")
      + cell("child-facts", "Child facts")
      + cell("notes", "Notes", true);
}

function getMergeHierarchyHtml(entries) {
  let rootMergeNode = getRootMergeNode(entries);
  let maxDepth = findMaxDepth(rootMergeNode);
  let mergeRows = buildMergeRows(rootMergeNode, "", maxDepth - 1, false, [], true);
  let usedColumns = findUsedColumns(mergeRows);

  mergeGrouper = new Grouper(mergeRows, usedColumns, maxDepth, MERGE_VIEW);
  return getMergeGrouperHtml();
}

function getMergeGrouperHtml() {
  let html = getTableHeader(mergeGrouper.usedColumns, mergeGrouper.maxDepth, true, null);
  for (let mergeRow of mergeGrouper.getAllRows()) {
    html += mergeRow.getHtml(mergeGrouper.usedColumns, true);
  }
  html += "</table>\n";
  return html;
}

function updateMergeHierarchyHtml() {
  $("#" + mergeGrouper.tabId).html(getMergeGrouperHtml());
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
  function filterFacts(facts) {
    if (!facts || displayOptions.factsToInclude === INCLUDE_NO_FACTS) {
      return [];
    }
    if (displayOptions.factsToInclude === INCLUDE_ALL_FACTS) {
      return facts;
    }
    let filtered = [];
    for (let fact of facts) {
      let factType = extractType(fact.type);
      if (factType === "Birth" || factType === "Death" || factType === "Christening" || factType === "Burial" || factType === "Marriage") {
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
  return "<notParentInRel>";
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
// ============ GedcomX manipuation (no HTML) =========================

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
function addFact(person, fact, isOrig) {
  fact.status = getAddStatus(isOrig);
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
 */
function updateCoupleRelationship(gedcomx, entry, resultingId) {
  let resultingRel = findCoupleRelationship(entry, resultingId);
  if (!resultingRel) {
    return;
  }
  let relationshipId = getPrimaryIdentifier(resultingRel);
  let existingRel = findEntityByPrimaryIdentifier(getList(gedcomx, "relationships"), relationshipId);
  if (existingRel) {
    existingRel["person1"] = resultingRel["person1"];
    existingRel["person2"] = resultingRel["person2"];
    existingRel.updated = entry.updated;
  }
  else {
    let relCopy = copyObject(resultingRel);
    relCopy.updated = entry.updated;
    delete relCopy["id"]; // Remove temp id of "<longId>.resulting"
    addToList(gedcomx, "relationships", relCopy);
  }
}

/**
 * Add or update a child-and-parents-relationship on the given gedcomx, as found in the entryGedcomx.
 * - The original and resulting relationships should both have the same Primary identifier.
 * - The original relationship may be empty, and may not exist in 'gedcomx' yet.
 * - If not, just add a copy of it. If it does exist, update the three identifiers but leave any facts intact.
 * @param gedcomx - GedcomX to modify
 * @param entry - Change log entry
 * @param resultingId - 'id' of the child-and-parents-relationship with the updated relatives
 */
function updateChildAndParentsRelationship(gedcomx, entry, resultingId) {
  let resultingRel = findChildAndParentsRelationship(entry, resultingId);
  if (!resultingRel) {
    return;
  }
  let relationshipId = getPrimaryIdentifier(resultingRel);
  let existingRel = findEntityByPrimaryIdentifier(getList(gedcomx, CHILD_REL), relationshipId);
  if (existingRel) {
    existingRel["parent1"] = resultingRel["parent1"];
    existingRel["parent2"] = resultingRel["parent2"];
    existingRel["child"] = resultingRel["child"];
    existingRel.updated = entry.updated;
  }
  else {
    let relCopy = copyObject(resultingRel);
    relCopy.updated = entry.updated;
    delete relCopy["id"]; // Remove temp id of "<longId>.resulting"
    addToList(gedcomx, CHILD_REL, relCopy);
  }
}

function addToList(listHolder, listName, element, isOrig) {
  if (listHolder.hasOwnProperty(listName)) {
    listHolder[listName].push(element);
  }
  else {
    listHolder[listName] = [element];
  }
  element.status = getAddStatus(isOrig);
}


/**
 * Replace the element in listContainer[listName] that has the same id as elementListContainer[listName][0]
 *   with that element. For example, replace person["names"][2] with elementListContainer["names"][0]
 *   if they both have the same "id" element.
 * @param listContainer - Object (like a person) that has a list named listName, containing elements with an 'id'.
 * @param listName - Name of list to look in
 * @param elementListContainer - Object (like a change log person) that has a list of the given name with a single entry.
 * @param isOrig - Flag for whether the change is happening during the initial creation of the person (part of its "original intended identity")
 */
function updateInList(listContainer, listName, elementListContainer, isOrig) {
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
  for (let i = 0; i < existingList.length; i++) {
    if (hasSameId(existingList[i], elementWithId)) {
      if (setDeletedStatus(existingList[i], isOrig)) {
        existingList[i] = elementWithId;
      }
      else {
        existingList.push(elementWithId);
      }
      elementWithId.status = getAddStatus(isOrig);
      return;
    }
  }
  console.log("Failed to find element in " + listName + "[] with id " + elementWithId["id"]);
}

/**
 * Remove an element with a primary identifier matching that in elementListContainer[listName][0].identifiers["Primary"][0]
 * @param listContainer - Object (like a person) with a list
 * @param listName - Name of list (like "names" or "sources")
 * @param elementListContainer - Object from change log GedcomX with one element in the given list with an id.
 */
function removeFromListByPrimaryIdentifier(listContainer, listName, elementListContainer) {
  let existingList = listContainer[listName];
  if (existingList) {
    let identifierToRemove = getPrimaryIdentifier(elementListContainer[listName][0]);
    for (let i = 0; i < existingList.length; i++) {
      let existingIdentifier = getPrimaryIdentifier(existingList[i]);
      if (existingIdentifier === identifierToRemove) {
        existingList.splice(i, 1);
        return;
      }
    }
    console.log("Failed to find element in " + listName + "[] with id " + identifierToRemove);
  }
  else {
    console.log("Failed to find list '" + listName + "'");
  }
}

function removeFromListById(listContainer, listName, elementListContainer) {
  let existingList = listContainer[listName];
  if (existingList) {
    let idToRemove = elementListContainer[listName][0]["id"];
    for (let i = 0; i < existingList.length; i++) {
      let existingId = existingList[i]["id"];
      if (existingId && existingId === idToRemove) {
        existingList.splice(i, 1);
        return;
      }
    }
  }
  console.log("Failed to find element in " + listName + "[] with id " + relationshipId);
}

function doInList(listContainer, listName, elementListContainer, operation, isOrig) {
  if (operation === "Create") {
    addToList(listContainer, listName, elementListContainer[listName][0], isOrig);
  }
  else if (operation === "Update") {
    updateInList(listContainer, listName, elementListContainer, isOrig, isOrig);
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

function copySurvivorGx(gx) {
  function mapStatus(obj) {
    if (obj && obj.status) {
      if (obj.status === "orig" || obj.status === "added" || obj.status === "deleted" || obj.status === "changed") {
        obj.status = "merge-" + obj.status;
      }
    }
  }

  gx = copyObject(gx);
  for (let person of getList(gx, "persons")) {
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
  for (let relationship of getList(gx, "relationships").concat(getList(gx, CHILD_REL))) {
    mapStatus(relationship);
  }
  //future: Handle memories, too.
  return gx;
}

// Add a fact to a relationship or update one.
function addFactToRelationship(gedcomx, entry, relationshipListName, resultingId, factKey, shouldUpdate) {
  let resultingRel = findEntity(entry, relationshipListName, resultingId);
  if (!resultingRel) {
    return;
  }
  let existingRel = findEntityByPrimaryIdentifier(getList(gedcomx, relationshipListName), getPrimaryIdentifier(resultingRel));

  if (existingRel) {
    if (shouldUpdate) {
      updateInList(existingRel, factKey, resultingRel);
    }
    else {
      addToList(existingRel, factKey, getList(resultingRel, factKey)[0]);
    }
  }
  else {
    let relCopy = copyObject(resultingRel);
    delete relCopy["id"]; // get rid of temporary '.resulting' id
    addToList(gedcomx, relationshipListName, relCopy);
  }
}

function updateFactInRelationship(gedcomx, entry, relationshipListName, resultingId, factKey) {
  addFactToRelationship(gedcomx, entry, relationshipListName, resultingId, factKey, true);
}

function deleteFactFromRelationship(gedcomx, entry, relationshipListName, resultingId, factKey) {
  let resultingRel = findEntity(entry, relationshipListName, resultingId);
  if (!resultingRel) {
    return;
  }
  let existingRel = findEntityByPrimaryIdentifier(getList(gedcomx, relationshipListName), getPrimaryIdentifier(resultingRel));

  if (existingRel) {
    removeFromListById(existingRel, factKey, resultingRel);
  }
}

/**
 * Add or update the persons in the gedcomx referenced by the given relationship (except the main personId).
 * @param gedcomx - GedcomX to update
 * @param entry - Change log entry for a relationship change. Includes a snapshot of the persons involved in the relationship.
 * @param relationship - Relationship object found
 */
function updateRelatives(gedcomx, entry, relationship) {
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
   - "changed": Since gender can only have one value, it is marked as "updated" if it has changed after the initial identity
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
      displayed when not rolled up, since it appears below and we need to know it went away. But it can be hidden
      when rolled up, since it was not part of the original identity.
   - Fortunately, this isn't confusing at all.
 */

// See above for details on status.
// Update the given status from orig or merge-orig to deleted; or merge-added to merge-deleted.
// If 'isOrig' is true, then the delete is being done during the original identity phrase, so the object can be actually deleted.
// Return true if the given entity should be actually deleted (i.e., if the status is "added" or isOrig is true), or false if it should be kept.
function setDeletedStatus(entity, isOrig) {
  let status = entity.status;
  if (status === "added" || isOrig) {
    return true;
  }
  else {
    if (status === "orig" || status === "merge-orig") {
      status = "deleted";
    }
    else if (status === "merge-added") {
      status = "merge-deleted";
    }
    else if (status === "deleted" || status === "merge-deleted") {
      console.log("Deleting deleted gender");
    }
    else {
      console.log("Unrecognized status when deleting gender: " + status);
    }
    entity.status = status;
    return false;
  }
}

function getAddStatus(isOrig) {
  return isOrig ? "orig" : "added";
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
        gxPerson.gender.status = getAddStatus(isOrig);
        break;
      case "Update-Gender":
        entryPerson.gender.status = oppositeGender(gxPerson.gender, entryPerson.gender) ? "changed" : getAddStatus(isOrig);
        gxPerson.gender = entryPerson.gender;
        break;
      case "Delete-Gender":
        if (setDeletedStatus(gxPerson["gender"], isOrig)) {
          delete gxPerson["gender"];
        }
        break;
      case "Create-BirthName":
      case "Update-BirthName":
      case "Delete-BirthName":
        doInList(gxPerson, "names", entryPerson, operation, isOrig);
        break;
      case "Create-SourceReference":
      case "Update-SourceReference":
      case "Delete-SourceReference":
        doInList(gxPerson, "sources", entryPerson, operation, isOrig);
        break;
      case "Create-(Fact)":
        console.assert(entryPerson.hasOwnProperty("facts") && entryPerson.facts.length === 1, "Expected one fact in entry");
        console.assert(extractType(entryPerson["facts"][0].type) === objectType, "Mismatched fact type in fact creation");
        addFact(gxPerson, entryPerson.facts[0], isOrig);
        break;
      case "Delete-(Fact)":
        doInList(gxPerson, "facts", entryPerson, operation, isOrig);
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
    updateRelatives(gedcomx, entry, resultingRelationship);
    if (resultingRelationship.hasOwnProperty("facts") && resultingRelationship.facts.length === 1) {
      combo = operation + "-" + "(Fact)";
    }
    switch (combo) {
      case "Restore-Couple":
      case "Create-Spouse1":
      case "Create-Spouse2":
      case "Update-Spouse1":
      case "Update-Spouse2":
        updateCoupleRelationship(gedcomx, entry, resultingId);
        break;
      case "Create-(Fact)":
        addFactToRelationship(gedcomx, entry, "relationships", resultingId, "facts");
        break;
      case "Update-(Fact)":
        updateFactInRelationship(gedcomx, entry, "relationships", resultingId, "facts");
        break;
      case "Delete-(Fact)":
        deleteFactFromRelationship(gedcomx, entry, "relationships", resultingId, "facts");
        break;
      case "Delete-Couple":
        removeFromListByPrimaryIdentifier(gedcomx, "relationships", entry.content.gedcomx);
        break;
      case "Create-SourceReference":
      case "Update-SourceReference":
      case "Delete-SourceReference":
        let existingRelationship = findEntityByPrimaryIdentifier(gedcomx.relationships, getPrimaryIdentifier(resultingRelationship));
        doInList(existingRelationship, "sources", resultingRelationship, operation);
        break;
      default:
        console.log("Unimplemented change log entry type: " + combo + " for Couple relationship");
    }
  }
  else if (objectModifier === "ChildAndParentsRelationship") {
    let resultingRelationship = findChildAndParentsRelationship(entry, resultingId);
    updateRelatives(gedcomx, entry, resultingRelationship);
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
        updateChildAndParentsRelationship(gedcomx, entry, resultingId);
        break;
      case "Create-(Fact)":
        addFactToRelationship(gedcomx, entry, CHILD_REL, resultingId, factKey);
        break;
      case "Update-(Fact)":
        updateFactInRelationship(gedcomx, entry, CHILD_REL, resultingId, factKey);
        break;
      case "Delete-(Fact)":
        deleteFactFromRelationship(gedcomx, entry, CHILD_REL, resultingId, factKey);
        break;
      case "Delete-ChildAndParentsRelationship":
        removeFromListByPrimaryIdentifier(gedcomx, CHILD_REL, entry.content.gedcomx);
        break;
      case "Create-SourceReference":
      case "Update-SourceReference":
      case "Delete-SourceReference":
        let existingRelationship = findEntityByPrimaryIdentifier(gedcomx[CHILD_REL], getPrimaryIdentifier(resultingRelationship));
        doInList(existingRelationship, "sources", resultingRelationship, operation);
        break;
      default:
        console.log("Unimplemented change log entry type: " + combo + " for ChildAndParentsRelationship");
    }
  }
}
