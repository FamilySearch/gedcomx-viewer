function readGedcomX(url, callback) {
  $.ajax({type: "GET",
    dataType: "json",
    accepts: {json: "application/x-gedcomx-v1+json"},
    url: url,
    success: function (stuff, textStatus, jqKHR) {
      callback(url, stuff);
    },
    error: function (jqXHR, textStatus, errorThrown) {
      console.log("Didn't make it: " + url);
    }
  });
}

// Having read a GedcomX record, see if the sourceDescription has a recordDescriptor.
// If so, read the collection object that has it, and call back to showRecord.
// If not, just go straight to showRecord.
function readRecordDescriptor(doc) {

}

function encode(s) {
  return $('<div/>').text(s).html();
}

function empty(s) {
  return s === undefined || s === null || s.length === 0;
}

function makeGenderHtml(gender) {
  var genderString;
  if (gender) {
    if (gender.type === 'http://gedcomx.org/Male') {
      genderString = '<span class="male">M</span>';
    }
    else if (gender.type === 'http://gedcomx.org/Female') {
      genderString = '<span class="female">F</span>';
    }
    else {
      genderString = '<span class="unknown">?</span>';
    }
  }
  else {
    genderString = '<span class="unknown">?</span>';
  }
  return genderString;
}

function makeNameHtml(name) {
  var j, k, nameForm, namePart;
  var s = "<span class=\'name\'>";
  if (!empty(name.type) && name.type !== "http://gedcomx.org/BirthName") {
    s += "[" + name.type.replace("http://gedcomx.org/", "") + "]";
  }
  if (name.hasOwnProperty('nameForms')) {
    for (j = 0; j < name.nameForms.length; j++) {
      nameForm = name.nameForms[j];
      if (j > 0) {
        s += "</span><br/><span>[Form" + (empty(nameForm.lang) ? "" : " (" + nameForm.lang + ")") + ": ";
      }
      s += (empty(nameForm.fullText) ? encode("<Empty>") : encode(nameForm.fullText));
      if (j > 0) {
        s += "]";
      }
      if (nameForm.parts) {
        for (k = 0; k < nameForm.parts.length; k++) {
          namePart = nameForm.parts[k];

        }
      }
      //todo: name parts, fields...
    }
  }
  s += "</span>";
  return s;
}

function makePersonHtml(person, doc) {
  var s = "<div class='person' " + (person.id ? " id='" + person.id + "'" : "") + ">P" + person.index + " ";
  s += makeGenderHtml(person.hasOwnProperty('gender') ? person.gender : null) + " ";
  var i, j, k;
  var name, nameForm, namePart;
  var fact, pos, hadDate;

  if (person.hasOwnProperty('names')) {
    for (i = 0; i < person.names.length; i++) {
      s += makeNameHtml(person.names[i]);
    }
  }
  else {
    s += "<p class='name'>" + genderString + encode("<No name>") + "</p>\n";
  }

  if (person.hasOwnProperty('facts')) {
    for (i = 0; i < person.facts.length; i++) {
      s += "<p class='fact'>";
      fact = person.facts[i];
      if (empty(fact.type)) {
        s += "Other";
      }
      else {
        pos = fact.type.lastIndexOf("/");
        s += encode(pos >= 0 ? fact.type.substring(pos + 1) : fact.type);
      }
      s += ": ";
      hadDate = false;
      if (fact.hasOwnProperty('date') && !empty(fact.date.original)) {
        s += encode(fact.date.original);
        hadDate = true;
      }
      if (fact.hasOwnProperty('place') && !empty(fact.place.original)) {
        if (hadDate) {
          s += encode("; ");
        }
        s += encode(fact.place.original);
      }
      s += "</p>\n";
    }
  }
  //todo: fields
  //todo: relatives...
  //todo: isPrincipal
  var identifier = getIdentifier(person);
  s += "  <p class='ark'><a href='" + identifier +"'>" + identifier + "</a> (" + person.id + ")</p>\n";
  s += "</div>\n"; // person div.
  return s;
}

function getIdentifier(object) {
  var id = null;
  if (object.hasOwnProperty('identifiers')) {
    id = getFirst(object.identifiers["http://gedcomx.org/Persistent"]);
    if (id === null) {
      id = getFirst(object.identifiers["http://gedcomx.org/Primary"]);
      if (id === null) {
        for (var idType in object.identifiers) {
          if (object.identifiers.hasOwnProperty(idType)) {
            id = getFirst(object.identifiers[idType]);
            if (id !== null) {
              return id;
            }
          }
        }
      }
    }
  }
  return id;
}

function getFirst(array) {
  if (array !== null && array !== undefined && array.length > 0) {
    return array[0];
  }
  return null;
}

function showRecord(url, doc) {
  var gxDiv = $("#gx");
  gxDiv.text("Processing record...");
  //buildDocMaps(doc);
  var s = "<p>Record URL: " + url + "</p>\n";
  var i;

  if (doc.hasOwnProperty('persons')) {
    // Create a short 1-based person index for viewing.
    for (i = 0; i < doc.persons.length; i++) {
      doc.persons[i].index = i + 1;
    }
    for (i = 0; i < doc.persons.length; i++) {
      s += makePersonHtml(doc.persons[i], doc);
    }
  }
  if (doc.hasOwnProperty('relationships')) {
    //todo
  }
  gxDiv.html(s);
  $("#p_15024659740");
}