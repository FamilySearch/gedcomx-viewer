/*
  PersonBox: Represents a person in a RelChart, with its position, size, and a pointer to the person information in its corresponding PersonNode.
 */
function PersonBox(personNode, $personsDiv, personAbove, personBelow, generation) {
  function addNameSpans(person) {
    var html = "";
    var n, f;
    var isFirstFullName = true;
    if (person.names) {
      for (n = 0; n < person.names.length; n++) {
        var name = person.names[n];
        if (name.nameForms) {
          for (f = 0; f < name.nameForms.length; f++) {
            var form = name.nameForms[f];
            if (form.fullText) {
              html += "  <span class='" + (isFirstFullName ? "fullName" : "altName") + "'>" + encode(form.fullText) + "</span><br/>\n";
              isFirstFullName = false;
            }
          }
        }
      }
    }
    if (isFirstFullName) {
      html += "  <span class='fullName main Name'>" + encode("?") + "</span>\n";
    }
    return html;
  }

  // Get the 'type' of the fact, strip off the URI path up to the last slash (/),
  // and convert 'FactTypeName' to 'Fact Type Name'. If no type, return "Other".
  function getFactName(fact) {
    if (fact && fact.type) {
      // Strip up to last "/" to convert "http://gedcomx.org/MarriageBanns" to "MarriageBanns".
      // Then insert a space before all capital letters to get " Marriage Banns".
      // Then trim white space to get "Marriage Banns".
      return fact.type.replace(/.*\//g, '').replace(/([A-Z])/g, " $1" ).replace(/^ /, "");
    }
    return "Other";
  }

  // Get a date string from the date in the given fact (if any), or return 'undefined' otherwise.
  function getDate(fact) {
    if (fact && fact.date && fact.date.original) {
      return fact.date.original;
    }
    return undefined;
  }

  function getPlace(fact) {
    if (fact && fact.place && fact.place.original) {
      return fact.place.original;
    }
    return undefined;
  }

  function getFactDatePlace(fact) {
    var date = getDate(fact);
    var place = getPlace(fact);
    if (date && place) {
      return date + "; " + place;
    }
    else return date ? date : place;
  }

  function addFactDivs(person) {
    var html = "";
    var f;
    var fact;
    if (person.facts) {
      for (f = 0; f < person.facts.length; f++) {
        fact = person.facts[f];
        html += "<div class='fact'><span class='factType'>" + encode(getFactName(fact)) +
                ":</span> <span class='factDatePlace'>" + encode(getFactDatePlace(fact)) + "</span></div>";
      }
    }
    html += "</div>";
    return html;
  }

  /**
   Generate a JQuery HTML node like this:
   <div class='personNode gender-M' id='XXXX-YYY'>
     <span class='fullName'>Fred Jones</span></br>
     <span class='altName'>Frederick Johannes</span></br>
     <div class='fact'><span class='factType'>Birth:</span> <span class='factDatePlace'>1820; Vermont</span></div>
   </div>
   @param personNode - PersonNode to create PersonBox for
   @param $personsDiv - JQuery object wrapping the div with the list of persons in it. The new PersonBox is added to this.
   */
  function makePersonDiv(personNode) {
    var html = "<div class='personNode gender-" + personNode.gender + "' id='" + personNode.personId + "'>\n";
    var person = personNode.person;
    html += addNameSpans(person);
    html += addFactDivs(person);

    return $.parseHTML(html);
  }

  this.personNode = personNode;
  this.top = 0;
  this.bottom=0;
  this.center=0;
  this.height=0;
  this.generation = generation;
  this.genAbove = null; // PersonBox of person above in the same generation
  this.genBelow = null; // PersonBox of person below in the same generation
  this.above = personAbove; // PersonBox of the person above in the global list of person boxes (not necessarily the same generation)
  this.below = personBelow; // PersonBox of person below in the global list.

  var personDiv = makePersonDiv(personNode);
  $personsDiv.append(personDiv);
  this.$personDiv = $("#" + this.personNode.personId);
  this.height = this.$personDiv.height();
}