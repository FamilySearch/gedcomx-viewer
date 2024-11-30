// Map of owsId -> OrdinanceWorkSet
let owsMap = new Map();
// Map of owsId -> {changeId: <changeId>, modified: <timestamp>}
let owsRefMap = new Map();
// Map of personId -> OrdinanceWorkSet[] that were originally attached to that personId.
let personOrdinanceMap = new Map();

class Ordinance { // "ctr" = Certified Temple Record
  constructor(ctr) {
    this.ctrId = ctr.id;
    this.ordinanceType = ctr.type; // BAPTISM_LDS, INITIATORY, ENDOWMENT, SEALING_TO_PARENTS, SEALING_TO_SPOUSE
    this.ordinanceStatus = ctr.status; // COMPLETED, ...
    this.performedDate = getNormalizedDateElement(ctr.performedDate);
    this.templeCode = ctr.templeCode; // PORTL, or null if performed live or unknown.
    this.ordinanceSortKey = this.makeOrdSortKey(this.ordinanceType, this.performedDate, this.templeCode);
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
  constructor(ows, principalPersonId) {
    function dateOf(type) {
      let date = ordTypeMap[type];
      return "\t" + (date ? date.substring(date.length - 4) : "");
    }
    this.owsId = ows.owsId;
    this.principalPersonId = principalPersonId; // Family Tree person ID at the time the ordinances were submitted.
    this.currentPersonId = ows.personId; // latest, forwarded person id (according to TF) the ordinance is on.
    this.supposedOriginalPersonId = ows.originallyAttachedTo; // (unforwarded) person id the ordinance was originally attached to
    this.roleInOws = ows.role; // Role of this person in the OWS (e.g., ORD_FATHER if father of person getting baptized)
    this.createDate = getNormalizedDateElement(ows.createTime); // createDate from ows. Probably the same as above. Like "26 Feb 2007 21:33:43 GMT".
    this.modifiedDate = this.createDate; //todo: Change any uses of this to 'createDate' and then remove it.
    this.ordinances = []; // Array of Ordinance object, i.e., a CTR (Certified Temple Record)

    let ordTypeMap = {};

    for (let ctr of getList(ows, "ctrs")) {
      let ordinance = new Ordinance(ctr);
      this.ordinances.push(ordinance);
      ordTypeMap[ordinance.ordinanceType] = ordinance.performedDate ? ordinance.performedDate : "done";
    }
    sortOrdinances(this.ordinances);

    // Output a tab-separated string with owsId, ows.personId, ows.role, ows.originallyAttachedTo, ows.self.personId
    console.log(ows.owsId + "\t" + ows.personId + "\t" + ows.role + "\t" + ows.originallyAttachedTo + "\t" + ows.self.personId
      + dateOf("BAPTISM_LDS") + dateOf("CONFIRMATION_LDS") + dateOf("INITIATORY")
      + dateOf("ENDOWMENT") + dateOf("SEALING_TO_PARENTS") + dateOf("SEALING_TO_SPOUSE"));


    this.gedcomx = this.makeGedcomxFromOwsPersons(ows);
    let principalPerson = this.getPrincipal(this.gedcomx);
    if (principalPerson) {
      this.originalPersonId = principalPerson.id;
    }
    else {
      this.originalPersonId = this.supposedOriginalPersonId;
      console.log("Warning: No principal person ('self') in " + this.owsId);
    }
  }

  getPrincipal(gedcomx) {
    for (let person of getList(gedcomx, "persons")) {
      if (person.principal) {
        return person;
      }
    }
  }

  makeGedcomxFromOwsPersons(ows) {
    let gedcomx = {};
    gedcomx.persons = [];
    gedcomx.relationships = [];
    let person = this.makePersonFromOwsPerson(ows, "self", gedcomx, true);
    let father = this.makePersonFromOwsPerson(ows, "father", gedcomx);
    let mother = this.makePersonFromOwsPerson(ows, "mother", gedcomx);
    let spouse = this.makePersonFromOwsPerson(ows, "spouse", gedcomx);
    this.addRelationshipIfPresent(gedcomx, father, person, GX_PARENT_CHILD);
    this.addRelationshipIfPresent(gedcomx, mother, person, GX_PARENT_CHILD);
    this.addRelationshipIfPresent(gedcomx, person, spouse, GX_COUPLE);
    let mainPersonArk = person.identifiers[PERSISTENT_TYPE][0];
    let mainPersonSourceDescription = {
      "id": "#sd_" + person.id,
      "about": mainPersonArk,
      "identifiers": {
        "http://gedcomx.org/Persistent": [mainPersonArk]
      }
    };
    gedcomx.sourceDescriptions = [mainPersonSourceDescription];
    gedcomx.description = "#" + mainPersonSourceDescription.id;
    fixEventOrders(gedcomx);
    removeDuplicateEvents(gedcomx);
    return gedcomx;
  }

  makePersonFromOwsPerson(ows, role, gedcomx, isPrincipal) {
    let owsPerson = ows[role];
    if (owsPerson) {
      let person = {};
      person.id = owsPerson.personId;
      person.identifiers = {
        "http://gedcomx.org/Persistent": [ "https://www.familysearch.org/ark:/61903/4:1:" + owsPerson.personId ]
      };
      if (isPrincipal) {
        person.principal = true;
      }
      if (owsPerson.gender && owsPerson.gender === "MALE" || owsPerson.gender === "FEMALE") {
        person.gender = {
          type: owsPerson.gender === "MALE" ? GX_MALE : GX_FEMALE
        }
      }
      if (owsPerson.names) {
        person.names = owsPerson.names;
      }
      else {
        person.names = [ { "nameForms": [ { "fullText": person.fullText ? person.fullText : "?" } ] } ];
      }
      if (owsPerson.facts) {
        person.facts = owsPerson.facts;
      }
      gedcomx.persons.push(person);
      return person;
    }
    return null;
  }

  addRelationshipIfPresent(gedcomx, person1, person2, relationshipType) {
    if (person1 && person2) {
      let relationship = {
        "type": relationshipType,
        "person1": { "resourceId": person1.id, "resource": "#" + person1.id },
        "person2": { "resourceId": person2.id, "resource": "#" + person2.id }
      };
      gedcomx.relationships.push(relationship);
    }
  }

  getOrdinancesHtml() {
    let ordinanceList = [];
    for (let ord of this.ordinances) {
      ordinanceList.push(encode(ord.getOrdString()));
    }
    return ordinanceList.join("<br>");
  }
}

function sortOrdinances(ordinances) {
  ordinances.sort((a, b) => a.ordinanceSortKey.localeCompare(b.ordinanceSortKey));
}

function getNormalizedDateElement(performedDate) {
  if (performedDate) {
    let norm = performedDate.normalized;
    if (!norm) {
      norm = performedDate.original;
    }
    if (norm) {
      // Normalized date like "06 Dec 1991 00:00:00 GMT" or "7 Feb 2007 08:37:51 GMT"
      // Strip off the timestamp and leave just the date, with leading 0 removed from day.
      norm = norm.replace(/\s\d{2}:\d{2}:\d{2}\s.*$/, "");
      return norm;
    }
  }
  return null;
}

// Hundreds of millions of names from the controlled extraction program were imported into both Family Tree and Historical Records.
//   The personas in the indexed Historical Records have a Field with type "FsPrTreeId" (or FsPrFthrTreeId or FsPrMthrTreeId, etc.).
//   This method finds that field and returns the J-Encoded person ID from it.
//   This person ID should correspond to the "originallyAttachedTo" person ID in an ordinance work set.
// There is sometimes a question as to which resulting person an ordinance should go with. But if the ordinance was done
//   as part of the extraction program, then the ordinance should remain "stapled" to the record persona. So wherever
//   one goes, the other must go, too.
function getStapledOrdinancePersonId(person) {
  if (person && person.fields) {
    for (let field of person.fields) {
      const fieldType = extractType(field.type);
      if (fieldType && fieldType.startsWith("Fs") && fieldType.endsWith("TreeId")) {
        const numericCpPersonId = field.values[0].text;
        return jencode(Number(numericCpPersonId));
      }
    }
  }
  return null;
}

// See getStapledOrdinancePersonId() above for an explanation of stapled ordinances.
function linkStapledOrdinancesToRecordPersonas(personRows) {
  // (Note: It is possible that additional ordinances were done for this person after the extraction ordinances were done.
  // If the person was "hijacked" by that point, the ordinances might really belong to someone other than the person
  // in the indexed record. But this would be very rare, so we're going to assume that the ordinance should be on the same
  // resulting person as the indexed record that was extracted. As a workaround, a user could manually move the source
  // after the split).

  // Map of CP person ID to list of PersonRow objects for extraction ordinances for that person.
  const pidOrdinanceRowMap = new Map();
  // Map of CP person ID to list of PersonRow objects for indexed record personas
  const pidPersonaRowMap = new Map();

  for (let personRow of personRows) {
    if (personRow.ows) {
      let pid = personRow.ows.supposedOriginalPersonId;
      if (pid) {
        let owsList = computeIfAbsent(pidOrdinanceRowMap, pid, () => []);
        owsList.push(personRow);
      }
    }
    else if (personRow.sourceInfo) {
      let pid = personRow.sourceInfo.stapledOrdinancePersonId;
      if (pid) {
        let personaList = computeIfAbsent(pidPersonaRowMap, pid, () => []);
        personaList.push(personRow);
      }
    }
  }

  for (let [pid, ordinanceRows] of pidOrdinanceRowMap) {
    let personaRows = pidPersonaRowMap.get(pid);
    if (personaRows) {
      for (let ordinanceRow of ordinanceRows) {
        ordinanceRow.stapledRows = personaRows;
      }
      for (let personaRow of personaRows) {
        personaRow.stapledRows = ordinanceRows;
      }
    }
  }
}