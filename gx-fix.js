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


