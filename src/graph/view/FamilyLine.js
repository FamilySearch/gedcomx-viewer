
FamilyLine.prototype.makeFamilyLineDiv = function(familyId) {
  var html = "<div class='familyLine' id='" + familyId + "' onclick='toggleFamilyLine(\"" + familyId + "\", event)'>" +
      "  <div class='familyLineDropZone' id='" + familyId + "-drop'></div>" +
      "</div>";
  return $.parseHTML(html);
};

FamilyLine.prototype.makePersonLineDiv = function(personLineId) {
  var html = "<div class='personLine' id='" + personLineId + "'></div>";
  return $.parseHTML(html);
};

FamilyLine.prototype.addPersonLine = function(personLineId, left, top, width) {
  var html = "<div class='personLine' id='" + personLineId + "'></div>";
  var personLineDiv = $.parseHTML(html);
  this.$familyLinesDiv.append(personLineDiv);
  var $personLineDiv = $("#" + personLineId);
  $personLineDiv.css({"top": top - this.lineThickness / 2, "left": left, "width": width});
  return $personLineDiv;
};

FamilyLine.prototype.addPersonDot = function(personLineId, left, top, width) {
  var personDotId = "dot-" + personLineId;
  var html = "<div class='personDot' id='" + personDotId + "'></div>";
  var personDotDiv = $.parseHTML(html);
  this.$familyLinesDiv.append(personDotDiv);
  var $personLineDot = $("#" + personDotId);
  // Make sure 'dotHeight' and 'dotWidth' are set if this is the first child.
  if (!this.dotHeight) {
    // Get the dot size based on what graph.css said it should be.
    this.dotHeight = $personLineDot.height();
    this.dotWidth = $personLineDot.width();
  }
  $personLineDot.css({"top": top - this.dotHeight / 2, "left": left + width - this.dotWidth});
  return $personLineDot;
};

/**
 * Add a "delete" ("x") div for the given child line. Clicking that removes the child from the family
 *   by deleting the parent-child relationships between this child and both parents (unless that child
 *   has a relationship to another of one of the parents' spouses, too, in which case that parent's
 *   relationship is kept in order to keep them in that family).
 * @param childLineId - id used for the person line between the child and this family line.
 * @param childBox - PersonBox for the child.
 * @returns {jQuery.fn.init|jQuery|HTMLElement}
 */
FamilyLine.prototype.addChildX = function(childLineId, childBox) {
  var childXId = "childX-" + childLineId;
  var html = "<div class='relX' id='" + childXId + "'></div>";
  var childXDiv = $.parseHTML(html);
  this.$familyLinesDiv.append(childXDiv);
  var $childX = $("#" + childXId);
  // $childX.hide();
  if (!this.xSize) {
    // Get the image size based on what graph.css said it should be.
    this.xSize = $childX.height();
  }
  $childX.hide();
  var familyLine = this;
  $childX.click(function() {
    familyLine.removeChild(childBox);
    updateRecord(relChart.relGraph.gx);
  });
  return $childX;
};

// Width that is no smaller than 2.
FamilyLine.prototype.safeWidth = function(width) {
  return Math.max(width, 2);
};

// Add a PersonBox to the list of children for this FamilyLine, and create a div for the line connecting that child's PersonBox to the FamilyLine.
FamilyLine.prototype.addChild = function(childBox) {
  if (childBox) {
    this.children.push(childBox);
    this.prevChildCenter.push(childBox.center);
    var childLineId = this.familyNode.familyId + "-c" + this.children.length;
    var left = childBox.getRight();
    var width = this.safeWidth(this.x - left);
    this.$childrenLineDivs.push(this.addPersonLine(childLineId, left, childBox.center, width));
    this.$childrenLineDots.push(this.addPersonDot(childLineId, left, childBox.center, width));
    this.$childrenX.push(this.addChildX(childLineId, childBox))
  }
};


/**
 * Delete the JQuery object at the given index in the array, and return the array with that element removed.
 * @param $divs - Array of JQuery objects for divs.
 * @param index - Index in the array of the div to delete.
 */
function removeDiv($divs, index) {
  $divs[index].remove();
  $divs.splice(index, 1);
}

// GEDCOMX UPDATES ======================================================

/**
 * Remove a parent from this FamilyLine, updating the underlying GedcomX.
 * @param parentNode - father or mother in the FamilyLine.
 * @param spouseNode - mother or father in the FamilyLine (or null or undefined if there isn't one).
 * @param parentRels - fatherRels or motherRels for the family.
 */
FamilyLine.prototype.removeParent = function(parentNode, spouseNode, parentRels) {
  var doc = currentRelChart.relGraph.gx;
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
    if (!currentRelChart.familyLineMap[newFamilyId]) {
      // We're creating a new family line out of this one. So update this one so that the new chart will re-use its position.
      this.familyId = newFamilyId;
      currentRelChart.familyLineMap[newFamilyId] = this;
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
  var doc = currentRelChart.relGraph.gx;
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
    currentRelChart.removeFamily(this);
  }
};

