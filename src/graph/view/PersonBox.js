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
  return this.top + this.height;
};

// Get the y-coordinate of where the next box below should go, which is this box's bottom plus the 'personBorder' for spacing.
PersonBox.prototype.getBelow = function() {
  return this.getBottom() + this.relChart.personBorder;
};

PersonBox.prototype.getPersonId = function() {
  return this.personNode.personId;
};

// Remove the given parent FamilyLine from the parentLines array.
PersonBox.prototype.removeParentFamilyLine = function(parentFamilyLine) {
  var index = this.parentLines.indexOf(parentFamilyLine);
  if (index < 0) {
    throw "Failed to find parent family line.";
  }
  this.parentLines.splice(index, 1);
};

/**
 * Constructor for a PersonBox.
 * @param personNode - PersonNode containing the information shown in this PersonBox.
 * @param relChart
 * @param personAbove
 * @param personBelow
 * @param generation
 * @constructor
 */
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

  function addIfNotEmpty(value, array) {
    if (value) {
      array.push(value);
    }
  }

  // Get string containing a semi-colon separated list of the value, date and place, if any. Return 'undefined' if none of those exist
  // (e.g., for a fact like "AdoptiveParent" with no value, date or place).
  function getFactInfo(fact) {
    var parts = [];
    addIfNotEmpty(fact.value, parts);
    addIfNotEmpty(getDate(fact), parts);
    addIfNotEmpty(getPlace(fact), parts);
    return parts.length === 0 ? undefined : parts.join("; ");
  }

  /**
   * Create HTML for a div for the given fact, with the optional given qualifier.
   * @param fact - Fact to generate HTML for
   * @param qualifier - Qualifier to include after the fact type (e.g., "spouse 2" for "Marriage (spouse 2): 1820".
   * @returns HTML string for a div for this fact.
   */
  function getFactHtml(fact, qualifier) {
    var info = getFactInfo(fact);
    return "  <div class='fact'><span class='factType'>" + encode(getFactName(fact)) +
        (qualifier ? " (" + encode(qualifier) + ")" : "") + (info ? ":" : "") + "</span>" +
        (info ? " <span class='factDatePlace'>" + encode(info) + "</span>" : "") +
        "</div>\n";
  }

  function getFactsHtml(factsContainer, prefix) {
    var html = "";
    if (factsContainer) {
      var facts = factsContainer.facts;
      if (facts) {
        var f;
        for (f = 0; f < facts.length; f++) {
          html += getFactHtml(facts[f], prefix);
        }
      }
    }
    return html;
  }

  /**
   * Tell whether the given array of parent FamilyNodes has more than
   * @param parentFamilies
   * @param countFathers
   * @returns {boolean}
   */
  function hasMultipleParents(parentFamilies, countFathers) {
    if (parentFamilies && parentFamilies.length > 1) {
      var firstParentId = null;
      var p;
      for (p = 0; p < parentFamilies.length; p++) {
        var parentFamilyNode = parentFamilies[p];
        var parentNode = countFathers ? parentFamilyNode.father : parentFamilyNode.mother;
        if (parentNode) {
          if (!firstParentId) {
            firstParentId = parentNode.personId;
          }
          else if (parentNode.personId !== firstParentId) {
            return true; // found a second parent ID of the same type.
          }
        }
      }
    }
    return false;
  }

  function hasMultipleSpouses(personNode, spouseFamilies) {
    if (spouseFamilies && spouseFamilies.length > 1) {
      var f;
      var firstSpouseId = null;
      for (f = 0; f < spouseFamilies.length; f++) {
        var spouseFamily = spouseFamilies[f];
        var spouseNode = spouseFamily.getSpouse(personNode);
        if (spouseNode) {
          if (!firstSpouseId) {
            firstSpouseId = spouseNode.personId;
          }
          else if (spouseNode.personId !== firstSpouseId) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function hasMultipleFathers(parentFamilies) {
    return hasMultipleParents(parentFamilies, true);
  }

  function hasMultipleMothers(parentFamilies) {
    return hasMultipleParents(parentFamilies, false);
  }

  function addFactDivs(personNode) {
    var html = getFactsHtml(personNode.person);

    // Add marriage and other couple facts for spouse families.
    var s;
    if (!isEmpty(personNode.spouseFamilies)) {
      var multipleSpouses = hasMultipleSpouses(personNode, personNode.spouseFamilies);
      for (s = 0; s < personNode.spouseFamilies.length; s++) {
        var spouseFamilyNode = personNode.spouseFamilies[s];
        //  Only show couple facts on the father, since they would be redundant on the mother.
        //  A spouse FamilyNode that does not have both a father and a mother will not have a couple relationship with it, and will thus have no facts.
        if (spouseFamilyNode.father === personNode) {
          var spouseName = spouseFamilyNode.mother ? spouseFamilyNode.mother.name : null;
          html += getFactsHtml(spouseFamilyNode.coupleRel, multipleSpouses ? spouseName : null);
        }
      }
    }
    // Add adoption or other such parent-child facts for parent families. Include (father), (mother) after fact type.
    var p; // parent family index
    if (!isEmpty(personNode.parentFamilies)) {
      var multipleFathers = hasMultipleFathers(personNode.parentFamilies);
      var multipleMothers = hasMultipleMothers(personNode.parentFamilies);
      for (p = 0; p < personNode.parentFamilies.length; p++) {
        var parentFamilyNode = personNode.parentFamilies[p];
        // Find the index of this person in the list of children.
        var c = parentFamilyNode.findChildIndex(personNode);
        var fatherRel = parentFamilyNode.fatherRels[c];
        var motherRel = parentFamilyNode.motherRels[c];
        html += getFactsHtml(fatherRel, "father" + (multipleFathers && parentFamilyNode.father ? " - " + parentFamilyNode.father.name : ""));
        html += getFactsHtml(motherRel, "mother" + (multipleMothers && parentFamilyNode.mother ? " - " + parentFamilyNode.mother.name : ""));
      }
    }
    return html;
  }

  function addIdDiv(person) {
    // Use factType class for both label and id so that they're both subdued.
    return "  <div class='fact'><span class='factType'>" + encode("Id") +
            ":</span> <span class='factType'>" + encode(person.id) + "</span></div>\n";
  }

  PersonBox.prototype.genderImageMap = {
    "M" : "male.png",
    "F" : "female.png",
    "U" : "unknown.png"
  };

  /**
   Generate a JQuery HTML node like this:
   <div class='personNode gender-M' id='XXXX-YYY'>
   <span class='fullName'>Fred Jones</span></br>
   <span class='altName'>Frederick Johannes</span></br>
   <div class='fact'><span class='factType'>Birth:</span> <span class='factDatePlace'>1820; Vermont</span></div>
   </div>
   @param personNode - PersonNode to create PersonBox for
   @param personBoxId - Id for this PersonBox
   @param duplicateOfBox - PersonBox that this one is a duplicate of (if any)
   */
  function makePersonDiv(personNode, personBoxId, duplicateOfBox) {
    var html = "<div class='personNode gender-" + personNode.gender + (duplicateOfBox ? " duplicate" : "") + "' id='" + personBoxId + "'>\n";
    var imageFile = PersonBox.prototype.genderImageMap[personNode.gender];
    html += "<img src='images/" + imageFile + "' class='gender-image'>";
    var person = personNode.person;
    html += addNameSpans(person);
    html += addIdDiv(person);
    html += addFactDivs(personNode);
    html += "</div>";
    return $.parseHTML(html);
  }

  // PersonBox constructor ==========================================
  this.relChart = relChart; // for access to settings like personBorder.
  this.personNode = personNode; // PersonNode that corresponds to this PersonBox
  this.above = personAbove; // PersonBox of the person above in the global list of person boxes (not necessarily the same generation)
  this.below = personBelow; // PersonBox of person below in the global list.
  this.genAbove = null; // PersonBox of person above in the same generation
  this.genBelow = null; // PersonBox of person below in the same generation
  this.generation = generation;
  this.subtree = null; // 0-based integer indicating which subtree of related persons this PersonBox is part of.
  this.order    = 0; // Global order of this PersonBox in the chart
  this.genOrder = 0; // Order of this PersonBox within its generation

  // List of FamilyLine objects for this person's parents (i.e., families in which this person is a child)
  this.parentLines = [];
  // List of FamilyLine objects for this person's spouses and children (i.e., families in which this person is a spouse or parent)
  this.spouseLines = [];

  // The personBoxId is used to identify each PersonBox. The personId is not used alone because a person can sometimes appear more than once in a chart
  //   if they are related more than one way.
  this.personBoxId = "box_" + personNode.personId;

  // If this PersonBox is not the first appearance of this PersonNode in the chart (e.g., due to being related multiple ways),
  //  then note what PersonBox it is a duplicate of, and modify its personBoxId with "_dup<number>"
  this.duplicateOf = relChart.personBoxMap[this.personBoxId];
  if (this.duplicateOf) {
    var dupCount = relChart.personDupCount[personNode.personId];
    dupCount = (dupCount ? dupCount : 0) + 1;
    relChart.personDupCount[personNode.personId] = dupCount;
    this.personBoxId += "_dup" + dupCount;
  }
  relChart.personBoxMap[this.personBoxId] = this;
  
  var personDiv = makePersonDiv(personNode, this.personBoxId, this.duplicateOf);
  relChart.$personsDiv.append(personDiv);
  this.$personDiv = $("#" + this.personBoxId);

  // Allow a person box to be able to receive a drag & drop event.
  this.$personDiv.droppable({hoverClass : "personDropHover", scope : "personDropScope", drop:
        function(e, ui) {
          var droppedPersonBox = relChart.personBoxMap[e.target.id];
          var plus = e.originalEvent.target.id;
          if (plus === "motherPlus" || plus === "fatherPlus") {
            var familyLine = relChart.familyLineMap[selectedFamilyLineId];
            switch (plus) {
              case "motherPlus":
                familyLine.changeMother(droppedPersonBox);
                break;
              case "fatherPlus":
                familyLine.changeFather(droppedPersonBox);
                break;
            }
          }
          else {
            var sourcePersonBox = relChart.personBoxMap[selectedPersonBoxId];
            var sourcePersonId = sourcePersonBox.personNode.personId;
            var droppedPersonId = droppedPersonBox.personNode.personId;
            var doc = relChart.relGraph.gx;
            switch (plus) {
              case "personParentPlus":
                relChart.ensureRelationship(doc, GX_PARENT_CHILD, droppedPersonId, sourcePersonId);
                break;
              case "personChildPlus":
                relChart.ensureRelationship(doc, GX_PARENT_CHILD, sourcePersonId, droppedPersonId);
                break;
              case "personSpousePlus":
                var sourcePersonNode = sourcePersonBox.personNode;
                var droppedPersonNode = droppedPersonBox.personNode;
                if (wrongGender(sourcePersonNode, droppedPersonNode)) {
                  relChart.ensureRelationship(doc, GX_COUPLE, droppedPersonId, sourcePersonId);
                }
                else {
                  relChart.ensureRelationship(doc, GX_COUPLE, sourcePersonId, droppedPersonId);
                }
                break;
              default:
                return; // Don't update the record, because nothing happened.
            }
          }
          updateRecord(relChart.relGraph.gx);
        }

  });
  
  var personBoxId = this.personBoxId;
  this.$personDiv.click(function(e) {
    togglePerson(personBoxId, e);
  });
  
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