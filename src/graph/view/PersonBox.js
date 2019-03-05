/*
  PersonBox: Represents a person box in a RelChart, with its position, size, and a pointer to the person information in its corresponding PersonNode.
 */

PersonBox.prototype.setPreviousPosition = function() {
  this.prevTop = this.top;
  this.prevCenter = this.center;
  this.prevHeight = this.height;
};

// Move this PersonBox vertically down by the given delta-Y (which could be negative for up or positive for down).
PersonBox.prototype.move = function(dy) {
  this.top += dy;
  this.center += dy;
};

PersonBox.prototype.hasMoved = function() {
  return this.prevTop    !== this.top ||
         this.prevCenter !== this.center ||
         this.prevHeight !== this.height;
};

PersonBox.prototype.setPosition = function() {
  this.setPreviousPosition();
  this.$personDiv.animate({top: this.getTop(), left: this.getLeft()}, RelationshipChart.prototype.animationSpeed);
};

PersonBox.prototype.getLeft = function() {
  return this.generation.getLeft();
};

PersonBox.prototype.getRight = function() {
  return this.getLeft() + this.width;
};

PersonBox.prototype.getTop = function() {
  return this.top;
};

PersonBox.prototype.getCenter = function() {
  return this.center;
};

PersonBox.prototype.getBottom = function() {
  return this.top + this.height + this.relChart.personBorder;
};

PersonBox.prototype.getPersonId = function() {
  return this.personNode.personId;
};

function PersonBox(personNode, relChart, personAbove, personBelow, generation) {

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
              html += "  <span class='" + (isFirstFullName ? "fullName" : "altName") + "'>" + encode(form.fullText) + "</span>";
              if (isFirstFullName) {
                var isPrincipal = person.principal;
                html += "<span class='" + (isPrincipal ? "isPrincipal" : "notPrincipal") + " toolTip'>" + (isPrincipal ? "*" : " ") +
                    "<span class='toolTipText'>" + (isPrincipal ? "Principal" : "Not principal") + "</span></span>";
              }
              html += "<br/>\n";

              if (isFirstFullName) {
                html += ""
              }
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
        html += "  <div class='fact'><span class='factType'>" + encode(getFactName(fact)) +
            ":</span> <span class='factDatePlace'>" + encode(getFactDatePlace(fact)) + "</span></div>\n";
      }
    }
    return html;
  }

  function addIdDiv(person) {
    return "  <div class='fact'><span class='factType'>" + encode("Id") +
            ":</span> <span class='factDatePlace'>" + encode(person.id) + "</span></div>\n";
  }

  /**
   Generate a JQuery HTML node like this:
   <div class='personNode gender-M' id='XXXX-YYY'>
   <span class='fullName'>Fred Jones</span></br>
   <span class='altName'>Frederick Johannes</span></br>
   <div class='fact'><span class='factType'>Birth:</span> <span class='factDatePlace'>1820; Vermont</span></div>
   </div>
   @param personNode - PersonNode to create PersonBox for
   */
  function makePersonDiv(personNode) {
    var html = "<div class='personNode gender-" + personNode.gender + "' id='" + personNode.personId + "'>\n";
    var person = personNode.person;
    html += addNameSpans(person);
    //html += addIdDiv(person);
    html += addFactDivs(person);
    html += "</div>";
    return $.parseHTML(html);
  }

  // PersonBox constructor ==========================================
  //this.boxId = "box_" + personNode.personId; // temporary id helpful for debugging. Not used.
  this.relChart = relChart; // for access to settings like personBorder.
  this.personNode = personNode; // PersonNode that corresponds to this PersonBox
  this.above = personAbove; // PersonBox of the person above in the global list of person boxes (not necessarily the same generation)
  this.below = personBelow; // PersonBox of person below in the global list.
  this.genAbove = null; // PersonBox of person above in the same generation
  this.genBelow = null; // PersonBox of person below in the same generation
  this.generation = generation;
  this.subtree = null;
  this.order    = 0; // Global order of this PersonBox in the chart
  this.genOrder = 0; // Order of this PersonBox within its generation


  this.parentLines = [];
  this.spouseLines = [];

  this.duplicateOf = null; // PersonBox of the first appearance of this same PersonNode in the chart, if any.

  var personDiv = makePersonDiv(personNode);
  relChart.$personsDiv.append(personDiv);
  this.$personDiv = $("#" + personNode.personId);
  this.$personDiv.outerWidth(generation.relChart.generationWidth);
  this.height = this.$personDiv.outerHeight();
  this.width = this.$personDiv.outerWidth();

  this.top    = 0; // Pixel-level information
  this.center = this.height / 2; // Initially just top + height/2.
  // (the "left" coordinate of all PersonBoxes in a Generation are in Generation.left).

  this.prevHeight = this.height;
  this.prevTop = this.top;
  this.prevCenter = this.center;
}