// Set the person in the given motherBox to be the mother of this family, updating the underlying GedcomX as needed. Update record.
FamilyLine.prototype.changeMother = function(motherBox) {
  var doc = currentRelChart.relGraph.gx;
  if (this.mother) {
    // Remove the existing mother from the family, if any.
    this.removeMother();
  }
  if (!this.father) {
    throw "Expected there to be a father when adding mother to family.";
  }
  var fatherId = this.father ? this.father.personNode.personId : null;
  var motherId = motherBox.personNode.personId;
  var familyId = makeFamilyId(this.father.personNode, motherBox.personNode);
  // See if there's already a family with this couple. If so, merge this family with that one.
  var existingFamilyLine = currentRelChart.familyLineMap[familyId];
  if (!existingFamilyLine) {
    // Create the missing couple relationship between the father and mother.
    this.ensureRelationship(doc, GX_COUPLE, fatherId, motherId);
    // Change the family ID of this FamilyLine so that the new chart will use its position.
    this.familyId = familyId;
    this.mother = motherBox;
    currentRelChart.familyLineMap[familyId] = this;
  }
  // Create any missing parent-child relationships between the mother and each child.
  currentRelChart.ensureRelationships(doc, GX_PARENT_CHILD, motherId, this.children);
};

// Set the person in the given fatherBox to be the father of this family, updating the underlying GedcomX as needed. Update record.
FamilyLine.prototype.changeFather = function(fatherBox) {
  var doc = currentRelChart.relGraph.gx;
  if (this.father) {
    // Remove the existing mother from the family, if any.
    this.removeFather();
  }
  if (!this.mother) {
    throw "Expected there to be a mother when adding father to family.";
  }
  var motherId = this.mother ? this.mother.personNode.personId : null;
  var fatherId = fatherBox.personNode.personId;
  var familyId = makeFamilyId(fatherBox.personNode, this.mother.personNode);
  // See if there's already a family with this couple. If so, merge this family with that one.
  var existingFamilyLine = currentRelChart.familyLineMap[familyId];
  if (!existingFamilyLine) {
    // Create the missing couple relationship between the father and mother.
    this.ensureRelationship(doc, GX_COUPLE, fatherId, motherId);
    // Change the family ID of this FamilyLine so that the new chart will use its position.
    this.familyId = familyId;
    this.father = fatherBox;
    currentRelChart.familyLineMap[familyId] = this;
  }
  // Create any missing parent-child relationships between the mother and each child.
  currentRelChart.ensureRelationships(doc, GX_PARENT_CHILD, fatherId, this.children);
};


// ===== END OF GEDCOMX UPDATES =======


FamilyLine.prototype.setFather = function(fatherBox) {
  if (fatherBox) {
    this.father = fatherBox;
    var fatherLineId = this.familyNode.familyId + "-f";
    var width = this.safeWidth(fatherBox.getLeft() - this.x);
    this.$fatherLineDiv = this.addPersonLine(fatherLineId, fatherBox.getLeft(), fatherBox.center - this.lineThickness/2, width);
  }
};

FamilyLine.prototype.setMother = function(motherBox) {
  if (motherBox) {
    this.mother = motherBox;
    var motherLineId = this.familyNode.familyId + "-m";
    var width = this.safeWidth(motherBox.getLeft() - this.x);
    this.$motherLineDiv = this.addPersonLine(motherLineId, motherBox.getLeft(), motherBox.center - this.lineThickness/2, width);
  }
};

FamilyLine.prototype.childMoved = function() {
  var c, childBox;
  for (c = 0; c < this.children.length; c++) {
    childBox = this.children[c];
    if (childBox.center !== this.prevChildCenter[c]) {
      return true;
    }
  }
  return false;
};

FamilyLine.prototype.getBottom = function() {
  return this.bottomPerson.center;
};

FamilyLine.prototype.getTop = function() {
  return this.topPerson.center;
};

// Tell whether this FamilyLine has moved (i.e., x changed or top/bottom persons moved) since last update.
FamilyLine.prototype.hasMoved = function() {
  return (this.x !== this.prevX) || this.topPerson.center !== this.prevTop || this.bottomPerson.center !== this.prevBottom || this.childMoved();
};

