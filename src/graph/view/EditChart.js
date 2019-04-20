/*
  This file contains the methods needed to make changes to the RelationshipChart and the underlying RelationshipGraph and GedcomX.
  It contains 'prototype' methods for various other classes, but these are gathered here to keep the edit logic separate from the
  rest of the code, and to make it easier to see it all together.
 */

// EDIT CONTROLS ==============================
RelationshipChart.prototype.addEditControls = function() {
  // Edit controls
  this.$editControlsDiv = $("#editControls");
  this.$fatherX = this.makeControl("fatherX", "relX");
  this.$motherX = this.makeControl("motherX", "relX");
  this.$fatherPlus = this.makeControl("fatherPlus", RelationshipChart.prototype.REL_PLUS);
  this.$motherPlus = this.makeControl("motherPlus", RelationshipChart.prototype.REL_PLUS);
  this.$personParentPlus = this.makeControl("personParentPlus", RelationshipChart.prototype.REL_PLUS);
  this.$personSpousePlus = this.makeControl("personSpousePlus", RelationshipChart.prototype.REL_PLUS);
  this.$personChildPlus = this.makeControl("personChildPlus", RelationshipChart.prototype.REL_PLUS);
  this.editControlSize = this.$personChildPlus.width();
};
RelationshipChart.prototype.hideFamilyControls = function() {
  this.$fatherX.hide();
  this.$motherX.hide();
  this.$fatherPlus.hide();
  this.$motherPlus.hide();
  if (this.selectedFamilyLine && !isEmpty(this.selectedFamilyLine.$childrenX)) {
    for (var c = 0; c < this.selectedFamilyLine.$childrenX.length; c++) {
      this.selectedFamilyLine.$childrenX[c].hide();
    }
  }
};

RelationshipChart.prototype.hidePersonControls = function() {
  this.$personParentPlus.hide();
  this.$personSpousePlus.hide();
  this.$personChildPlus.hide();
};

RelationshipChart.prototype.positionFamilyControl = function($control, x, y) {
  $control.css({left: x, top: y});
  $control.show();
};

RelationshipChart.prototype.REL_PLUS = "relPlus";

/**
 * Create a '+' or 'x' control div for relationships.
 * @param divId - ID to use for the div.
 * @param imgClass - class to assign to the div ("relX" or "relPlus").
 * @returns {jQuery.fn.init|jQuery|HTMLElement}
 */
RelationshipChart.prototype.makeControl = function(divId, imgClass) {
  var html = '<div id="' + divId + '" class="' + imgClass + '"></div>';
  var controlDiv = $.parseHTML(html);
  this.$editControlsDiv.append(controlDiv);
  var $control = $("#" + divId);
  $control.hide();
  $control.draggable({revert: true, scope : "personDropScope"});
  var relChart = this; // todo: Is this needed? Or can we use "this" in the method?
  $control.click(function(event) {
    event.stopPropagation();
    if (divId === "fatherX") {
      relChart.selectedFamilyLine.removeFather();
      updateRecord(relChart.relGraph.gx);
    }
    else if (divId === "motherX") {
      relChart.selectedFamilyLine.removeMother();
      updateRecord(relChart.relGraph.gx);
    }
    else {
      console.log("Click!");
    }
  });
  return $control;
};

