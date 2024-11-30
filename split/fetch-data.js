// Functions for fetching data from APIs, including change logs, sources and ordinances.

/**
 * Recursively fetch a person's change log entries, including following 'next' links, and fetching the
 *   change logs of any persons who merged into this one.
 * @param personId - Person ID to fetch change log for
 * @param context - Object with personId, baseUrl and optionally sessionId
 * @param changeLogMap - Map of personId to list of change log entries for that person id.
 * @param fetching - list of person IDs currently being fetched.
 * @param $mainTable - JQuery element to put the resulting HTML into when ready
 * @param nextUrl - "next" Url for a person's change log, if this is a next link call (none => fetch person's change log from scratch)
 * @param shouldFetchOrdinances - flag for whether to fetch ordinances (currently only works within FamilySearch VPN).
 */
function fetchChangeLog(personId, context, changeLogMap, fetching, $mainTable, nextUrl, shouldFetchOrdinances) {
  if (!nextUrl && (changeLogMap.hasOwnProperty(personId) || fetching.includes(personId))) {
    return; // Already took care of this one
  }
  fetching.push(personId);
  updateStatus("Fetching " + (nextUrl ? "next " : "") + "change log for " + personId);
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
      receiveChangeLog(gedcomx, personId, context, changeLogMap, fetching, $mainTable, nextUrl);
    }
  });

  if (shouldFetchOrdinances) {
    fetchOrdinances(personId, fetching, context, changeLogMap, $mainTable);
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
 * @param receivedNextUrl - flag for whether this is a 'next' URL.
 */
function receiveChangeLog(gedcomx, personId, context, changeLogMap, fetching, $mainTable, receivedNextUrl) {
  modifyStatusMessage(fetching, personId, "Fetching" + (receivedNextUrl ? " next" : "") + " change log for " + personId, "Received" + (receivedNextUrl ? " next" : "") + " change log for " + personId);
  if (gedcomx) {
    let changeLogEntries = makeChangeLogEntries(gedcomx);
    if (personId in changeLogMap) {
      changeLogEntries = changeLogMap[personId].concat(changeLogEntries);
    }
    changeLogMap[personId] = changeLogEntries;
    let nextUrl = "next" in gedcomx.links ? gedcomx.links.next.href : null;
    if (nextUrl) {
      fetchChangeLog(personId, context, changeLogMap, fetching, $mainTable, nextUrl);
    }
    let mergedIds = getNewMergeIds(personId, changeLogEntries);
    for (let newMergeId of mergedIds) {
      fetchChangeLog(newMergeId, context, changeLogMap, fetching, $mainTable);
    }
  }
  else {
    console.log("Warning: Failed to fetch gedcomx for " + personId);
  }
  handleIfFinishedFetching(fetching, context, changeLogMap, $mainTable);
}

function handleIfFinishedFetching(fetching, context, changeLogMap, $mainTable) {
  if (fetching.length === 0) {
    // All the change logs that needed to be fetched have now been fetched, and this is the last one.
    // So create the Html.
    makeMainHtml(context, changeLogMap, $mainTable);
    hasRestoreInChangeLog = allEntries.some(entry => entry.title && entry.title.includes("Restore"));
    if (hasRestoreInChangeLog) {
      alert("This person has a 'Restore' in the change log. You can evaluate the person, but the tool can't handle splitting them yet.");
    }
    // Then, kick off the fetching of relatives and sources info, and update the table when done.
    fetchRelativesAndSources(changeLogMap, context);
  }
}


function fetchOrdinances(personId, fetching, context, changeLogMap, $mainTable) {
  updateStatus("Fetching ordinances from TF for " + personId);
  fetching.push(personId + "-tf");
  let url = "https://" + (context.baseUrl.includes("beta.familysearch") ? "beta" : "www")
    + ".familysearch.org/service/tree/tree-data/labs/person/" + personId + "/ordinances";
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
    success: function(tf) {
      console.log("Success in fetching tf person " + personId);
      receiveOrdinances(tf, personId, context, changeLogMap, fetching, $mainTable);
    },
    error: function() {
      console.log("Failed to fetch tf person " + personId);
      receiveOrdinances(null, personId, context, changeLogMap, fetching, $mainTable);
    }
  });
  fetchOrdinanceEntityRefs(personId, fetching, context, changeLogMap, $mainTable);
}

