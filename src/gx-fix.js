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
  var i, j;
  var fact;

  if (doc.persons) {
    for (i = 0; i < doc.persons.length; i++) {
      var person = doc.persons[i];
      if (!person.id) {
        person.id = generateLocalId();
      }

      if (person.facts) {
        for (j = 0; j < person.facts.length; j++) {
          fact = person.facts[j];
          if (!fact.id) {
            fact.id = generateLocalId();
          }
        }
      }

      if (person.names) {
        for (j = 0; j < person.names.length; j++) {
          var name = person.names[j];
          if (!name.id) {
            name.id = generateLocalId();
          }
        }
      }
    }
  }

  if (doc.relationships) {
    for (i = 0; i < doc.relationships.length; i++) {
      var relationship = doc.relationships[i];
      if (!relationship.id) {
        relationship.id = generateLocalId();
      }

      if (relationship.facts) {
        for (j = 0; j < relationship.facts.length; j++) {
          fact = relationship.facts[j];
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
  var i, j, k;
  var sd = getSourceDescription(doc, doc.description);
  var isObituary = sd && sd.coverage && sd.coverage.length > 0 && sd.coverage[0].recordType === "http://gedcomx.org/Obituary";

  if (doc.persons) {
    for (i = 0; i < doc.persons.length; i++) {
      var person = doc.persons[i];
      var age = null;
      if (person.fields) {
        for (j = 0; j < person.fields.length; j++) {
          if (person.fields[j].type === "http://gedcomx.org/Age") {
            var ageField = person.fields[j];
            if (ageField.values) {
              for (k = 0; k < ageField.values.length; k++) {
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
        var ageAdded = false;
        var fact;
        for (j = 0; j < person.facts.length; j++) {
          if ((isObituary && person.facts[j].type === "http://gedcomx.org/Death") || (!isObituary && person.facts[j].primary)) {
            fact = person.facts[j];
            if (!fact.qualifiers) {
              fact.qualifiers = [];
            }

            var addAge = true;
            for (k = 0; k < fact.qualifiers.length; k++) {
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
          fact = {
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
  var source = getSourceDescription(doc, doc.description);

  var sourceOfSource;
  if (source && source.sources && source.sources.length > 0) {
    sourceOfSource = getSourceDescription(doc, source.sources[0].description);
  }

  var sourceDocument;
  if (sourceOfSource && sourceOfSource.about) {
    var sourceDocumentId = sourceOfSource.about.substr(1);
    if (doc.documents) {
      for (var i = 0; i < doc.documents.length; i++) {
        var candidate = doc.documents[i];
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
    for (var i = 0; i < gx.persons.length; i++) {
      var person = gx.persons[i];
      if (person.names) {
        for (var j = 0; j < person.names.length; j++) {
          var name = person.names[j];
          if (name.type === "http://gedcomx.org/BirthName") {
            //assume birth name is implicit, not explicit
            name.type = null;
          }
        }
      }
    }
  }
}