PersonBox.prototype.personDrop = function(e, relChart) {
  var droppedPersonBox = relChart.personBoxMap[e.target.id];
  var plus = e.originalEvent.target.id;
  if (plus === "motherPlus" || plus === "fatherPlus" || plus === "fatherX" || plus === "motherX" || plus === "childX") {
    switch (plus) {
      case "motherPlus":
      case "motherX":
        relChart.selectedFamilyLine.changeMother(droppedPersonBox);
        break;
      case "fatherPlus":
      case "fatherX":
        relChart.selectedFamilyLine.changeFather(droppedPersonBox);
        break;
    }
  }
  else {
    var sourcePersonBox = relChart.selectedPersonBox;
    var sourcePersonId = sourcePersonBox.personNode.personId;
    var droppedPersonId = droppedPersonBox.personNode.personId;
    var doc = relChart.relGraph.gx;
    switch (plus) {
      case "personParentPlus":
        relChart.ensureRelationship(GX_PARENT_CHILD, droppedPersonId, sourcePersonId);
        break;
      case "personChildPlus":
        relChart.ensureRelationship(GX_PARENT_CHILD, sourcePersonId, droppedPersonId);
        break;
      case "personSpousePlus":
        var sourcePersonNode = sourcePersonBox.personNode;
        var droppedPersonNode = droppedPersonBox.personNode;
        if (wrongGender(sourcePersonNode, droppedPersonNode)) {
          relChart.ensureRelationship(GX_COUPLE, droppedPersonId, sourcePersonId);
        }
        else {
          relChart.ensureRelationship(GX_COUPLE, sourcePersonId, droppedPersonId);
        }
        break;
      default:
        return; // Don't update the record, because nothing happened.
    }
  }
  updateRecord(relChart.relGraph.gx);
};

// SELECTION ==================================

PersonBox.prototype.togglePerson = function(event, relChart) {
  relChart.clearSelectedFamilyLine();
  var personBox = relChart.personBoxMap[this.personBoxId];
  if (relChart.selectedPersonBox === this) {
    if (personBox) {
      personBox.$personDiv.removeAttr("chosen");
    }
    relChart.hidePersonControls();
    relChart.selectedPersonBox = null;
  }
  else {
    if (relChart.selectedPersonBox) {
      relChart.selectedPersonBox.togglePerson(null, relChart);
    }
    personBox.$personDiv.attr("chosen", "uh-huh");
    relChart.selectedPersonBox = this;

    // Set the '+' controls: child at center of left side; parent at center of right side;
    //    and spouse in center of top (if female or unknown) or bottom (if male).
    var d = relChart.editControlSize / 2;
    var centerX = (personBox.getLeft() + personBox.getRight()) / 2;
    relChart.positionFamilyControl(relChart.$personChildPlus, personBox.getLeft() - d, personBox.getCenter() - d);
    relChart.positionFamilyControl(relChart.$personParentPlus, personBox.getRight() - d, personBox.getCenter() - d);
    relChart.positionFamilyControl(relChart.$personSpousePlus, centerX - d, personBox.personNode.gender === 'F' ? personBox.getTop() - d : personBox.getBottom() - d);
  }

  // Prevent parent divs from getting the event, since that would immediately clear the selection.
  if (event) {
    event.stopPropagation();
  }
};

// Toggle whether the given familyId is selected.
FamilyLine.prototype.toggleFamilyLine = function(event) {
  this.relChart.clearSelectedPerson();
  var familyLine = this;
  var relChart = this.relChart;
  if (relChart.selectedFamilyLine === this) {
    // Deselect family line.
    // if (familyLine) { // might be undefined if this family line got removed after deleting the last child or spouse.
      familyLine.$familyLineDiv.removeAttr("chosen");
    // }
    relChart.hideFamilyControls();
    relChart.selectedFamilyLine = null;
  }
  else {
    if (relChart.selectedFamilyLine) {
      // Deselect currently selected family line
      relChart.selectedFamilyLine.toggleFamilyLine();
    }
    familyLine.$familyLineDiv.attr("chosen", "yep");
    relChart.selectedFamilyLine = familyLine;
    // Set the + or x controls at the top and bottom of the family line.
    var x = familyLine.x + familyLine.lineThickness;
    var d = relChart.editControlSize / 2;
    relChart.positionFamilyControl(familyLine.father ? relChart.$fatherX : relChart.$fatherPlus, x, familyLine.getTop() + 1 - d);
    relChart.positionFamilyControl(familyLine.mother ? relChart.$motherX : relChart.$motherPlus, x, familyLine.getBottom() - d + familyLine.lineThickness);

    if (!isEmpty(familyLine.$childrenX)) {
      for (var c = 0; c < familyLine.$childrenX.length; c++) {
        familyLine.$childrenX[c].show();
      }
    }
  }
  // Prevent parent divs from getting the event, since that would immediately clear the selection.
  if (event) {
    event.stopPropagation();
  }
};

