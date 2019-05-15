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
  this.editControlSize = this.$fatherPlus.width();
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

RelationshipChart.prototype.positionFamilyControl = function($control, x, y) {
  $control.css({left: x, top: y});
  $control.show();
};

RelationshipChart.prototype.REL_PLUS = "relPlus";

/**
 * Create a '+' or 'x' control div for relationships.
 * @param divId - ID to use for the div.
 * @param imgClass - class to assign to the div ("relX" or "relPlus").
 * @param $containerDiv - JQuery object of a DIV in which to add the new DIV as a child.
 * @returns {jQuery.fn.init|jQuery|HTMLElement}
 */
RelationshipChart.prototype.makeControl = function(divId, imgClass, $containerDiv) {
  if (!$containerDiv) {
    $containerDiv = this.$editControlsDiv;
  }
  var html = '<div id="' + divId + '" class="' + imgClass + '"></div>';
  var controlDiv = $.parseHTML(html);
  $containerDiv.append(controlDiv);
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

// DRAG AND DROP ==========================

/**
 * Parse a child 'x' control's div ID, and return an object with {familyId, childIndex}.
 * @param childXId - Child 'x' div ID, like "childX-parent1Id-parent2Id-c3".
 * @return object with familyId and childIndex, like {familyId: "parent1Id-parent2Id", childIndex: "3"}
 */
PersonBox.prototype.parseChildXId = function(childXId) {
  var parts = childXId.match(/childX-(.*)-c([0-9]*)/);
  return {familyId: parts[1], childIndex: parts[2]};
};

/**
 * Handle an event in which a control ('+' or 'x') was dropped on this PersonBox.
 * @param e - Event. Has the div id of the dropped control in e.originalEvent.target.id
 */
PersonBox.prototype.personDrop = function(e) {
  var droppedPersonBox = this; // = relChart.personBoxMap[e.target.id];
  var plus = e.originalEvent.target.id.replace(/.*-/, ""); // The div ID of the plus (or 'x') that was dropped on this person.
  if (plus.startsWith("childX")) {
    var oldFamilyIdInfo = this.parseChildXId(plus);
    this.relChart.selectedFamilyLine.changeChildParent(oldFamilyIdInfo.childIndex, droppedPersonBox);
  }
  else if (plus === "motherPlus" || plus === "fatherPlus" || plus === "fatherX" || plus === "motherX") {
    switch (plus) {
      case "motherPlus":
      case "motherX":
        this.relChart.selectedFamilyLine.changeMother(droppedPersonBox);
        break;
      case "fatherPlus":
      case "fatherX":
        this.relChart.selectedFamilyLine.changeFather(droppedPersonBox);
        break;
    }
  }
  else {
    var draggedPersonBoxId = e.originalEvent.target.id.replace(/-.*/, "");
    for (var s = 0; s < this.relChart.selectedPersonBoxes.length; s++) {
      var sourcePersonBox = this.relChart.selectedPersonBoxes[s];
      var sourcePersonId = sourcePersonBox.personNode.personId;
      var droppedPersonId = droppedPersonBox.personNode.personId;
      switch (plus) {
        case "personParentPlus":
          // Add all selected persons as children of the parent dropped on.
          this.relChart.ensureRelationship(GX_PARENT_CHILD, droppedPersonId, sourcePersonId);
          break;
        case "personChildPlus":
          // Don't make all selected persons be parents of the child dropped on--that would be unlikely to make sense.
          // Instead, ignore who is selected and only pay attention to whose child '+' was dragged.
          if (sourcePersonBox.personBoxId === draggedPersonBoxId) {
            this.relChart.ensureRelationship(GX_PARENT_CHILD, sourcePersonId, droppedPersonId);
          }
          break;
        case "personSpousePlus":
          // Don't make all selected persons be spouses of the person dropped on--that would be unlikely to make sense.
          // Instead, ignore who is selected and only pay attention to whose spouse '+' was dragged.
          if (sourcePersonBox.personBoxId === draggedPersonBoxId) {
            var sourcePersonNode = sourcePersonBox.personNode;
            var droppedPersonNode = droppedPersonBox.personNode;
            if (wrongGender(sourcePersonNode, droppedPersonNode)) {
              this.relChart.ensureRelationship(GX_COUPLE, droppedPersonId, sourcePersonId);
            }
            else {
              this.relChart.ensureRelationship(GX_COUPLE, sourcePersonId, droppedPersonId);
            }
          }
          break;
        default:
          return; // Don't update the record, because nothing happened.
      }
    }
  }
  updateRecord(this.relChart.relGraph.gx);
};

/**
 * Handle a control ('+' or 'x') being dropped onto a family line.
 *   If a person's "parent plus" is dropped, then add them as a child to the family.
 *   If a family line's "child x" is dropped, then remove them from that family and add them as a child to this one.
 *   If a person's "spouse plus" OR "child plus" is dropped on a family then put them in as the father or mother
 *     (according to their gender).
 * @param e - Drop event. The dropped element's id is in e.originalEvent.target.id
 */
FamilyLine.prototype.familyDrop = function(e) {
  var plus = e.originalEvent.target.id.replace(/.*-/, "");
  var sourcePersonId;
  if (plus === "personSpousePlus" || plus === "personChildPlus") {
    // A person's spouse or child "plus" has been dropped on this family line,
    // so we're saying "this person is the parent or spouse in this family".
    // So add or replace the appropriate parent (based on gender).
    if (this.relChart.selectedPersonBoxes.length === 1) { // If multiple persons selected, avoid ambiguity by doing nothing.
      var personBox = this.relChart.selectedPersonBoxes[0];
      if (personBox.personNode.gender === "M") {//!this.father) {
        this.changeFather(personBox);
      }
      else if (personBox.personNode.gender === "F") {//!this.mother) {
        this.changeMother(personBox);
      }
    }
    else {
      return;
    } // no need to update.
  }
  else {
    if (plus === "personParentPlus") {
      for (var s = 0; s < this.relChart.selectedPersonBoxes.length; s++) {
        sourcePersonId = this.relChart.selectedPersonBoxes[s].personNode.personId;
        if (this.father) {
          this.relChart.ensureRelationship(GX_PARENT_CHILD, this.father.personNode.personId, sourcePersonId);
        }
        if (this.mother) {
          this.relChart.ensureRelationship(GX_PARENT_CHILD, this.mother.personNode.personId, sourcePersonId);
        }
      }
    }
    else {
      var oldFamilyIdInfo = PersonBox.prototype.parseChildXId(e.originalEvent.target.id);
      var oldFamilyId = oldFamilyIdInfo.familyId;
      if (oldFamilyId === this.familyId) {
        return; // Dropped '+' on same family the child was already in, so do nothing.
      }
      var oldFamilyLine = this.relChart.familyLineMap[oldFamilyId];
      var childBox = oldFamilyLine.children[oldFamilyIdInfo.childIndex];
      oldFamilyLine.removeChild(childBox);
      sourcePersonId = childBox.personNode.personId;
      if (this.father) {
        this.relChart.ensureRelationship(GX_PARENT_CHILD, this.father.personNode.personId, sourcePersonId);
      }
      if (this.mother) {
        this.relChart.ensureRelationship(GX_PARENT_CHILD, this.mother.personNode.personId, sourcePersonId);
      }
    }
  }
  updateRecord(this.getGedcomX());
};

// DRAG PERSONS TO REORDER =====================================

/**
 * Move all persons in a given subtree to just above everyone in the 'below' subtree, in the gedcomx "persons" array.
 *   For example, if subtree=7 and belowSubtree=3, then everyone in subtree 7 will be inserted just before the first person in subtree 3.
 * Leave as many other people in the same order as possible.
 * @param movingSubtree - Index of subtree being moved.
 * @param belowSubtree - Index of the subtree that will end up below, above which the people are being inserted.
 */
RelationshipChart.prototype.moveSubtree = function(movingSubtree, belowSubtree) {
  var persons = this.relGraph.gx.persons;

  // 1. Get the index in the GedcomX persons[] array of the first person in the 'belowSubtree'.
  // 2. For persons after that who are in the 'movingSubtree', (a) remove them from the array, and then (b) insert them at the 'insertPos'.
  var insertPos = null;
  var movingPersons = [];

  for (var p = 0; p < persons.length; p++) {
    var person = persons[p];
    var personBoxId = PersonBox.prototype.getPersonBoxId(persons[p].id);
    var subtreeIndex = this.personBoxMap[personBoxId].subtree;
    if (insertPos === null && subtreeIndex === belowSubtree) {
      insertPos = p;
    }
    else if (subtreeIndex === movingSubtree) {
      movingPersons.push(person);
      persons.splice(p--, 1);
    }
  }
  if (insertPos === null) {
    insertPos = persons.length;
  }
  for (p = 0; p < movingPersons.length; p++) {
    persons.splice(insertPos++, 0, movingPersons[p]);
  }
};

/**
 * Tell whether one PersonBox is above the other one, in the same generation (and if they're both non-null).
 * @param aboveBox - PersonBox that may be above
 * @param belowBox - PersonBox that may be below
 * @return {boolean} true if both person boxes are non-null, are both in the same generation, and if 'aboveBox' is earlier in the genPersons array. false otherwise.
 */
RelationshipChart.prototype.aboveInGeneration = function(aboveBox, belowBox) {
  if (aboveBox && belowBox && aboveBox.generation === belowBox.generation) {
    var aboveGenIndex = aboveBox.generation.genPersons.indexOf(aboveBox);
    var belowGenIndex = belowBox.generation.genPersons.indexOf(belowBox);
    return aboveGenIndex < belowGenIndex;
  }
  return false;
};


/**
 * Find the FamilyLine in which both given PersonBox's appear as children.
 * @param childBox1 - PersonBox of first child to check.
 * @param childBox2 - PersonBox of second child to check.
 * @return FamilyLine that has both of these children PersonBoxes in it, or null if none in common.
 */
RelationshipChart.prototype.sameParentFamily = function(childBox1, childBox2) {
  for (var f = 0; f < childBox1.parentLines.length; f++) {
    if (childBox2.parentLines.includes(childBox1.parentLines[f])) {
      return childBox1.parentLines[f];
    }
  }
  return null;
};

/**
 * Move one element from where it is now to just above (in front of) the one specified (or at the end if null)
 * @param array - Array of elements to modify
 * @param aboveElement - Element to remove from the array and insert above (before) the other one.
 * @param belowElement - Element that will end up below when the 'above' element is inserted before it. (If null, move the 'above' element to the end).
 */
FamilyLine.prototype.moveAbove = function(array, aboveElement, belowElement) {
  if (array && aboveElement) {
    array.splice(array.indexOf(aboveElement), 1);
    var insertPosition = belowElement ? array.indexOf(belowElement) : array.length;
    array.splice(insertPosition, 0, aboveElement);
  }
};

/**
 * Move the 'above' child in the GedcomX so that it will appear above the 'below' child.
 * - Move the person earlier in the persons array.
 * - Move the parent-child relationships between the 'above' child and each of the parents in this family earlier in the relationships array.
 * @param above - PersonBox of the child that should be moved above the 'below' child.
 * @param below - PersonBox of the child that should end up below the 'above' child.
 */
FamilyLine.prototype.moveChildUp = function(above, below) {
  // Move 'above' just before 'below' in the person array.
  var gx = this.getGedcomX();
  this.moveAbove(gx.persons, above.personNode.person, below.personNode.person);

  // Move parent-child relationships for the 'above' child above those of the 'below' child.
  var aboveChildIndex = this.children.indexOf(above);
  var belowChildIndex = this.children.indexOf(below);
  this.moveAbove(gx.relationships, this.familyNode.fatherRels[aboveChildIndex], this.familyNode.fatherRels[belowChildIndex]);
  this.moveAbove(gx.relationships, this.familyNode.motherRels[aboveChildIndex], this.familyNode.motherRels[belowChildIndex]);
};

/**
 * Move one element from where it is now to just in below (after) the one specified (or at the beginning if null)
 * @param array - Array of elements to modify
 * @param aboveElement - Element to remove from the array and insert after the other one.
 * @param belowElement - Element after which the first element will be inserted. (If null, move it to the beginning).
 */
FamilyLine.prototype.moveBelow = function(array, aboveElement, belowElement) {
  if (array && belowElement) {
    array.splice(array.indexOf(aboveElement), 1);
    var insertPosition = belowElement ? array.indexOf(belowElement) + 1 : 0;
    array.splice(insertPosition, 0, aboveElement);
  }
};

/**
 * Move the 'below' child in the GedcomX so that it will appear just below the 'above' child.
 * - Move the person later in the persons array.
 * - Move the parent-child relationships between the 'below' child and each of the parents in this family later in the relationships array.
 * @param above - PersonBox of the child that should end up above the 'below' child.
 * @param below - PersonBox of the child that should be moved below the 'above' child.
 */
FamilyLine.prototype.moveChildDown = function(above, below) {
  // Move 'above' just before 'below' in the person array.
  var gx = this.getGedcomX();
  this.moveBelow(gx.persons, above.personNode.person, below.personNode.person);

  // Move parent-child relationships for the 'above' child above those of the 'below' child.
  var aboveChildIndex = this.children.indexOf(above);
  var belowChildIndex = this.children.indexOf(below);
  this.moveBelow(gx.relationships, this.familyNode.fatherRels[aboveChildIndex], this.familyNode.fatherRels[belowChildIndex]);
  this.moveBelow(gx.relationships, this.familyNode.motherRels[aboveChildIndex], this.familyNode.motherRels[belowChildIndex]);
};

/**
 * Get a sorted list of subtree indexes to move. If the dropped person is one of multiple selected persons, then get a sorted list
 *   of unique subtree indexes among any of the selected persons. Otherwise, just include the dropped person's subtree index.
 * The idea is to allow the user to multi-select persons, and then drag any of them above someone else in order to move them all above,
 *   while keeping the set of moved persons in the same order relative to each other.
 * @param selectedPersonBoxes - Array of selected PersonBoxes, if any.
 * @param droppedPersonBox - PersonBox that was drag & dropped on a drop zone.
 * @returns {Array} subtree indexes that should be moved.
 */
RelationshipChart.prototype.getSelectedSubtrees = function(selectedPersonBoxes, droppedPersonBox) {
  var selectedSubtrees = [];
  if (selectedPersonBoxes && selectedPersonBoxes.length > 1 && selectedPersonBoxes.includes(droppedPersonBox)) {
    for (var s = 0; s < selectedPersonBoxes.length; s++) {
      var subtree = selectedPersonBoxes[s].subtree;
      if (!selectedSubtrees.includes(subtree)) {
        selectedSubtrees.push(subtree);
      }
    }
  }
  else {
    selectedSubtrees.push(droppedPersonBox.subtree);
  }
  return selectedSubtrees;
};

/**
 * Handle a PersonBox being dropped on the gap between (or above or below) PersonBoxes in a generation.
 * - If person A in subtree 2 is dragged above person B in a higher subtree 1, then move everyone in subtree 2 above everyone in subtree 1.
 * - If person A in subtree 1 is dragged below person B in a lower subtree 2, then move everyone in subtree 1 below everyone in subtree 2.
 * - If person B is dragged above person A and they're both in the same subtree:
 *   - If A is a higher child than B in the same family, then move B above A and B's parent-child relationships in the same families above A's.
 *   - If A is an earlier spouse of the same PersonBox as B, then move B's couple relationship to that spouse earlier than A's.
 * - Else if person A is dragged below person B and they're both in the same subtree:
 *   - If A is a lower child than B in the same family, then move A below B and A's parent-child relationships in the same families below B's.
 *   - If A is a lower spouse of the same PersonBox as B, then move A's couple relationship to that spouse later than B's.
 * @param generationIndex - Index of which generation the dropped-on gap is in.
 * @param personIndex - Index of person within that generation above which the gap exists. (If below bottom person, personIndex = # persons in generation)
 * @param draggedPersonBox - PersonBox object that was dropped on the gap.
 * @param newTop - top (in pixels) of where the draggedPersonBox was dropped.
 * @param newLeft - left (in pixels) of where the draggedPersonBox was dropped.
 */
RelationshipChart.prototype.gapDrop = function(generationIndex, personIndex, draggedPersonBox, newTop, newLeft) {
  var generation = this.generations[generationIndex];
  var above = personIndex > 0 ? generation.genPersons[personIndex - 1] : null; // PersonBox above the dropped-on gap (if any)
  var below = personIndex < generation.genPersons.length ? generation.genPersons[personIndex] : null; // PersonBox below the dropped-on-gap
  var dropped = draggedPersonBox;
  var changed = false;
  var commonFamily = null;
  var selectedSubtrees; // Array of subtree indexes when moving people above/below subtrees.
  var s;

  if (below && dropped.subtree > below.subtree) {
    // If a person in subtree X is dragged above a person in subtree Y, move everyone in X just above the persons in Y.
    selectedSubtrees = this.getSelectedSubtrees(this.selectedPersonBoxes, dropped);
    for (s = 0; s < selectedSubtrees.length; s++) {
      this.moveSubtree(selectedSubtrees[s], below.subtree);
    }
    changed = true;
  }
  else if (above && dropped.subtree < above.subtree) {
    // If a person in subtree X is dragged below a person in subtree Y, move everyone in X between the persons in Y and Y + 1.
    selectedSubtrees = this.getSelectedSubtrees(this.selectedPersonBoxes, dropped);
    for (s = 0; s < selectedSubtrees.length; s++) {
      this.moveSubtree(selectedSubtrees[s], above.subtree + 1);
    }
    changed = true;
  }
  else if (this.aboveInGeneration(below, dropped) && (commonFamily = this.sameParentFamily(below, dropped)) !== null) {
    // The dropped person was dropped above someone who is in the same family but is currently above them.
    // So move 'dropped' above 'below'; and move their parent-child relationships above below's parent-child relationships to the same parents.
    commonFamily.moveChildUp(dropped, below);
    changed = true;
  }
  else if (this.aboveInGeneration(dropped, above) && (commonFamily = this.sameParentFamily(dropped, above)) !== null) {
    // The dropped person was dropped below someone who is in the same family but is currently above them.
    // So move 'dropped' below 'above'; and move their parent-child relationships below above's parent-child relationships to the same parents.
    commonFamily.moveChildDown(dropped, above);
    changed = true;
  }
  if (changed) {
    draggedPersonBox.move(newTop - draggedPersonBox.getTop());
    // A PersonBox normally derives its left coordinate from its Generation. However, when a PersonBox is dragged somewhere,
    //   it is natural to have it animate from wherever it was dropped to its new location, instead of jumping to its Generation.
    draggedPersonBox.prevLeft = newLeft;
    updateRecord(this.getGedcomX());
  }
};

/**
 * Create a "drop zone" above the given person index in the given generation (or below the last person
 *   if the person index is beyond the list of persons for that generation).
 * @param generationIndex - Index in relChart.generations[g] of the generation in which this drop zone exists.
 * @param personIndex - Index in relCharts.generations[g].genPersons[p] of the person above which this drop zone is placed.
 *                      (or below the last one, if beyond the length of genPersons).
 * @param top    - Pixel coordinates of the drop zone div.
 * @param left
 * @param width
 * @param height
 */
RelationshipChart.prototype.addGapDropZone = function(generationIndex, personIndex, top, left, width, height) {
  var divId = "gen-" + generationIndex + "-above-p-" + personIndex;
  var html = '<div id="' + divId + '" class="gapDrop"></div>';
  var controlDiv = $.parseHTML(html);
  this.$editControlsDiv.append(controlDiv);
  var relChart = this;
  var $control = $("#" + divId);
  $control.css({left: left, top: top, width: width, height: height});
  $control.droppable({
    hoverClass: "gapDropHover", scope: "wholePersonDropScope", "tolerance": "pointer", drop: function(e, ui) {
      var draggedPersonBoxId = e.originalEvent.target.id;
      if (!draggedPersonBoxId) {
        draggedPersonBoxId = ui.draggable.attr("id");
      }
      relChart.gapDrop(generationIndex, personIndex, relChart.personBoxMap[draggedPersonBoxId], ui.draggable.position().top, ui.draggable.position().left);
      e.stopPropagation();
    }
  });
};

/**
 * Add a "drop zone" div between persons in each generation (and above first and below last),
 *   in order to support drag & drop of person boxes for reordering of persons in the relationship graph.
 */
RelationshipChart.prototype.addGapDropZones = function() {
  for (var g = 0; g < this.generations.length; g++) {
    var generation = this.generations[g];
    var prevPersonBox = null;
    for (var p = 0; p < generation.genPersons.length; p++) {
      var personBox = generation.genPersons[p];
      var top = (p === 0) ? 0 : prevPersonBox.getBottom();
      var height = Math.max(10, personBox.getTop() - top);
      var left = personBox.getLeft();
      var width = this.generationWidth;
      this.addGapDropZone(g, p, top, left, width, height);
      prevPersonBox = personBox;
    }
    if (prevPersonBox) {
      this.addGapDropZone(g, p, prevPersonBox.getBottom(), prevPersonBox.getLeft(), this.generationWidth, 30);
    }
  }
};

// SELECTION ==================================

PersonBox.prototype.deselectPerson = function() {
  // Clicked on the only selected person, so deselect it.
  this.$personDiv.removeAttr("chosen");
  this.$parentPlus.hide();
  this.$spousePlus.hide();
  this.$childPlus.hide();
  removeFromArray(this, this.relChart.selectedPersonBoxes);
};

PersonBox.prototype.selectPerson = function() {
  this.$personDiv.attr("chosen", "uh-huh");
  this.relChart.selectedPersonBoxes.push(this);

  // Set the '+' controls: child at center of left side; parent at center of right side;
  //    and spouse in center of top (if female or unknown) or bottom (if male).
  var d = this.relChart.editControlSize / 2;
  var centerX = (this.getLeft() + this.getRight()) / 2;
  this.relChart.positionFamilyControl(this.$childPlus, this.getLeft() - d, this.getCenter() - d);
  this.relChart.positionFamilyControl(this.$parentPlus, this.getRight() - d, this.getCenter() - d);
  this.relChart.positionFamilyControl(this.$spousePlus, centerX - d, this.personNode.gender === 'F' ? this.getTop() - d : this.getBottom() - d);
  this.$personDiv.focus(); // avoid text getting selected accidentally.
};

PersonBox.prototype.isSelected = function() {
  return this.$personDiv[0].hasAttribute("chosen");
};

/**
 * Handle a click event on a person. Behavior is similar to click, shift-click (range) and cmd-click (multiselect) in Mac Finder lists.
 * - Click selects a person, unless that person is the only one already selected, in which case it deselects (toggles) it.
 * - Shift-click selects a "range" between the last-selected person and the shift-clicked one, within the same generation.
 * - Cmd/Meta/Ctrl-click
 * @param event
 */
PersonBox.prototype.clickPerson = function(event) {
  this.relChart.clearSelectedFamilyLine();
  var personBox = this;
  var selected = this.relChart.selectedPersonBoxes;

  if (selected.length === 1 && selected[0] === this) {
    // Clicked the only selected person, so whether or not shift or cmd/ctrl are used, deselect the person.
    this.deselectPerson();
  }
  else if (event.metaKey || event.ctrlKey) {
    // Person was clicked with Cmd or Control held down, so toggle that person's selection.
    if (this.isSelected()) {
      this.deselectPerson();
    }
    else {
      this.selectPerson();
    }
  }
  else if (event.shiftKey) {
    // Shift key is held down, so if the clicked person is in the same generation as the most recently-selected person,
    //   then select all of the people in that generation that are between them.
    // Otherwise, deselect everyone, and select just the newly-clicked person.
    if (selected.length > 0) {
      var lastSelected = selected[selected.length - 1];
      if (lastSelected.generation === this.generation) {
        // Shift-clicked on someone in same generation as the latest selected person, so select everyone between them.
        // (Don't select the last-selected one, because it's already selected; and don't select the clicked one,
        // because that will be done "last").
        var g;
        if (this.genOrder > lastSelected.genOrder) {
          for (g = lastSelected.genOrder + 1; g < this.genOrder; g++) {
            this.generation.genPersons[g].selectPerson();
          }
        }
        else {
          for (g = this.genOrder + 1; g < lastSelected.genOrder; g++) {
            this.generation.genPersons[g].selectPerson();
          }
        }
      }
      else {
        // Wrong generation, so deselect everyone who is selected before selecting the newly-clicked person.
        this.relChart.clearSelections();
      }
    }
    this.selectPerson();
  }
  else {
    this.relChart.clearSelections();
    this.selectPerson();
  }

  // Prevent parent divs from getting the event, since that would immediately clear the selection.
  if (event) {
    event.stopPropagation();
    // Prevent HTML text from being selected when doing a shift-click on persons.
    document.getSelection().removeAllRanges();
  }
};

// Toggle whether the given familyId is selected.
FamilyLine.prototype.toggleFamilyLine = function(event) {
  var relChart = this.relChart;
  relChart.clearSelectedPerson();
  var familyLine = this;
  if (relChart.selectedFamilyLine === this) {
    // Deselect family line.
    familyLine.$familyLineDiv.removeAttr("chosen");
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
  while (this.selectedPersonBoxes.length > 0) {
    this.selectedPersonBoxes[0].deselectPerson();
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

// Remove the given parentChildRel from the array of relationships unless there is still a parentFamily of this box's personNode that includes it.
PersonNode.prototype.removeParentChildRelationshipIfOnlyOne = function(isFather, parentChildRel, relationships) {
  if (parentChildRel) {
    var parentFamilies = this.parentFamilies;
    for (var p = 0; p < parentFamilies.length; p++) {
      var parentFamily = parentFamilies[p];
      var childIndex = parentFamily.children.indexOf(this);
      var parentRel = isFather ? parentFamily.fatherRels[childIndex] : parentFamily.motherRels[childIndex];
      if (parentRel === parentChildRel) {
        return; // There is still another parent family of this child that has this parent-child relationship.
      }
    }
    // Did not find any parent family of this person that still had the given parent-child relationship in it, so remove it from the GedcomX.
    var relIndex = relationships.indexOf(parentChildRel);
    relationships.splice(relIndex, 1);
  }
};

// Remove the given child from the family. Delete the parent-child relationships from the GedcomX (unless still needed for another parent family of this same child).
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
  removeFromArray(familyNode, childBox.personNode.parentFamilies);
  removeDiv(this.$childrenLineDivs, childIndex);
  removeDiv(this.$childrenLineDots, childIndex);
  removeDiv(this.$childrenX, childIndex);
  childBox.removeParentFamilyLine(this);

  // if this is the only family in which this child is a child of each parent, then remove that parent-child relationship.
  childBox.personNode.removeParentChildRelationshipIfOnlyOne(true, fatherRel, doc.relationships);
  childBox.personNode.removeParentChildRelationshipIfOnlyOne(false, motherRel, doc.relationships);

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

// Remove the given child from this family and add 'parentBox' as a parent of them.
FamilyLine.prototype.changeChildParent = function(childIndex, parentBox) {
  var childPersonId = this.children[childIndex].personNode.personId;
  var parentPersonId = parentBox.personNode.personId;
  this.removeChild(this.children[childIndex]);
  this.relChart.ensureRelationship(GX_PARENT_CHILD, parentPersonId, childPersonId);
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