
FamilyLine.prototype.makeFamilyLineDiv = function(familyId) {
  var html = "<div class='familyLine' id='" + familyId + "'></div>";
  return $.parseHTML(html);
};

FamilyLine.prototype.makePersonLineDiv = function(personLineId) {
  var html = "<div class='personLine' id='" + personLineId + "'></div>";
  return $.parseHTML(html);
};

FamilyLine.prototype.addPersonLine = function(personLineId, left, top, width) {
  var personLineDiv = this.makePersonLineDiv(personLineId);
  this.$familyLinesDiv.append(personLineDiv);
  var $personLineDiv = $("#" + personLineId);
  $personLineDiv.css({"top": top, "left": left, "width": width});
  return $personLineDiv;
};

FamilyLine.prototype.safeWidth = function(width) {
  return Math.max(width, 2);
};

// Add a PersonBox to the list of children, and create a div for the line connecting that child's PersonBox to the FamilyLine.
FamilyLine.prototype.addChild = function(childBox) {
  if (childBox) {
    this.children.push(childBox);
    this.prevChildCenter.push(childBox.center);
    var childLineId = this.familyNode.familyId + "-c" + this.children.length;
    var left = childBox.getRight();
    var width = this.safeWidth(this.x - left);
    var $childLineDiv = this.addPersonLine(childLineId, left, childBox.center, width);
    this.$childrenLineDivs.push($childLineDiv);
  }
};

FamilyLine.prototype.setFather = function(fatherBox) {
  if (fatherBox) {
    this.father = fatherBox;
    var fatherLineId = this.familyNode.familyId + "-f";
    var width = this.safeWidth(fatherBox.getLeft() - this.x);
    this.$fatherLineDiv = this.addPersonLine(fatherLineId, fatherBox.getLeft(), fatherBox.center, width);
  }
};

FamilyLine.prototype.setMother = function(motherBox) {
  if (motherBox) {
    this.mother = motherBox;
    var motherLineId = this.familyNode.familyId + "-m";
    var width = this.safeWidth(motherBox.getLeft() - this.x);
    this.$motherLineDiv = this.addPersonLine(motherLineId, motherBox.getLeft(), motherBox.center, width);
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
  this.$familyLineDiv.animate({"left": this.x + "px", "top": top + "px", "height": height + "px"}, RelationshipChart.prototype.animationSpeed);
  this.prevTop = top;
  this.prevBottom = bottom;
  this.prevX = this.x;
  var width;

  if (this.$fatherLineDiv) {
    width = this.father.getLeft() - this.x;
    this.$fatherLineDiv.animate({"left": this.x, "top": this.father.center + "px", "width": width + "px"}, RelationshipChart.prototype.animationSpeed);
  }
  if (this.$motherLineDiv) {
    width = this.mother.getLeft() - this.x;
    this.$motherLineDiv.animate({"left": this.x + "px", "top": this.mother.center + "px", "width": width + "px"}, RelationshipChart.prototype.animationSpeed);
  }
  var c, childBox;
  for (c = 0; c < this.children.length; c++) {
    childBox = this.children[c];
    width = this.x - childBox.getRight();
    this.$childrenLineDivs[c].animate({"left": childBox.getRight(), "top": childBox.center + "px", "width": width  + "px"}, RelationshipChart.prototype.animationSpeed);
    this.prevChildCenter[c] = childBox.center;
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
  return (top >= otherTop && top <= otherBottom) ||
      (otherTop >= top && otherTop <= bottom);
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
    closestLineIndex = null;
    var overlapIndex;
    for (overlapIndex = 0; overlapIndex < overlapList.length; overlapIndex++) {
      var overlappingLineIndex = overlapList[overlapIndex];
      if (lines[line].overlaps(lines[overlappingLineIndex])) {
        closestLineIndex = overlappingLineIndex;
      } else {
        // The line at 'depth' no longer overlaps any more lines from here on down, so remove it from the list.
        overlapList.splice(overlapIndex, 1);
      }
    }
    // Add line to the end of the overlap list so it can be considered by the next element.
    overlapList.push(lineIndex);
    // Keep track of what the rightmost overlapping line is for each line (i.e., which one it "pushes" on)
    if (closestLineIndex) {
      pushMap[lineIndex] = closestLineIndex;
    }
    // Update the depth for all lines that are pushed on by the current line, if any
    lineDepthMap[lineIndex] = 0;
    var depth = 0;
    while (closestLineIndex) {
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

// FamilyLine constructor ============================================
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
  this.$fatherLineDiv = null;
  this.$motherLineDiv = null;
  this.$childrenLineDivs = [];
  this.$familyLinesDiv = $familyLinesDiv;
}