RelationshipChart.prototype.clearSelectedPerson = function() {
  if (this.selectedPersonBox) {
    this.selectedPersonBox.togglePerson(null, this);
  }
};

RelationshipChart.prototype.clearSelectedFamilyLine = function() {
  if (this.selectedFamilyLine) {
    this.selectedFamilyLine.toggleFamilyLine();
  }
};

RelationshipChart.prototype.clearSelections = function() {
  this.clearSelectedPerson();
  this.clearSelectedFamilyLine();
};


// GRAPH UPDATING =============================
/**
 * Delete the JQuery object at the given index in the array (removing it from the DOM), and remove that element from the array.
 * @param $divs - Array of JQuery objects for divs.
 * @param index - Index in the array of the div to delete.
 */
function removeDiv($divs, index) {
  // Remove the DIV from the DOM
  $divs[index].remove();
  // Remove the object from the given array, too.
  $divs.splice(index, 1);
}

FamilyLine.prototype.getGedcomX = function() {
  return this.relChart.relGraph.gx;
};

/**
 * Remove a parent from this FamilyLine, updating the underlying GedcomX.
 * @param parentNode - father or mother in the FamilyLine.
 * @param spouseNode - mother or father in the FamilyLine (or null or undefined if there isn't one).
 * @param parentRels - fatherRels or motherRels for the family.
 */
FamilyLine.prototype.removeParent = function(parentNode, spouseNode, parentRels) {
  var doc = this.getGedcomX();
  var familyNode = this.familyNode;
  if (spouseNode) {
    // Remove couple relationship between father and mother.
    var index = doc.relationships.indexOf(familyNode.coupleRel);
    doc.relationships.splice(index, 1);
  }
  // Remove this family from the parentNode's list of spouseFamilies so it won't get in the way when we look for remaining spouseFamilies with the same child.
  var s;
  for (s = 0; s < parentNode.spouseFamilies.length; s++) {
    if (parentNode.spouseFamilies[s] === familyNode) {
      parentNode.spouseFamilies.splice(s, 1);
      break;
    }
  }
  // Remove parent-child relationships between this parent and each child in the family,
  //  UNLESS there's another family with this parent in it (i.e., with another spouse)
  //  that has this same child, in which case that relationship is kept.
  if (familyNode.children) {
    for (var c = 0; c < familyNode.children.length; c++) {
      var childId = familyNode.children[c].personId;
      var foundParentWithOtherSpouse = false;
      for (s = 0; s < parentNode.spouseFamilies.length && !foundParentWithOtherSpouse; s++) {
        var otherSpouseFamily = parentNode.spouseFamilies[s];
        if (otherSpouseFamily.children) {
          for (var c2 = 0; c2 < otherSpouseFamily.children.length; c2++) {
            if (otherSpouseFamily.children[c2].personId === childId) {
              foundParentWithOtherSpouse = true;
              break;
            }
          }
        }
      }
      if (!foundParentWithOtherSpouse) {
        // The only family in which child c is a child of this father is the one in which the father is being removed.
        // So remove the parent-child relationship from this father to this child.
        removeFromArray(parentRels[c], doc.relationships);
      }
    }
  }
};

FamilyLine.prototype.updateParents = function(fatherBox, motherBox) {
  this.father = fatherBox;
  this.mother = motherBox;
  if (fatherBox || motherBox) {
    var newFamilyId = makeFamilyId(fatherBox ? fatherBox.personNode : null, motherBox ? motherBox.personNode : null);
    if (!this.relChart.familyLineMap[newFamilyId]) {
      // We're creating a new family line out of this one. So update this one so that the new chart will re-use its position.
      this.familyId = newFamilyId;
      this.relChart.familyLineMap[newFamilyId] = this;
    }
  }
};