// Use JQuery to move the HTML element (div) for the FamilyLine to the positions indicated
//  by the line's "x" and the top and bottom person's "center".
FamilyLine.prototype.setPosition = function() {
  var top = this.topPerson.center;
  var bottom = this.bottomPerson.center;
  var height = 1 + bottom - top;
  this.$familyLineDiv.animate({"left": this.x, "top": top, "height": height}, RelationshipChart.prototype.animationSpeed);
  this.$familyLineDrop.animate({"height": height}, RelationshipChart.prototype.animationSpeed);
  this.prevTop = top;
  this.prevBottom = bottom;
  this.prevX = this.x;
  var width;

  if (this.$fatherLineDiv) {
    width = this.safeWidth(this.father.getLeft() - this.x);
    this.$fatherLineDiv.animate({"left": this.x, "top": this.father.center, "width": width}, RelationshipChart.prototype.animationSpeed);
  }
  if (this.$motherLineDiv) {
    width = this.safeWidth(this.mother.getLeft() - this.x);
    this.$motherLineDiv.animate({"left": this.x, "top": this.mother.center, "width": width}, RelationshipChart.prototype.animationSpeed);
  }
  var c, childBox;
  for (c = 0; c < this.children.length; c++) {
    childBox = this.children[c];
    width = this.safeWidth(this.x - childBox.getRight() + this.lineThickness);
    this.$childrenLineDivs[c].animate({"left": childBox.getRight(), "top": childBox.center - this.lineThickness/2, "width": width}, RelationshipChart.prototype.animationSpeed);
    this.prevChildCenter[c] = childBox.center;
    this.$childrenLineDots[c].animate({"left": childBox.getRight() + width - this.dotWidth, "top": childBox.center - this.dotHeight/2}, RelationshipChart.prototype.animationSpeed);
    this.$childrenX[c].animate({"left": this.x - this.xSize, "top": childBox.center - this.xSize/2}, RelationshipChart.prototype.animationSpeed);
  }
};

FamilyLine.prototype.compare = function(a, b) {
  if (a.topPerson.center < b.topPerson.center) {
    return -1;
  }
  else if (a.topPerson.center > b.topPerson.center) {
    return 1;
  }
  else if (a.bottomPerson.center > b.bottomPerson.center) {
    return -1;
  }
  else if (a.bottomPerson.center < b.bottomPerson.center) {
    return 1;
  }
  return a.x - b.x;
};

// Tell whether this FamilyLine overlaps the other one.
FamilyLine.prototype.overlaps = function(otherFamilyLine) {
  var top = this.topPerson.center;
  var bottom = this.bottomPerson.center;
  var otherTop = otherFamilyLine.topPerson.center;
  var otherBottom = otherFamilyLine.bottomPerson.center;
  // The two lines overlap unless one is completely above another, meaning one's bottom is above the other's top.
  // So overlap = not((bottom above otherTop) or (otherBottom above top))
  // overlap = !((bottom < otherTop) || (otherBottom < top)). Using !(A || B) = !A && !B...
  // overlap = !(bottom < otherTop) && !(otherBottom < top). Using !(A < B) = A >= B...
  // overlap = (bottom >= otherTop) && (otherBottom >= top)
  return bottom >= otherTop && otherBottom >= top;
};

/**
 * Given a list of lines in the same generation (arranged from top to bottom by top person),
 *   return a list of lines at each "depth", with the first list being the leftmost set of lines.
 *   There should be no overlapping lines in a single list.
 *   Preference is given to lines being in the rightmost (last) list when possible.
 * @param lines - sorted list of lines to arrange
 * @return array of line levels, each of which is an array of lines at the same x coordinate
 */
FamilyLine.prototype.arrangeLines = function(lines) {
  // Map of lineIndex -> rightmost line that overlaps to the left of this line.
  var pushMap = [];
  // Map of lineIndex -> depth for that line.  (May be updated as new lines are introduced and "push" the others out)
  var lineDepthMap = [];
  // Array of lines indexes that overlap the previous line, including the previous line, arranged from left to right.
  var overlapList = [];
  var lineIndex;
  var closestLineIndex;
  for (lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    // Look through the list of overlapping lines, and remove any that do not overlap 'line'.
    // Also keep track of what the rightmost overlapping line was.
    closestLineIndex = undefined;
    var overlapIndex;
    for (overlapIndex = 0; overlapIndex < overlapList.length; overlapIndex++) {
      var overlappingLineIndex = overlapList[overlapIndex];
      if (lines[lineIndex].overlaps(lines[overlappingLineIndex])) {
        closestLineIndex = overlappingLineIndex;
      } else {
        // The line at 'depth' no longer overlaps any more lines from here on down, so remove it from the list.
        overlapList.splice(overlapIndex, 1);
      }
    }
    // Add line to the end of the overlap list so it can be considered by the next element.
    overlapList.push(lineIndex);
    // Keep track of what the rightmost overlapping line is for each line (i.e., which one it "pushes" on)
    if (closestLineIndex !== undefined) {
      pushMap[lineIndex] = closestLineIndex;
    }
    // Update the depth for all lines that are pushed on by the current line, if any
    lineDepthMap[lineIndex] = 0;
    var depth = 0;
    while (closestLineIndex !== undefined) {
      depth++;
      var oldDepth = lineDepthMap[closestLineIndex];
      if (depth > oldDepth) {
        // The new line is causing an older line to be "pushed", so update its depth
        lineDepthMap[closestLineIndex] = depth;
      }
      else if (oldDepth > depth) {
        // The old line was already greater than the new one, so no more "pushing" is going to happen.
        break;
      }
      closestLineIndex = pushMap[closestLineIndex];
    }
  }
  // Array of lists of lines at each depth, starting at 0
  var depthLines = [];
  for (lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    depth = lineDepthMap[lineIndex];
    // List of lines at this depth
    var list = depthLines[depth];
    if (!list) {
      list = [];
      depthLines[depth] = list;
    }
    list.push(lines[lineIndex]);
  }
  depthLines.reverse();
  return depthLines;
};


