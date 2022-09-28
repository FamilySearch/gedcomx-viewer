/*
  PersonBox: Represents a person box in a RelChart, with its position, size, and a pointer to the person information in its corresponding PersonNode.
 */

PersonBox.prototype.setPreviousPosition = function() {
  this.prevTop = this.top;
  this.prevCenter = this.center;
  this.prevHeight = this.height;
};

// Move this PersonBox vertically down by the given delta-Y (which could be negative for up or positive for down).
PersonBox.prototype.move = function(dy, dx) {
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
  this.$personDiv.animate({top: this.getTop(), left: this.getLeft()}, this.relChart.getAnimationSpeed());
};

PersonBox.prototype.getLeft = function() {
  return this.generation ? this.generation.getLeft() : 0;
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
  let index = this.parentLines.indexOf(parentFamilyLine);
  if (index < 0) {
    throw "Failed to find parent family line.";
  }
  this.parentLines.splice(index, 1);
};

PersonBox.prototype.getPersonBoxId = function(personId, chartId) {
  return `box_${personId}-${chartId}`;
};

function clickIndicator(key, shouldHide, personId) {
  let personIds = [personId];
  if (currentRelChart && currentRelChart.selectedPersonBoxes) {
    let selectedPersonIds = getPersonIdsOfPersonBoxes(currentRelChart.selectedPersonBoxes);
    if (selectedPersonIds.includes(personId)) {
      personIds = selectedPersonIds;
    }
  }
  toggleRelatives(key, shouldHide === "true", personIds);
  return false;
}

/**
 * Constructor for a PersonBox.
 * @param personNode - PersonNode containing the information shown in this PersonBox.
 * @param relChart
 * @param personAbove
 * @param personBelow
 * @param generationIndex
 * @param relChartToGx - Map of relationship chart HTML element id to GedcomX object id it corresponds to (for coordinated highlighting).
 * @constructor
 */
