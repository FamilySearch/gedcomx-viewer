// Fetch the change log entries for the person given by the change log URL.
function buildChangeLogView(changeLogUrl, sessionId, $mainTable, $status) {
  let context = parsePersonUrl(changeLogUrl);
  if (sessionId) {
    context["sessionId"] = sessionId;
  }

  // Map of personId -> array of change log entries, most recent first.
  let changeLogMap = {};
  let fetching = [];

  updateStatus($status, "Fetching change logs...");
  // Recursively fetch this person's change log and that of anyone merged in.
  // Once last change log has been fetched, the last ajax call will call makeChangeLogHtml()
  fetchChangeLog(context.personId, context, changeLogMap, fetching, $mainTable, $status)
}

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
      receiveChangeLog(gedcomx, $status, personId, fetching, changeLogMap, context, $mainTable, nextUrl);
    }
  });
}

function receiveChangeLog(gedcomx, $status, personId, fetching, changeLogMap, context, $mainTable, receivedNextUrl) {
  if (receivedNextUrl) {
    $status.html($status.html().replace("Fetching next change log for " + personId, "Received next change log for " + personId));
  } else {
    let logHtml = $status.html();
    logHtml = logHtml.replace("Fetching change log for " + personId, "Received change log for " + personId);
    $status.html(logHtml);
    // $status.html($status.html().replace("Fetching change log for " + personId, "Received change log for " + personId));
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
    // So kick off creating the table.
    updateStatus($status, "Creating table");
    makeChangeLogHtml(context, changeLogMap, $mainTable);
    clearStatus($status);
  }
}

// context - Map containing baseUrl, personId (of the main person), and optional "sessionId"
function formatTimestamp(ts) {
  function pad(n) {
    return String(n).padStart(2, '0');
  }
  let date = new Date(ts);
  return "<span class='date'>" + String(date.getFullYear()) + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
    "</span><span class='time'>_" + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) +
    "." + String(ts).slice(String(ts).length - 3) + "</span>";
}

// changeLogMap - Map of personId -> GedcomX of the change log for that personId.
function makeChangeLogHtml(context, changeLogMap, $mainTable) {
  let personMinMaxTs = {};
  let personIds = [];
  let allEntries = combineEntries(context.personId, changeLogMap, personIds, personMinMaxTs);
  let maxColumns = 0;
  let html = "<table><tr><th>Timestamp</th>";
  for (let personId of personIds) {
    html += "<th class='person-id'>" + personId + "</th>";
  }
  html += "</tr>\n";
  let prevTimestamp = null;
  let evenTimestampGroup = true;
  for (let entry of allEntries) {
    if (entry.updated !== prevTimestamp) {
      evenTimestampGroup = !evenTimestampGroup;
    }
    let rowClass = evenTimestampGroup ? " even-ts" : " odd-ts";

    html += "<tr></tr><td class='timestamp" + rowClass + "'>" + (entry.updated !== prevTimestamp ? formatTimestamp(entry.updated) : "") + "</td>";
    if (entry.column > maxColumns) {
      maxColumns = entry.column;
    }
    for (let column = 0; column < personIds.length; column++) {
      let personId = personIds[column];
      if (column === entry.column) {
        html += "<td class='entry" + rowClass + "'>" + getEntryHtml(entry) + "</td>";
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
  }

  html += "</table>";
  $mainTable.html(html);
}

function getEntryHtml(entry) {
  html = "<span class='entry-title'>" + entry.title + "</span>";

  return html;
}

function makeChangeLogEntries(gedcomx) {
  // Use the original GedcomX "entry" array, but add 'personId' to each.
  let entries = gedcomx.entries;
  let personId = extractPersonId(gedcomx.links.person.href);
  for (let entry of entries) {
    entry["personId"] = personId;
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
            let personUrl = person.identifiers["http://gedcomx.org/Primary"][0];
            let removedPersonId = extractPersonId(personUrl);
            mergeIds.push(removedPersonId);
          }
        }
      }
    }
  }
  return mergeIds;
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
      if (a.personId === mainPersonId) {
        return -1;
      }
      if (b.personId === mainPersonId) {
        return 1;
      }
      let columnA = a.personId in personColumnMap ? personColumnMap[a.personId] : null;
      let columnB = b.personId in personColumnMap ? personColumnMap[b.personId] : null;
      if (columnA !== null && columnB !== null) {
        return columnA < columnB ? -1 : 1;
      }
      return a.personId.localeCompare(b.personId);
    }
    // Otherwise, arbitrarily sort by unique change entry id.
    if (a.id && b.id) {
      return a.id.localeCompare(b.id);
    }
    if (a.id) {
      return -1;
    }
    if (b.id) {
      return -1;
    }
    console.log("Can't compare...");
    return 0;
  }

  let firstTimestamps = [];
  let allEntries = [];
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
  return allEntries;
}

function updateStatus($status, message) {
  $status.append(encode(message) + "<br/>\n");
}

function clearStatus($status) {
  $status.html("");
}
