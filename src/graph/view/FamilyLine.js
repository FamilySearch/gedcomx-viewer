
FamilyLine.prototype.makeFamilyLineDiv = function(familyId) {
  var html = "<div class='familyLine' id='" + familyId + "'>" +
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
  var html = "<div class='childX' id='" + childXId + "'></div>";
  var childXDiv = $.parseHTML(html);
  this.$familyLinesDiv.append(childXDiv);
  var $childX = $("#" + childXId);
  if (!this.xSize) {
    // Get the image size based on what graph.css said it should be.
    this.xSize = $childX.height();
  }
  $childX.hide();
  var familyLine = this;
  $childX.click(function() {
    familyLine.removeChild(childBox);
    updateRecord(familyLine.relChart.relGraph.gx);
  });
  $childX.draggable({revert: true, scope : "personDropScope"});
  return $childX;
};

// Width that is no smaller than 2.
FamilyLine.prototype.safeWidth = function(width) {
  return Math.max(width, 2);
};

// Add a PersonBox to the list of children for this FamilyLine, and create a div for the line connecting that child's PersonBox to the FamilyLine.
FamilyLine.prototype.addChild = function(childBox, isEditable) {
  if (childBox) {
    var childLineId = this.familyNode.familyId + "-c" + this.children.length;
    this.children.push(childBox);
    this.prevChildCenter.push(childBox.center);
    var left = childBox.getRight();
    var width = this.safeWidth(this.x - left);
    this.$childrenLineDivs.push(this.addPersonLine(childLineId, left, childBox.center, width));
    this.$childrenLineDots.push(this.addPersonDot(childLineId, left, childBox.center, width));
    if (isEditable) {
      this.$childrenX.push(this.addChildX(childLineId, childBox))
    }
  }
};


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
  if (this.$familyLineDrop) { // => isEditable
    this.$familyLineDrop.animate({"height": height}, RelationshipChart.prototype.animationSpeed);
  }
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
    if (this.$childrenX) { // => isEditable
      this.$childrenX[c].animate({"left": this.x - this.xSize, "top": childBox.center - this.xSize/2}, RelationshipChart.prototype.animationSpeed);
    }
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
 * @param relChart - RelationshipChart that this FamilyLine is being added to.
 * @param familyNode - FamilyNode to make vertical family line for.
 * @param parentGeneration - Generation that the parents in the FamilyNode are in.
 * @param $familyLinesDiv - The JQuery object for the familyLines div in the HTML, which is where the new FamilyLine should be added.
 * @constructor
 */
function FamilyLine(relChart, familyNode, parentGeneration, $familyLinesDiv) {
  this.relChart = relChart;
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

  // See how wide the lines are, which is set in graph.css
  // Use this to make sure "dots" are centered, and there aren't gaps at "single parent" corners.
  this.lineThickness = this.$familyLineDiv.width();

  // Person lines for the parents and children
  this.$fatherLineDiv = null;
  this.$motherLineDiv = null;
  this.$childrenLineDivs = [];
  this.$childrenLineDots = [];

  this.$familyLinesDiv = $familyLinesDiv;

  if (relChart.isEditable) {
    this.$childrenX = [];
    var thisFamilyLine = this;
    this.$familyLineDiv.click(function(e) {
      thisFamilyLine.toggleFamilyLine(e);
    });
    // Allow a person box to be able to receive a drag & drop event.
    this.$familyLineDrop = $("#" + familyNode.familyId + "-drop");
    this.$familyLineDrop.droppable({
      hoverClass: "familyDropHover",
      scope: "personDropScope",
      accept: "#personParentPlus,.childX,#personSpousePlus,#personChildPlus",
      drop:
          function(e) {
            thisFamilyLine.familyDrop(e);
          }
    });
  }
}