function PersonBox(personNode, relChart, personAbove, personBelow, generationIndex, relChartToGx) {

  function addNameSpans(person) {
    let html = "";
    let isFirstFullName = true;
    if (person.names) {
      for (let name of person.names) {
        if (name.nameForms) {
          for (let form of name.nameForms) {
            if (form.fullText) {
              let elementId = nextId("name", relChartToGx, name);
              if (form.parts) {
                const namePartSpans = form.parts.map(part => {
                  const partType = part.type.substring(part.type.lastIndexOf("/") + 1).toLowerCase();
                  return `<span class="${partType}" id="${elementId}">${encode(part.value)}</span>`;
                });
                html += `  ${namePartSpans.join('  ')}`;
              } else {
                html += `  <span class="${isFirstFullName ? 'fullName' : 'altName'}" id="${elementId}">${encode(form.fullText)}</span>`;
              }
              if (isFirstFullName) {
                let isPrincipal = person.principal;
                html += "<span class='" + (isPrincipal ? "isPrincipal" : "notPrincipal") + " toolTip'>" + (isPrincipal ? "*" : " ") +
                    "<span class='toolTipText'>" + (isPrincipal ? "Principal" : "Not principal") + "</span></span>";
              }
              html += getConfidenceSpan(name.confidence);
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

  // Return an HTML span with the given confidence in it, if any; otherwise, return the empty string.
  function getConfidenceSpan(confidenceUri) {
    if (relChart.shouldShowConfidence && confidenceUri) {
      let confidenceValue = confidenceUri.replace(/.*[=/](?=[0-9]+$)/, "");
      if (confidenceValue) {
        return "<span class=confidence> [" + encode(confidenceValue) + "%]</span>"
      }
    }
    return "";
  }

  // Get the 'type' of the fact, strip off the URI path up to the last slash (/),
  // and convert 'FactTypeName' to 'Fact Type Name'. If no type, return "Other".
  function getFactName(fact) {
    if (fact && fact.type) {
      let factName = fact.type.startsWith("data:,") ? fact.type.replace(/data:,/, "") : fact.type.replace(/.*\//g, "");
      let noURI = decodeURI(factName).replaceAll(/[+]/g, " ");
      let splitCamel = noURI.replace(/([^A-Z ])([A-Z])/g, "$1 $2" );
      let singleSpaces = splitCamel.replaceAll(/  */g, " ");
      let trimmed = singleSpaces.trim();
      // if (fact.type.startsWith("data:,")) {
      //   return fact.type.replace(/data:,/, "").replaceAll(/ *[+] */g, " ");
      // }
      // Strip up to last "/" to convert "http://gedcomx.org/MarriageBanns" to "MarriageBanns".
      // Then insert a space before all capital letters to get " Marriage Banns".
      // Then trim white space to get "Marriage Banns".
      // return fact.type.replace(/.*\//g, '').replace(/([A-Z])/g, " $1" );
      return trimmed;
    }
    return "Other";
  }

  /**
   * If the given value is not empty, then add it to the given array, wrapped in a "span" element,
   *   and with an appropriate element id.
   * @param value - Text value to display (if any)
   * @param array - Array to add HTML to for eventual display, if not empty
   * @param type - Type of value (used for generating the element id)
   * @param gx - GedcomX object (e.g., Date or Place) being added.
   */
  function addIfNotEmpty(value, array, type, gx) {
    if (value) {
      if (value.length > 250) {
        value = value.substr(0, 250) + "...";
      }
      value = encode(value);
      if (type && gx) {
        let elementId = nextId(type, relChartToGx, gx);
        value = "<span id='" + elementId + "'>" + value + "</span>" + getConfidenceSpan(gx.confidence);
      }
      array.push(value);
    }
  }

  // Get string containing a semi-colon separated list of the value, date and place, if any. Return 'undefined' if none of those exist
  // (e.g., for a fact like "AdoptiveParent" with no value, date or place).
  function getFactInfo(fact) {
    let parts = [];
    let factNamePrefix = getFactName(fact).toLowerCase().substr(0,3);
    // Todo: Remove this when fact type is no longer incorrectly put into the 'value'.
    if (fact.value && fact.value.toLowerCase() !== getFactName(fact).toLowerCase()) {
      addIfNotEmpty(fact.value, parts, factNamePrefix + "-value", fact);
    }
    addIfNotEmpty(getFactDate(fact), parts, factNamePrefix + "-date", fact.date);
    addIfNotEmpty(getFactPlace(fact), parts, factNamePrefix + "-place", fact.place);
    return parts.length === 0 ? undefined : parts.join("; ");
  }

  /**
   * Create HTML for a div for the given fact, with the optional given qualifier.
   * @param fact - Fact to generate HTML for
   * @param qualifier - Qualifier to include after the fact type (e.g., "spouse 2" for "Marriage (spouse 2): 1820".
   * @returns HTML string for a div for this fact.
   */
  function getFactHtml(fact, qualifier) {
    let encodedInfo = getFactInfo(fact);
    if (encodedInfo) {
      let factTypeId = nextId("fact", relChartToGx, fact);
      return "  <div class='fact'><span class='factType' id='" + factTypeId + "'>" + encode(getFactName(fact)) +
          (qualifier ? " (" + encode(qualifier) + ")" : "") + (encodedInfo ? ":" : "") + "</span>" +
          (encodedInfo ? " <span class='factDatePlace'>" + encodedInfo + "</span>" : "") +
          "</div>\n";
    }
    return "";
  }

  function getFactsHtml(factsContainer, prefix) {
    let html = "";
    if (factsContainer) {
      let facts = factsContainer.facts;
      if (facts) {
        for (let fact of facts) {
          html += getFactHtml(fact, prefix);
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
      let firstParentId = null;
      for (let parentFamilyNode of parentFamilies) {
        let parentNode = countFathers ? parentFamilyNode.father : parentFamilyNode.mother;
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
      let firstSpouseId = null;
      for (let spouseFamily of spouseFamilies) {
        let spouseNode = spouseFamily.getSpouse(personNode);
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
    let html = getFactsHtml(personNode.person);

    // Add marriage and other couple facts for spouse families.
    if (!isEmpty(personNode.spouseFamilies)) {
      let multipleSpouses = hasMultipleSpouses(personNode, personNode.spouseFamilies);
      for (let spouseFamilyNode of personNode.spouseFamilies) {
        //  Only show couple facts on the father, since they would be redundant on the mother.
        //  A spouse FamilyNode that does not have both a father and a mother will not have a couple relationship with it, and will thus have no facts.
        if (spouseFamilyNode.father === personNode) {
          let spouseName = spouseFamilyNode.mother ? spouseFamilyNode.mother.name : null;
          html += getFactsHtml(spouseFamilyNode.coupleRel, multipleSpouses ? spouseName : null);
        }
      }
    }
    // Add adoption or other such parent-child facts for parent families. Include (father), (mother) after fact type.
    if (!isEmpty(personNode.parentFamilies)) {
      let multipleFathers = hasMultipleFathers(personNode.parentFamilies);
      let multipleMothers = hasMultipleMothers(personNode.parentFamilies);
      for (let parentFamilyNode of  personNode.parentFamilies) {
        // Find the index of this person in the list of children.
        let c = parentFamilyNode.findChildIndex(personNode);
        let fatherRel = parentFamilyNode.fatherRels[c];
        let motherRel = parentFamilyNode.motherRels[c];
        html += getFactsHtml(fatherRel, "father" + (multipleFathers && parentFamilyNode.father ? " - " + parentFamilyNode.father.name : ""));
        html += getFactsHtml(motherRel, "mother" + (multipleMothers && parentFamilyNode.mother ? " - " + parentFamilyNode.mother.name : ""));
      }
    }
    return html;
  }

  function addRelativeDivs(person) {
    let html = "";
    for (let relative of person.relatives) {
      let relativeLabel = relative.label;
      let relativeName = relative.personNode.getFirstFullName();
      html += "  <div class='relative'><span class='relativeType'>" + encode(relativeLabel) + ":" + "</span>" +
              "<span class='relativeName'>" + encode(relativeName) + "</span></div>\n";
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

  function getGenderDivId(personBoxId) {
    return personBoxId + "-g";
  }

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
   @param shouldDisplayIds - Flag for whether to include person IDs.
   @param shouldDisplayDetails - Flag for whether to show facts
   */
  function makePersonDiv(personNode, personBoxId, duplicateOfBox, shouldDisplayIds, shouldDisplayDetails) {
    function hasVisibleRelatives(relativeIdsMap, personId) {
      let relativeIds = relativeIdsMap ? relativeIdsMap.get(personId) : null;
      let numVisible = 0;
      if (relativeIds) {
        for (let relativeId of relativeIds) {
          let personAnalysis = personAnalysisMap.get(relativeId);
          if (personAnalysis && personAnalysis.isVisible) {
            numVisible++;
          }
        }
      }
      return numVisible > 0;
    }

    /**
     * Add an indicator on a person box to be used for showing (adding if necessary) or else hiding relatives in some direction.
     * For showing relationships, the icon is always showing. For removing, it only appears on hover.
     * @param position (top, bottom, left, right)
     * @param key - Key to pass to ... P=Parents, S=Spouse, C=Child, M=Me
     * @param shouldHide - Flag for whether this is a "hide" indicator that only appears during hover. false => "show" indicator that always shows.
     */
    function addIndicator(position, key, shouldHide) {
      let indicatorId = personBoxId + "-indicator-" + position;
      let indicatorClass = position + "-indicator-" + (shouldHide ? "hide" : "show");
      let hoverClass = personBoxId + "-indicators";
      let clickArgs = "\"" + key + "\",\"" + (shouldHide ? "true" : "false") + "\",\"" + personNode.personId + "\"";
      return "<div id='" + indicatorId + "' class='" + indicatorClass + " " + hoverClass + "' onclick='clickIndicator(" + clickArgs + ");return false;'/>";
    }

    let html = "<div class='personNode gender-" + personNode.gender +
        (duplicateOfBox ? " duplicate" : "") +
        (personNode.person.principal ? " principalPerson" : "") +
        (personNode.person.living ? " livingPerson" : "") +
        "' id='" + personBoxId + "'>\n";
    let imageFile = PersonBox.prototype.genderImageMap[personNode.gender];
    // Use CDN to deliver these to avoid problems with different relative paths for different consumers.
    html += "<img alt='gender " + personNode.gender + "' id='" + getGenderDivId(personBoxId) + "' src='https://cdn.jsdelivr.net/gh/FamilySearch/gedcomx-viewer@master/graph/images/" + imageFile + "' class='gender-image'>";
    let gxPerson = personNode.person;
    html += addNameSpans(gxPerson);
    if (shouldDisplayIds) {
      html += addIdDiv(gxPerson);
    }
    if (shouldDisplayDetails) {
      html += addFactDivs(personNode);
    }
    html += addRelativeDivs(personNode);
    if (isTreeGraph()) {
      let personId = personNode.personId;
      let personAnalysis = personAnalysisMap.get(personId);
      if (personAnalysis) {
        if (personAnalysis.hasMoreParents) {
          html += addIndicator("right", "P", false);
        }
        if (hasVisibleRelatives(parentIdsMap, personId)) {
          html += addIndicator("right", "P", true);
        }
        if (personAnalysis.hasMoreChildren) {
          html += addIndicator("left", "C", false);
        }
        if (hasVisibleRelatives(childIdsMap, personId)) {
          html += addIndicator("left", "C", true);
        }
        if (personAnalysis.hasMoreSpouses) {
          if (personNode.getGenderCode() === GENDER_CODE_FEMALE) {
            html += addIndicator("top", "S", false);
          }
          else {
            html += addIndicator("bottom", "S", false);
          }
        }
        else if (hasVisibleRelatives(spouseIdsMap, personId)) {
          if (personNode.getGenderCode() === GENDER_CODE_FEMALE) {
            html += addIndicator("top", "S", true);
          }
          else {
            html += addIndicator("bottom", "S", true);
          }
        }
      }
    }
    html += "</div>";
    return $.parseHTML(html);
  }

  // PersonBox constructor ==========================================
  this.debugName = personNode.name;
  this.relChart = relChart; // for access to settings like personBorder.
  this.personNode = personNode; // PersonNode that corresponds to this PersonBox
  this.above = personAbove; // PersonBox of the person above in the global list of person boxes (not necessarily the same generation)
  this.below = personBelow; // PersonBox of person below in the global list.
  this.genAbove = null; // PersonBox of person above in the same generation
  this.genBelow = null; // PersonBox of person below in the same generation
  this.generationIndex = generationIndex;
  this.generation = null;
  this.subtree = null; // 0-based integer indicating which subtree of related persons this PersonBox is part of.
  this.order    = 0; // Global order of this PersonBox in the chart
  this.genOrder = 0; // Order of this PersonBox within its generation

  // List of FamilyLine objects for this person's parents (i.e., families in which this person is a child)
  this.parentLines = [];
  // List of FamilyLine objects for this person's spouses and children (i.e., families in which this person is a spouse or parent)
  this.spouseLines = [];

  // The personBoxId is used to identify each PersonBox. The personId is not used alone because a person can sometimes appear more than once in a chart
  //   if they are related more than one way.
  this.personBoxId = this.getPersonBoxId(personNode.personId, this.relChart.chartId);

  // If this PersonBox is not the first appearance of this PersonNode in the chart (e.g., due to being related multiple ways),
  //  then note what PersonBox it is a duplicate of, and modify its personBoxId with "_dup<number>"
  this.duplicateOf = relChart.personBoxMap[this.personBoxId];
  if (this.duplicateOf) {
    let dupCount = relChart.personDupCount[personNode.personId];
    dupCount = (dupCount ? dupCount : 0) + 1;
    relChart.personDupCount[personNode.personId] = dupCount;
    this.personBoxId += "_dup" + dupCount;
  }
  relChart.personBoxMap[this.personBoxId] = this;
  let boxIds = relChart.personIdPersonBoxesMap[personNode.personId];
  if (boxIds) {
    boxIds.push(this.personBoxId);
  }
  else {
    relChart.personIdPersonBoxesMap[personNode.personId] = [this.personBoxId];
  }

  let shouldDisplayDetails = relChart.shouldDisplayDetails || relChart.detailedPersonIds.has(this.personNode.personId);
  let personDiv = makePersonDiv(personNode, this.personBoxId, this.duplicateOf, relChart.shouldDisplayIds, shouldDisplayDetails);
  relChart.$personsDiv.append(personDiv);
  this.$personDiv = $("#" + this.personBoxId);
  // $("#" + getGenderDivId(this.personBoxId)).click(function(e){
  //   alert("Change gender!");
  //   stopPropagation(e);
  // });
  this.$personDiv.outerWidth(relChart.generationWidth);
  this.height = this.$personDiv.outerHeight();
  this.width = this.$personDiv.outerWidth();

  this.top    = 0; // Pixel-level information
  this.center = this.height / 2; // Initially just top + height/2.
  // (the "left" coordinate of all PersonBoxes in a Generation are in Generation.left).

  this.prevHeight = this.height;
  this.prevTop = this.top;
  this.prevCenter = this.center;
  this.prevLeft = null; // A PersonBox derives its left from its Generation. But if a PersonBox is dragged, we remember where it got dropped so animation looks good.

  if (relChart.isEditable) {
    let personBox = this;
    this.$childPlus = relChart.makeControl(`${this.personBoxId}-personChildPlus`, "relPlus personChildPlus");
    this.$spousePlus = relChart.makeControl(`${this.personBoxId}-personSpousePlus`, "relPlus personSpousePlus");
    this.$parentPlus = relChart.makeControl(`${this.personBoxId}-personParentPlus`, "relPlus personParentPlus");

    // Allow a person box to be able to receive a drag & drop event.
    this.$personDiv.droppable({
      hoverClass: "personDropHover",
      scope: "personDropScope",
      drop: function(e, ui) {
        personBox.personDrop(e, ui);
      }
    });
    this.$personDiv.draggable({revert: true, scope: "personDropScope", zIndex: 2, opacity: 0.5});
  }
  if (relChart.isEditable || relChart.isSelectable) {
    let personBox = this;
    this.$personDiv.click(function(e) {
      if (e.shiftKey && (e.ctrlKey || e.metaKey)) {
        // Open person ID in Family Tree on shift-cmd/ctrl-click
        let familyTreePersonUrl = "https://familysearch.org/ark:/61903/4:1:" + personBox.personNode.personId;
        window.open(familyTreePersonUrl, "_blank");
      }
      else {
        personBox.clickPerson(e);
      }
    });
  }
}