// Remove the father from this family, updating the underlying GedcomX
FamilyLine.prototype.removeFather = function() {
  this.removeParent(this.father.personNode, this.mother ? this.mother.personNode : null, this.familyNode.fatherRels);
  this.updateParents(null, this.mother);
};

// Remove the mother from this family, updating the underlying GedcomX
FamilyLine.prototype.removeMother = function() {
  this.removeParent(this.mother.personNode, this.father ? this.father.personNode : null, this.familyNode.motherRels);
  this.updateParents(this.father, null);
};

// Remove the given child from the family. Delete the parent-child relationships from the GedcomX. Call updateRecord.
FamilyLine.prototype.removeChild = function(childBox) {
  var doc = this.getGedcomX();
  var childIndex = this.children.indexOf(childBox);
  var familyNode = this.familyNode;
  var fatherRel = !isEmpty(familyNode.fatherRels) ? familyNode.fatherRels[childIndex] : null;
  var motherRel = !isEmpty(familyNode.motherRels) ? familyNode.motherRels[childIndex] : null;

  // These updates fix up the relationship graph, which is unnecessary if we're going to rebuild it from scratch.
  familyNode.children.splice(childIndex, 1);
  familyNode.fatherRels.splice(childIndex, 1);
  familyNode.motherRels.splice(childIndex, 1);
  removeDiv(this.$childrenLineDivs, childIndex);
  removeDiv(this.$childrenLineDots, childIndex);
  removeDiv(this.$childrenX, childIndex);
  childBox.removeParentFamilyLine(this);

  // Remove the relationships from the GedcomX.
  for (var r = 0; r < doc.relationships.length; r++) {
    var parentChildRelationship = doc.relationships[r];
    if (parentChildRelationship === fatherRel || parentChildRelationship === motherRel) {
      // Remove this relationship from the array.
      doc.relationships.splice(r, 1);
      r--; // Make sure the next element gets examined since we just shifted the later ones down one.
      // Eventually: Add the relationship to an undo/redo log.
    }
  }

  if (RelChartBuilder.prototype.familyHasOnlyOnePerson(familyNode)) {
    // Removed last child, and only one parent, so family line should go away.
    this.relChart.removeFamily(this);
  }
};

// Set the person in the given motherBox to be the mother of this family, updating the underlying GedcomX as needed. Update record.
FamilyLine.prototype.changeMother = function(motherBox) {
  if (this.mother) {
    // Remove the existing mother from the family, if any.
    this.removeMother();
  }
  var fatherNode = this.father ? this.father.personNode : null;
  var fatherId = fatherNode ? fatherNode.personId : null;
  var motherId = motherBox.personNode.personId;
  var familyId = makeFamilyId(fatherNode, motherBox.personNode);
  // See if there's already a family with this couple. If so, merge this family with that one.
  var existingFamilyLine = this.relChart.familyLineMap[familyId];
  if (!existingFamilyLine) {
    // Create the missing couple relationship between the father and mother.
    this.relChart.ensureRelationship(GX_COUPLE, fatherId, motherId);
    // Change the family ID of this FamilyLine so that the new chart will use its position.
    this.familyId = familyId;
    this.mother = motherBox;
    this.relChart.familyLineMap[familyId] = this;
  }
  // Create any missing parent-child relationships between the mother and each child.
  this.relChart.ensureRelationships(GX_PARENT_CHILD, motherId, this.children);
};

// Set the person in the given fatherBox to be the father of this family, updating the underlying GedcomX as needed. Update record.
FamilyLine.prototype.changeFather = function(fatherBox) {
  if (this.father) {
    // Remove the existing mother from the family, if any.
    this.removeFather();
  }
  var motherNode = this.mother ? this.mother.personNode : null;
  var motherId = motherNode ? motherNode.personId : null;
  var fatherId = fatherBox.personNode.personId;
  var familyId = makeFamilyId(fatherBox.personNode, motherNode);
  // See if there's already a family with this couple. If so, merge this family with that one.
  var existingFamilyLine = this.relChart.familyLineMap[familyId];
  if (!existingFamilyLine) {
    // Create the missing couple relationship between the father and mother.
    this.relChart.ensureRelationship(GX_COUPLE, fatherId, motherId);
    // Change the family ID of this FamilyLine so that the new chart will use its position.
    this.familyId = familyId;
    this.father = fatherBox;
    this.relChart.familyLineMap[familyId] = this;
  }
  // Create any missing parent-child relationships between the mother and each child.
  this.relChart.ensureRelationships(GX_PARENT_CHILD, fatherId, this.children);
};