/**
 * Given a sorted collection of family lines that are all in the same generation,
 *   figure out which ones overlap, and set the x-coordinate of each line.
 *   Then return the x value that is one "lineGap" to the right of the rightmost
 *   line.
 * @param generationLines - sorted array of family lines in the same generation.
 * @param x - (starting) x-coordinate to use for the leftmost line
 * @param lineGap - Number of horizontal pixels to leave between adjacent vertical lines.
 * @return (ending) x-coordinate of generation boxes (=coordinate of rightmost line + lineGap).
 */
FamilyLine.prototype.setLineX = function(generationLines, x, lineGap) {
  var lineDepths;
  var d, linesAtDepth;
  var f, familyLine;

  if (!isEmpty(generationLines)) {
    // Array for each depth of the lines at that depth.
    lineDepths = this.arrangeLines(generationLines);
    for (d = 0; d < lineDepths.length; d++) {
      // Array of FamilyLines at the given depth.
      linesAtDepth = lineDepths[d];
      for (f = 0; f < linesAtDepth.length; f++) {
        familyLine = linesAtDepth[f];
        familyLine.x = x;
      }
      x += lineGap;
    }
  }
  return x;
};

/**
 * FamilyLine constructor ============================================
 * @param familyNode - FamilyNode to make vertical family line for.
 * @param parentGeneration - Generation that the parents in the FamilyNode are in.
 * @param $familyLinesDiv - The JQuery object for the familyLines div in the HTML, which is where the new FamilyLine should be added.
 * @constructor
 */
function FamilyLine(familyNode, parentGeneration, $familyLinesDiv) {
  this.familyNode = familyNode;
  this.parentGeneration = parentGeneration;
  // PersonBox references
  this.topPerson = null;
  this.bottomPerson = null;
  this.father = null;
  this.mother = null;
  this.children = [];
  this.x = 0; // x-coordinate of where this FamilyLine is drawn.
  this.prevX = 0;
  this.prevTop = 0;
  this.prevBottom = 0;
  this.prevChildCenter = [];

  var familyLineDiv = this.makeFamilyLineDiv(familyNode.familyId);
  $familyLinesDiv.append(familyLineDiv);
  this.$familyLineDiv = $("#" + familyNode.familyId);
  this.$familyLineDrop = $("#" + familyNode.familyId + "-drop");

  // See how wide the lines are, which is set in graph.css
  // Use this to make sure "dots" are centered, and there aren't gaps at "single parent" corners.
  this.lineThickness = this.$familyLineDiv.width();

  // Person lines for the parents and children
  this.$fatherLineDiv = null;
  this.$motherLineDiv = null;
  this.$childrenLineDivs = [];
  this.$childrenLineDots = [];
  this.$childrenX = [];

  this.$familyLinesDiv = $familyLinesDiv;

  // Allow a person box to be able to receive a drag & drop event.
  this.$familyLineDrop.droppable({
    hoverClass : "familyDropHover",
    scope : "personDropScope",
    accept : "#personParentPlus",
    drop:
        function(e) {
          var plus = e.originalEvent.target.id;
          if (plus === "personParentPlus") {
            var familyId = e.target.id.replace("-drop", "");
            var droppedFamilyLine = relChart.familyLineMap[familyId];
            var sourcePersonId = relChart.personBoxMap[selectedPersonBoxId].personNode.personId;
            var doc = relChart.relGraph.gx;
            if (droppedFamilyLine.father) {
              relChart.ensureRelationship(doc, GX_PARENT_CHILD, droppedFamilyLine.father.personNode.personId, sourcePersonId);
            }
            if (droppedFamilyLine.mother) {
              relChart.ensureRelationship(doc, GX_PARENT_CHILD, droppedFamilyLine.mother.personNode.personId, sourcePersonId);
            }
            updateRecord(doc);
          }
        }
  });

}