function fetchOrdinanceEntityRefs(personId, fetching, context, changeLogMap, $mainTable, nextToken) {
  updateStatus("Fetching ordinance entity refs for " + personId);
  fetching.push(personId + "-ows-refs");
  let owsRefsUrl = "https://" + (context.baseUrl.includes("beta.familysearch") ? "beta" : "www")
    + ".familysearch.org/service/tree/tf/person/" + personId + "/changes/subset?entityRefType=ORDINANCE";
  if (nextToken) {
    owsRefsUrl += "&from=" + nextToken;
  }
  $.ajax({
    beforeSend: function(request) {
      // request.setRequestHeader("User-Agent", "fs-wilsonr");
      request.setRequestHeader("User-Agent-Chain", "fs-wilsonr");
      request.setRequestHeader("Accept", "application/json");
      if (context.sessionId) {
        request.setRequestHeader("Authorization", "Bearer " + context.sessionId);
      }
    },
    dataType: "json",
    url: owsRefsUrl,
    success: function(tf) {
      console.log("Success in fetching tf person " + personId);
      receiveOrdinanceEntityRefs(tf, personId, context, changeLogMap, fetching, $mainTable);
    },
    error: function() {
      console.log("Failed to fetch tf person " + personId);
      receiveOrdinanceEntityRefs(null, personId, context, changeLogMap, fetching, $mainTable);
    }
  });
}

/*
  Receive a labs Ordinances result, and harvest it for ordinance information.
  personId
  owsList[]
    .personId
    .originallyAttachedTo
    .owsId (ows.MMMM-XXX)
    .role (ORD_PRINCIPAL/ORD_FATHER/ORD_MOTHER)
    .ordinanceTypes[] (BAPTISM_LDS, INITIATORY, ENDOWMENT, SEALING_TO_PARENTS, SEALING_TO_SPOUSE)
    .createTime/.earliestPrintedTime/earliestPerformedDate
      .original (11 May 1888) (or 7 Feb 2007 08:37:51 GMT)
      .normalized (11 May 1888 00:00:00 GMT or 7 Feb 2007 08:37:51 GMT)
      .time (like 1172565471000)
    .self/.spouse/.father/.mother:
      .personId
      .gender: MALE
      .fullName
      .living: false
      .names (GedcomX Name object with name forms)
      .facts (GedcomX facts array)
      .ctrs[] (Certified Temple Records)
        .id (like ctr.7PP4-G7N)
        .type (BAPTISM_LDS, CONFIRMATION_LDS, INITIATORY, ENDOWMENT, SEALING_TO_PARENTS, SEALING_TO_SPOUSE)
        .status (COMPLETED, ...)
        .performedDate: {original: "06 Dec 1991", normalized: "06 Dec 1991 00:00:00 GMT", time: 692361600000}
        .templeCode (like PORTL)
  TF info was:
  tf.ordinanceReferences[]
      .originallyAttachedTo
      .value
        .role (ORD_PRINCIPAL/ORD_FATHER/ORD_MOTHER)
        .type (ORDINANCE)
        .uri (owsId, like "ows.MC7B-XRV")
   Then fetch the OWS for each ordinance reference.
 */
function receiveOrdinances(ordinancesJson, personId, context, changeLogMap, fetching, $mainTable) {
  if (ordinancesJson) {
    modifyStatusMessage(fetching, personId + "-tf", "Fetching ordinances from TF for " + personId, "Received ordinances from TF for " + personId);

    for (let owsEntry of getList(ordinancesJson, "owsList")) {
      let ows = new OrdinanceWorkSet(owsEntry, personId);
      if (owsMap.has(ows.owsId)) {
        console.log("Duplicate OWS id: " + ows.owsId);
      }
      owsMap.set(ows.owsId, ows);
      computeIfAbsent(personOrdinanceMap, personId, () => []).push(ows);
    }
  }
  else {
    modifyStatusMessage(fetching, personId + "-tf", "Fetching ordinances from TF for " + personId, "Failed to receive ordinances from TF for " + personId);
  }
  handleIfFinishedFetching(fetching, context, changeLogMap, $mainTable);
}

function receiveOrdinanceEntityRefs(changesJson, personId, context, changeLogMap, fetching, $mainTable) {
  if (changesJson) {
    modifyStatusMessage(fetching, personId + "-ows-refs", "Fetching ordinance entity refs for " + personId, "Received ordinance entity refs for " + personId);
    for (let change of getList(changesJson, "changes")) {
      let value = change.journalEvent.entityRef.value;
      if (value && value.type === "ORDINANCE" && value.role === "ORD_PRINCIPAL") {
        let owsId = value.uri;
        let owsRef = owsRefMap.get(owsId);
        if (owsRef) {
          console.log("Warning: Duplicate OWS ref id: " + owsId);
        }
        else {
          let owsRef = { changeId: change.changeId, modified: change.modified };
          owsRefMap.set(owsId, owsRef);
        }
      }
    }
    if (!changesJson.lastPage) {
      if (changesJson.nextToken) {
        fetchOrdinanceEntityRefs(personId, fetching, context, changeLogMap, $mainTable, changesJson.nextToken);
      }
      else {
        console.log("Warning: No next token for ordinance entity refs change log for " + personId);
      }
    }
  }
  else {
    modifyStatusMessage(fetching, personId + "-ows-refs", "Fetching ordinance entity refs for " + personId, "Failed to receive ordinance entity refs for " + personId);
  }
  handleIfFinishedFetching(fetching, context, changeLogMap, $mainTable);
}