/**
 * Add a relationship of the given type between the two given persons to the given GedcomX document.
 * @param relType - Relationship type (GX_PARENT_CHILD or GX_COUPLE)
 * @param personId1 - JEncoded person ID of the first person.
 * @param personId2 - JEncoded person ID of the second person.
 */
RelationshipChart.prototype.addRelationship = function(relType, personId1, personId2) {
  var doc = this.relGraph.gx;
  if (!doc.relationships) {
    doc.relationships = [];
  }
  var relationship = {};
  var prefix = (relType === GX_PARENT_CHILD ? "r-pc" : (relType === GX_COUPLE ? "r-c" : "r-" + relType));
  relationship.id = prefix + "-" + personId1 + "-" + personId2;
  relationship.type = relType;
  relationship.person1 = {resource :"#" + personId1, resourceId : personId1};
  relationship.person2 = {resource : "#" + personId2, resourceId : personId2};
  doc.relationships.push(relationship);
};


RelationshipChart.prototype.sameId = function(personRef1, personId2) {
  if (personRef1 && personId2) {
    var personId1 = getPersonIdFromReference(personRef1);
    return personId1 === personId2;
  }
};

/**
 * Make sure the given relationship type exists between the two person IDs in the given GedcomX document.
 * If not, then add it.
 * @param relType - Relationship type (GX_PARENT_CHILD or GX_COUPLE)
 * @param personId1 - JEncoded person ID of the first person.
 * @param personId2 - JEncoded person ID of the second person.
 */
RelationshipChart.prototype.ensureRelationship = function(relType, personId1, personId2) {
  var doc = this.relGraph.gx;
  if (personId1 && personId2) {
    if (doc.relationships) {
      for (var r = 0; r < doc.relationships.length; r++) {
        var rel = doc.relationships[r];
        if (rel.type === relType && this.sameId(rel.person1, personId1) && this.sameId(rel.person2, personId2)) {
          return; // Relationship already exists.
        }
      }
    }
    this.addRelationship(relType, personId1, personId2);
  }
};

/**
 * Ensure that the given relationship type exists between the first person ID and the person ID of all of the PersonNodes in the person2Nodes array.
 * @param relType - Relationship type (GX_PARENT_CHILD or GX_COUPLE)
 * @param person1Id - Person ID for person1 in each relationship.
 * @param person2Nodes - Array of PersonNode from which to get the personId for checking each relationship.
 */
RelationshipChart.prototype.ensureRelationships = function(relType, person1Id, person2Nodes) {
  if (person2Nodes) {
    for (var c = 0; c < person2Nodes.length; c++) {
      var person2Id = person2Nodes[c].personNode.personId;
      this.ensureRelationship(relType, person1Id, person2Id);
    }
  }
};

// Remove a FamilyLine from the chart, along with its corresponding FamilyNode and HTML elements.
RelationshipChart.prototype.removeFamily = function(familyLine) {
  familyLine.$familyLineDiv.remove();
  if (familyLine.$fatherLineDiv) {
    familyLine.$fatherLineDiv.remove();
  }
  if (familyLine.$motherLineDiv) {
    familyLine.$motherLineDiv.remove();
  }
  this.familyLines.splice(this.familyLines.indexOf(familyLine), 1);

  var familyNode = familyLine.familyNode;
  delete this.familyLineMap[familyNode.familyId];
  this.relGraph.removeFamilyNode(familyNode);
};