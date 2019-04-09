/*
  RelationshipChart: Represents a graphical display of a relationship graph, including PersonBox and FamilyLine objects and their positions.
 */

RelationshipChart.prototype.animationSpeed = 1000;

// Tell whether personBox1 has a spouse that is not personBox2, or vice-versa
RelationshipChart.prototype.hasDifferentSpouse = function(personBox1, personBox2) {
  var f, spouseFamily;
  if (personBox1 && personBox2) {
    var person1 = personBox1.personNode;
    var person2 = personBox2.personNode;
    if (!isEmpty(person1.spouseFamilies)) {
      for (f = 0; f < person1.spouseFamilies.length; f++) {
        spouseFamily = person1.spouseFamilies[f];
        if (spouseFamily.getSpouse(person1) === person2) {
          return false;
        }
      }
      return true;
    }
    else if (!isEmpty(person2.spouseFamilies)) {
      for (f = 0; f < person2.spouseFamilies.length; f++) {
        spouseFamily = person2.spouseFamilies[f];
        if (spouseFamily.getSpouse(person2) === person1) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
};

RelationshipChart.prototype.hasRelatives = function(personBox) {
  return !isEmpty(personBox.parentLines) || !isEmpty(personBox.spouseLines);
};

RelationshipChart.prototype.subtreeGap = function(above, below) {
  if (above && below && above.generation === below.generation && (this.hasRelatives(above) || this.hasRelatives(below))) {
    // Put a small vertical gap between different subtrees
    if (below.subtree !== above.subtree) {
      return this.treeGap;
    }
    // Also put a small vertical gap between a couple and adjacent siblings.
    if (this.hasDifferentSpouse(below, above)) {
      return this.treeGap;
    }
  }
  return 0;
};

/**
 * Create a map of Generation to the array of spouse FamilyLines to the left of that generation (sorted by "top" coordinate).
 * @param familyLines - Array of FamilyLines to put into the returned map.
 * @return array (one entry per generation) of arrays of FamilyLines in that generation.
 */
RelationshipChart.prototype.makeGenerationLinesList = function(familyLines) {
  // Create a map of Generation -> set of family lines in that generation
  var generationLinesList = []; // FamilyLines in each generation: [generation#][]
  var f, familyLine;
  var generationNumber;
  for (generationNumber = 0; generationNumber < this.generations.length; generationNumber++) {
    generationLinesList[generationNumber] = [];
  }
  for (f = 0; f < familyLines.length; f++) {
    familyLine = familyLines[f];
    generationNumber = familyLine.parentGeneration.index;
    generationLinesList[generationNumber].push(familyLine);
  }
  // Sort the lines in each generation's list by the top coordinate.
  for (generationNumber = 0; generationNumber < this.generations.length; generationNumber++) {
    generationLinesList[generationNumber].sort(FamilyLine.prototype.compare);
  }
  return generationLinesList;
};

// Cause HTML elements to move to their new positions.
RelationshipChart.prototype.setPositions = function() {
  var p, personBox;
  var f, familyLine;
  var bottom = 0;
  for (p = 0; p < this.personBoxes.length; p++) {
    personBox = this.personBoxes[p];
    if (personBox.hasMoved()) {
      personBox.setPosition();
    }
    if (personBox.getBottom() > bottom) {
      bottom = personBox.getBottom();
    }
  }
  for (f = 0; f < this.familyLines.length; f++) {
    familyLine = this.familyLines[f];
    if (familyLine.hasMoved()) {
      familyLine.setPosition();
    }
  }
  this.$personsDiv.height(bottom + 4);
};

RelationshipChart.prototype.calculatePositions = function() {
  var y = 0;
  var prevBox = null;
  var p, personBox;
  var bottom;

  this.prevHeight = this.height;

  for (p = 0; p < this.personBoxes.length; p++) {
    personBox = this.personBoxes[p];
    personBox.setPreviousPosition();
    y += this.verticalGap + this.subtreeGap(prevBox, personBox);
    personBox.top = y;
    y += personBox.height + this.personBorder;
    personBox.bottom = y;
    personBox.center = personBox.top + (personBox.height / 2);
    prevBox = personBox;
  }

  // Move persons closer together until they either (a) touch the person above or below them, or (b) come within
  // 1/2 box height of their nearest child or parent.
  if (this.shouldCompress) {
    this.chartCompressor.compressGraph(this.personBoxes);
  }

  // Get the new bottom of the graph
  y = 0;
  for (p = 0; p < this.personBoxes.length; p++) {
    bottom = this.personBoxes[p].getBottom();
    if (bottom > y) {
      y = bottom;
    }
  }
  this.height = y + 4;

  var generationLinesList = this.makeGenerationLinesList(this.familyLines);

  var x = 4; // pad by 4 just so the first line isn't right up against the edge of the screen.
  var g;
  for (g = 0; g < this.generations.length; g++) {
    // Set the x-coordinate of each familyLine for the given generation. Return the resulting x-coordinate, which may have increased
    //   if there are overlapping lines within the same generation.
    x = FamilyLine.prototype.setLineX(generationLinesList[g], x, this.lineGap);
    this.generations[g].left = x;
    x += this.generationWidth + this.lineGap;
  }
  this.width = x + 4;
};

/**
 * Immediately move person boxes and family lines to where they were in the previous chart (before a record update)
 *   so that when we animate to the new positions, we avoid any sudden jump.
 * Uses the prevRelChart to find the position of each person's box and family's line in the previous chart.
 * Any new person boxes or family lines are placed above, below, or between previous ones so they animate from somewhere nearby.
 * @param prevRelChart
 */
RelationshipChart.prototype.setPreviousPositions = function(prevRelChart) {
  var p;
  var newPersons = new LinkedHashSet();
  for (p = 0; p < this.personBoxes.length; p++) {
    var personBox = this.personBoxes[p];
    var prevPersonBox = prevRelChart.personBoxMap[personBox.personBoxId];
    if (prevPersonBox) {
      personBox.$personDiv.css({left: prevPersonBox.getLeft(), top: prevPersonBox.getTop()});
    }
    else {
      newPersons.add(personBox.personNode.personId);
    }
  }
  var f;
  for (f = 0; f < this.familyLines.length; f++) {
    var familyLine = this.familyLines[f];
    var prevFamilyLine = prevRelChart.familyLineMap[familyLine.familyNode.familyId];
    if (prevFamilyLine) {
      var height = 1 + prevFamilyLine.bottomPerson.center - prevFamilyLine.topPerson.center;
      familyLine.$familyLineDiv.css({left: prevFamilyLine.x + "px", top: prevFamilyLine.topPerson.center + "px", height: height + "px"});
      var width;
      if (familyLine.$fatherLineDiv) {
        width = prevFamilyLine.safeWidth(prevFamilyLine.father.getLeft() - prevFamilyLine.x);
        familyLine.$fatherLineDiv.css({"left": prevFamilyLine.x, "top": prevFamilyLine.father.center + "px", "width": width + "px"});
      }
      if (familyLine.$motherLineDiv) {
        width = prevFamilyLine.safeWidth(prevFamilyLine.mother.getLeft() - prevFamilyLine.x);
        familyLine.$motherLineDiv.css({"left": prevFamilyLine.x, "top": prevFamilyLine.mother.center + "px", "width": width + "px"});
      }
      var c;
      for (c = 0;  c < familyLine.children.length; c++) {
        var childPersonBox = familyLine.children[c];
        var prevChildBox = prevRelChart.personBoxMap[childPersonBox.personBoxId];
        width = prevFamilyLine.safeWidth(prevFamilyLine.x - prevChildBox.getRight());
        familyLine.$childrenLineDivs[c].css({"left": prevChildBox.getRight(), "top": prevChildBox.center, "width": width});
        familyLine.$childrenX[c].css({"left": prevFamilyLine.x - prevFamilyLine.xSize, "top": prevChildBox.center - prevFamilyLine.xSize/2});
        familyLine.$childrenLineDots[c].css({"left": prevChildBox.getRight() + width - this.dotWidth/2, "top": prevChildBox.center - this.dotHeight/2});
      }
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

RelationshipChart.prototype.hideFamilyControls = function() {
  this.$fatherX.hide();
  this.$motherX.hide();
  this.$fatherPlus.hide();
  this.$motherPlus.hide();
  if (selectedFamilyLineId) {
    var selectedFamily = this.familyLineMap[selectedFamilyLineId];
    if (selectedFamily && !isEmpty(selectedFamily.$childrenX)) {
      for (var c = 0; c < selectedFamily.$childrenX.length; c++) {
        selectedFamily.$childrenX[c].hide();
      }
    }
  }
};

RelationshipChart.prototype.positionFamilyControl = function($control, x, y) {
  $control.css({left: x, top: y});
  $control.show();
};

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
  $control.click(function(event) {
    handleFamilyClick(event, divId);
  });
  return $control;
};

function handleFamilyClick(event, divId) {
  event.stopPropagation();
  var familyLine = relChart.familyLineMap[selectedFamilyLineId];
  if (divId === "fatherX") {
    familyLine.removeFather();
    updateRecord(relChart.relGraph.gx);
  }
  else if (divId === "motherX") {
    familyLine.removeMother();
    updateRecord(relChart.relGraph.gx);
  }
  else {
    console.log("Click!");
  }

}

// FamilyId of the selected family line
var selectedFamilyLineId = null;

// Toggle whether the given familyId is selected.
function toggleFamilyLine(familyId, event) {
  var familyLine = relChart.familyLineMap[familyId];
  if (selectedFamilyLineId === familyId) {
    // Deselect family line.
    if (familyLine) { // might be undefined if this family line got removed after deleting the last child or spouse.
      familyLine.$familyLineDiv.removeAttr("chosen");
    }
    relChart.hideFamilyControls();
    selectedFamilyLineId = null;
  }
  else {
    if (selectedFamilyLineId) {
      // Deselect currently selected family line
      toggleFamilyLine(selectedFamilyLineId);
    }
    familyLine.$familyLineDiv.attr("chosen", "yep");
    selectedFamilyLineId = familyId;
    // Set the + or x controls at the top and bottom of the family line.
    var x = familyLine.x + familyLine.lineThickness;
    relChart.positionFamilyControl(familyLine.father ? relChart.$fatherX : relChart.$fatherPlus, x, familyLine.getTop() + 1);
    relChart.positionFamilyControl(familyLine.mother ? relChart.$motherX : relChart.$motherPlus, x, familyLine.getBottom() - 8 + familyLine.lineThickness);

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
}

function clearSelections() {
  if (selectedFamilyLineId) {
    toggleFamilyLine(selectedFamilyLineId);
  }
}


// Constructor. Creates an empty RelationshipChart. Needs to be built up using RelChartBuilder.buildChart().
function RelationshipChart(relGraph, $relChartDiv, shouldIncludeDetails, shouldCompress) {
  this.relGraph = relGraph;
  $relChartDiv.empty();
  $relChartDiv.append($.parseHTML("<div id='personNodes'></div>\n<div id='familyLines'></div>\n<div id='editControls'></div>"));

  this.$personsDiv = $("#personNodes");
  this.$familyLinesDiv = $("#familyLines");
  this.$editControlsDiv = $("#editControls");
  this.personBoxes = []; // array of all PersonBoxes in the relationship chart, positioned top to bottom
  this.generations = []; // array of Generations that the persons are in, left to right
  this.familyLines = []; // array of family lines

  this.personBoxMap = {}; // map of personBoxId to their corresponding PersonBox
  this.familyLineMap = {}; // map of familyId to its corresponding FamilyLine object
  this.personDupCount = {}; // map of personId to how many duplicates have been seen so far (null/undefined => 0).

  // Display options
  this.personBorder = 6; // pixels spread between the top and bottom, around the text (/2 = border space)
  this.verticalGap = 4; // min. pixels between two boxes in the same generation
  this.generationGap = 10; // min. pixels between a parent and child
  this.generationWidth = 280; // Width of a PersonBox (not including additional padding).
  this.lineGap = 10; // Horizontal pixels between one vertical line and another; and between a PersonBox and the vertical line.
  this.treeGap = 10; // Additional vertical pixels between someone in one connected tree and another one.
  this.shouldIncludeDetails = shouldIncludeDetails;
  this.shouldCompress = shouldCompress;
  this.shouldDisplayIds = true;

  this.width = 0; // overall size of chart
  this.height = 0;
  this.prevHeight = 0; // height of chart before last update
  this.chartCompressor = new ChartCompressor(this);

  // Edit controls
  this.$fatherX = this.makeControl("fatherX", "relX");
  this.$motherX = this.makeControl("motherX", "relX");
  this.$fatherPlus = this.makeControl("fatherPlus", "relPlus");
  this.$motherPlus = this.makeControl("motherPlus", "relPlus");
}