function fetchRelativesAndSources(changeLogMap, context) {
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
  if (fetching.length > 0) {
    setStatus("Fetching " + fetching.length + " sources...");
    for (let sourceUrl of Object.keys(sourceMap)) {
      $.ajax({
        beforeSend: function (request) {
          request.setRequestHeader("Accept", "application/json");
          if (context.sessionId) {
            request.setRequestHeader("Authorization", "Bearer " + context.sessionId);
          }
        },
        dataType: "json",
        url: sourceUrl,
        success: function (gedcomx) {
          receiveSourceDescription(gedcomx, context, fetching, sourceUrl, sourceMap);
        },
        error: function () {
          receiveSourceDescription(null, context, fetching, sourceUrl, sourceMap)
        }
      });
    }
  }
  else {
    finishedReceivingSources(context);
  }
}

/**
 * Receive a SourceDescription from an AJAX call.
 * @param gedcomx - GedcomX containing the SourceDescription
 * @param context - Context info such as session ID.
 * @param fetching - List of sourceUrls still being fetched.
 * @param sourceUrl - SourceUrl fetched for this call
 * @param sourceMap - (Global) map of sourceUrl -> SourceInfo for that source (which is filled out here).
 */
function receiveSourceDescription(gedcomx, context, fetching, sourceUrl, sourceMap) {
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
          receivePersona(gedcomx, context, fetching, sourceInfo);
        },
        error: function() {
          receivePersona(null, context, fetching, sourceInfo);
        }
      });
    }
    if (fetching.length) {
      setStatus("Fetching " + fetching.length + "/" + sourceMap.size + " sources...");
    }
    else {
      finishedReceivingSources();
    }
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

function receivePersona(gedcomx, context, fetching, sourceInfo) {
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
    sourceInfo.stapledOrdinancePersonId = getStapledOrdinancePersonId(person);
  }
  fetching.splice(fetching.indexOf(sourceInfo.personaArk), 1);
  if (fetching.length) {
    setStatus("Fetching " + fetching.length + "/" + Object.keys(sourceMap).length + " sources...");
  }
  else {
    finishedReceivingSources(context);
  }
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


function getMainPersonaArk(gedcomx) {
  let sd = getSourceDescription(gedcomx, null);
  if (sd) {
    if (sd.about) {
      return sd.about;
    }
    return getIdentifier(sd);
  }
}

function finishedReceivingSources(context) {
  clearStatus();
  $("#" + SOURCES_VIEW).html(getSourcesViewHtml());
  split = new Split(mergeGrouper.mergeGroups[0].personRows[0].gedcomx);
  updateSplitViewHtml();
  updateComboViewHtml();
  makeTableHeadersDraggable();
  animateRows()
  fetchRelativeSources(context);
}

// Begin fetching the list of source descriptions for each relative,
//   so that we can know what persona Arks are attached to each relative.
//   This allows us to know which sources attached to the main person have relatives
//   with corresponding attachments in the same source.
// For example, say person A has husband B in Family Tree; and that a marriage record R has a bride X and groom Y;
//   If X is attached to A, then if Y is also attached to B, then we can say that this source "supports" the
//   Couple relationship between A&B, because X&Y are a couple and A=X and B=Y.
function fetchRelativeSources(context) {
  let fetching = [...relativeMap.keys()];

  setStatus("Fetching " + fetching.length + " relatives' sources...");
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
        receiveRelativeSources(gedcomx, context, fetching, relativeId);
      },
      error: function() {
        console.log("Failed to fetch sources for relative at " + sourceUrl);
        receiveRelativeSources(null, context, fetching, relativeId);
      }
    });
  }
}

function receiveRelativeSources(gedcomx, context, fetching, relativeId) {
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
    setStatus("Fetching " + fetching.length + "/" + Object.keys(sourceMap).length + " relatives' sources...");
  }
  else {
    // Finished receiving relative sources
    clearStatus();
    relativeSourcesReceived = true;
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

function modifyStatusMessage(fetching, fetchingEntryToRemove, originalMessage, newMessage) {
  let logHtml = $statusDiv.html();
  logHtml = logHtml.replace(originalMessage, newMessage);
  $statusDiv.html(logHtml);
  fetching.splice(fetching.indexOf(fetchingEntryToRemove), 1); // Remove personId from the fetching array
}