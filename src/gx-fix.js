// Common fixup operations for a GEDCOM X document.

function fix(gx) {
  fixAge(gx);
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
