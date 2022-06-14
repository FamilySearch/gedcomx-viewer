/*
  Functions for construction a RelationshipChart from a RelationshipGraph, placing boxes in their order and generations, and creating family lines.
  RelationshipChart itself does the calculation of actual vertical offsets.
 */

RelChartBuilder.prototype.resetRemainingPersons = function() {
  for (let personNode of this.relChart.relGraph.personNodes) {
    let isVisible = true;
    if (isTreeGraph()) {
      let personAnalysis = personAnalysisMap.get(personNode.personId);
      if (personAnalysis && !personAnalysis.isVisible) {
        isVisible = false;
      }
    }
    if (isVisible) {
      this.remainingPersonIds.add(personNode.personId);
    }
  }
};

// Get the next remaining person who is a principal person in the relGraph, if any. Otherwise, get the next remaining person.
RelChartBuilder.prototype.getNextRemainingPerson = function() {
  // for (let p = 0; p < this.relChart.relGraph.principals.length; p++) {
  //   let personNode = this.relChart.relGraph.principals[p];
  //   if (this.remainingPersonIds.contains(personNode.personId)) {
  //     return personNode.personId;
  //   }
  // }
  // // No principals, so return the first personNode in 'remaining'.
  return this.remainingPersonIds.getFirst();
};

/**
 * Tell whether the given family has only one person (or less).
 * @param familyNode - FamilyNode to check
 * @return true if the family has only one person (or zero); false if the family has multiple people
 */
RelChartBuilder.prototype.familyHasOnlyOnePerson = function(familyNode) {
  let numPersons = 0;
  if (familyNode.father) {
    numPersons++;
  }
  if (familyNode.mother) {
    numPersons++;
  }
  if (familyNode.children) {
    numPersons += familyNode.children.length;
  }
  return numPersons <= 1;
};

/**
 * Add spouses of a PersonBox to the chart, inserting husbands above (and then children oldest to youngest above, too),
 *   or wives below (and children youngest to oldest below as well).
 * @param personBox - Person whose spouses and children should be added.
 * @param subtree - Index of which subtree all these people are part of.
 * @param needsRelativesQueue - Queue to add people to for later recursive processing.
 */
RelChartBuilder.prototype.addSpouses = function(personBox, subtree, needsRelativesQueue) {
  // Add spouse above or below, and insert children in between
  let personNode = personBox.personNode;
  let spouseFamilies = personNode.spouseFamilies;

  if (!isEmpty(spouseFamilies)) {
    for (let spouseFamily of spouseFamilies) {
      if (this.familyHasOnlyOnePerson(spouseFamily)) {
        continue; // don't bother creating family lines that will not connect anyone
      }
      if (!this.relChart.familyLineMap[spouseFamily.familyId]) {
        let spouseFamilyLine = new FamilyLine(this.relChart, spouseFamily, this.relChart.$familyLinesDiv);
        this.relChart.familyLineMap[spouseFamily.familyId] = spouseFamilyLine;
        this.relChart.familyLines.push(spouseFamilyLine);
        personBox.spouseLines.push(spouseFamilyLine);
        let spouse = spouseFamily.getSpouse(personNode);
        let direction = personNode.gender === GENDER_CODE_MALE ? this.BELOW : this.ABOVE;
        let spouseBox = this.insert(direction, personBox, spouse, personBox.generationIndex, spouseFamilyLine, null, needsRelativesQueue, subtree);
        if (personNode.gender === GENDER_CODE_MALE) {
          spouseFamilyLine.setFather(personBox);
          spouseFamilyLine.setMother(spouseBox);
        }
        else {
          spouseFamilyLine.setFather(spouseBox);
          spouseFamilyLine.setMother(personBox);
        }
        let children = spouseFamily.children;
        if (children) {
          if (personNode.gender === GENDER_CODE_MALE) {
            // Insert children below the person (i.e., the father), from last to first
            let childBoxes = [];
            for (let c = children.length - 1; c >= 0; c--) {
              let childBox = this.insert(direction, personBox, children[c], personBox.generationIndex - 1, null, spouseFamilyLine, needsRelativesQueue, subtree);
              childBoxes.push(childBox);
            }
            // Reverse the list of children and then add them all to the spouse family line so they'll be in the right order
            childBoxes.reverse();
            for (let childBox of childBoxes) {
              spouseFamilyLine.addChild(childBox, this.relChart.isEditable);
            }
          }
          else {
            // Insert children above the person (i.e., the mother), from first to last
            for (let child of spouseFamily.children) {
              let childBox = this.insert(direction, personBox, child, personBox.generationIndex - 1, null, spouseFamilyLine, needsRelativesQueue, subtree);
              spouseFamilyLine.addChild(childBox, this.relChart.isEditable);
            }
          }
        }
      }
    }
  }
};

/**
 *
 * @param personBox - PersonBox to add parents for
 * @param subtree - Index of subtree that the involved PersonBoxes are part of.
 * @param needsRelativesQueue - Queue to add new PersonBoxes to (so their relatives can be added).
 */
RelChartBuilder.prototype.addParents = function(personBox, subtree, needsRelativesQueue) {

  // Add parents above and below, and then older siblings above and younger siblings below
  let personNode = personBox.personNode;
  let parentFamilies = personNode.parentFamilies;
  if (parentFamilies) {
    for (let parentFamily of parentFamilies) {
      if (this.familyHasOnlyOnePerson(parentFamily)) {
        // skip "empty" families that don't relate multiple people together.
        continue;
      }
      if (!this.relChart.familyLineMap[parentFamily.familyId]) {
        let parentFamilyLine = new FamilyLine(this.relChart, parentFamily, this.relChart.$familyLinesDiv);
        this.relChart.familyLineMap[parentFamily.familyId] = parentFamilyLine;
        this.relChart.familyLines.push(parentFamilyLine);
        personBox.parentLines.push(parentFamilyLine);
        let fatherBox = this.insert(this.ABOVE, personBox, parentFamily.father, personBox.generationIndex + 1, parentFamilyLine, null, needsRelativesQueue, subtree);
        let motherBox = this.insert(this.BELOW, personBox, parentFamily.mother, personBox.generationIndex + 1, parentFamilyLine, null, needsRelativesQueue, subtree);
        parentFamilyLine.setFather(fatherBox);
        parentFamilyLine.setMother(motherBox);
        let children = parentFamily.children;
        if (children) {
          let personPosition = 0;
          // Add older siblings from oldest to youngest
          let child;
          do {
            child = children[personPosition++];
            if (child !== personNode) {
              let siblingBox = this.insert(this.ABOVE, personBox, child, personBox.generationIndex, null, parentFamilyLine, needsRelativesQueue, subtree);
              parentFamilyLine.addChild(siblingBox, this.relChart.isEditable);
            }
          } while (personPosition < children.length && child !== personNode);

          // Add the person to the parent family line's child list
          parentFamilyLine.addChild(personBox, this.relChart.isEditable);

          // Insert younger siblings below the person from youngest to oldest
          let youngerSiblingBoxes = [];
          for (let c = children.length - 1; c >= personPosition; c--) {
            let youngerChild = children[c];
            if (youngerChild === personNode) {
              throw "Error: person appears in child list twice.";
            }
            let siblingBox = this.insert(this.BELOW, personBox, youngerChild, personBox.generationIndex, null, parentFamilyLine, needsRelativesQueue, subtree);
            youngerSiblingBoxes.push(siblingBox);
          }
          // Add younger siblings to the family line from oldest to youngest so that the child list is in order
          for (let c = youngerSiblingBoxes.length - 1; c >= 0; c--) {
            parentFamilyLine.addChild(youngerSiblingBoxes[c], this.relChart.isEditable);
          }
        }
      }
    }
  }
};

RelChartBuilder.prototype.addRelatives = function(personBox, subtree) {
  // List of personBoxes to add relatives for.  By using a queue instead of recursion, we will tend to add people
  //   to the chart in the order of how closely related they are to the "main" person.  That way, if a person
  //   appears in the chart multiple times, their first ("main") appearance (which will then include their relatives)
  //   will be the one that is more closely related to the main person.
  let needsRelativesQueue = [];
  do {
    personBox.subtree = subtree;

    this.addSpouses(personBox, subtree, needsRelativesQueue);
    this.addParents(personBox, subtree, needsRelativesQueue);

    personBox = needsRelativesQueue.length > 0 ? needsRelativesQueue.splice(0, 1)[0] : null;
  } while (personBox);
};

RelChartBuilder.prototype.getPersonNode = function(personId) {
  let personNode = this.relChart.relGraph.personNodeMap[personId];
  if (!personNode && personId) {
    throw "Could not find personNode for personId '" + personId + "'";
  }
  return personNode;
};

/**
 * Add all of the PersonBoxes to relChart.personBoxes and relChart.personBoxMap (at least one per PersonNode in relChart,
 *   plus extras if there are duplicates, such as when someone is somehow related more than one way).
 * Add FamilyLines to relChart.familyLines and relChart.familyLineMap.
 */
RelChartBuilder.prototype.addPersons = function() {
  // Create person boxes for everyone
  let personId;
  let previousBottom = null; // bottom box of previous disconnected sub-graph, if any
  let subtree = 1;

  this.resetRemainingPersons();
  do {
    // The first time through, use the primary person, if there is one; otherwise, use the first remaining person (who is disconnected from anyone already used).
    personId = this.getNextRemainingPerson();
    if (personId) {
      this.remainingPersonIds.remove(personId);
      let personNode = this.getPersonNode(personId);
      let personBox = new PersonBox(personNode, this.relChart, null, null, 0, this.relGraphToGx);
      this.addRelatives(personBox, subtree++);
      // Find the first person box in this sub-graph
      let topBox = null;
      while (personBox) {
        topBox = personBox;
        personBox = topBox.above;
      }
      if (previousBottom) {
        topBox.above = previousBottom;
        previousBottom.below = topBox;
      }
      for (personBox = topBox; personBox; personBox = personBox.below) {
        this.relChart.personBoxes.push(personBox);
        previousBottom = personBox;
      }
    }
  } while (personId);
};

/**
 * Create a list of Generation objects from generationMap, filled with the list of persons for each generation.
 *   Set the global and generation order on each person box.
 *   Shift the 'index' in Generation objects so that the leftmost generation is at 0.
 * @return Array of Generation objects that were created, with person lists filled in.
 */
RelChartBuilder.prototype.createGenerations = function(relChart) {
  /**
   * Find the minimum generation index in each subtree, then subtract that from the generationIndex of every PersonBox in that subtree.
   * This will make it so that each subtree starts at generation 0, thus avoiding cases where we use more generations
   *  on the screen than necessary.
   * @param personBoxes - Array of PersonBoxes
   * @returns {array} Newly-created array of Generation objects.
   */
  function shiftGenerations(personBoxes) {
    // Map of subtree index to minimum generationIndex in that subtree.
    let minGeneration = {};
    for (let personBox of personBoxes) {
      let generationIndex = personBox.generationIndex;
      let minGenerationIndex = minGeneration[personBox.subtree];
      if (minGenerationIndex === undefined || personBox.generationIndex < minGenerationIndex) {
        let subtree = personBox.subtree;
        minGeneration[subtree] = generationIndex;
      }
    }

    // Shift the generationIndex of all person boxes in each subtree so that each subtree begins at generation 0.
    let maxGeneration = 0;
    for (let personBox of personBoxes) {
      personBox.generationIndex -= minGeneration[personBox.subtree];
      if (personBox.generationIndex > maxGeneration) {
        maxGeneration = personBox.generationIndex;
      }
    }

    // Create the array of Generation objects
    let generations = [];
    for (let g = 0; g <= maxGeneration; g++) {
      generations[g] = new Generation(g, relChart);
    }
    return generations;
  }

  // Add each person box to the generation list that it is part of, and set its global position number.
  function addPersonsToGenerations(personBoxes, generations) {
    let globalPosition = 0;

    for (let personBox of personBoxes) {
      personBox.order = globalPosition++; // set the global order of this person
      personBox.generation = generations[personBox.generationIndex];
      personBox.generation.genPersons.push(personBox);
    }
  }

  function setGenerationPositions(generations) {
    // Set the genAbove/genBelow for each person within each generation
    for (let generation of generations) {
      let aboveInGen = null;
      let generationPosition = 0;
      for (let personBox of generation.genPersons) {
        if (aboveInGen) {
          aboveInGen.genBelow = personBox;
          personBox.genAbove = aboveInGen;
        }
        aboveInGen = personBox;
        personBox.genOrder = generationPosition++;
      }
    }
  }


  // createGenerations(personBoxes) ==================================

  // Shift the generationIndex of the personBoxes within each subtree so that each subtree begins at generation 0.
  //
  let generations = shiftGenerations(this.relChart.personBoxes);

  // Add PersonBoxes to each generation, and set their global positions.
  addPersonsToGenerations(this.relChart.personBoxes, generations);
  // Set genAbove, genBelow and generationPosition on each PersonBox in each generation.
  setGenerationPositions(generations);

  return generations;
};

/**
 * Get a list of all the family lines built while adding persons and their relatives.
 * Set the top & bottom person of each family line.
 * @return list of FamilyLines for the whole graph, with top & bottom persons set.
 */
RelChartBuilder.prototype.setFamilyLineTopBottoms = function() {
  // For each FamilyLine, set the top person (to father or first child) and bottom person (to mother or last child).
  for (let familyLine of this.relChart.familyLines) {
    familyLine.topPerson = familyLine.father ? familyLine.father : familyLine.children[0];
    familyLine.bottomPerson = familyLine.mother ? familyLine.mother : familyLine.children[familyLine.children.length - 1];
    let height = Math.max(familyLine.bottomPerson.center - familyLine.topPerson.center, 1);
    familyLine.$familyLineDiv.css({top: familyLine.topPerson.center, height: height});
    if (familyLine.$familyLineDrop) { // => isEditable
      familyLine.$familyLineDrop.css({height: height});
    }
  }
};


/**
 * Insert a person above or below the given origPerson PersonBox.
 * @param isAbove - whether to insert above (true) or below (false)
 * @param origPersonBox - PersonBox above or below which to insert.
 * @param newPersonNode - PersonNode to insert into a new PersonBox.
 * @param generationIndex - Generation that the new PersonBox will be in.
 * @param spouseFamilyLine -
 * @param parentFamilyLine -
 * @param needsRelativesQueue - Queue to add the new PersonBox to, since their relatives will need to be added as well.
 * @param subtree - Index of subtree that this person is being added to.
 * @return new PersonBox
 */
RelChartBuilder.prototype.insert = function(isAbove, origPersonBox, newPersonNode, generationIndex,
                                            spouseFamilyLine, parentFamilyLine, needsRelativesQueue, subtree) {
  if (!newPersonNode) {
    return null;
  }
  let newPersonBox = isAbove ?
      this.insertAbove(origPersonBox, newPersonNode, generationIndex) :
      this.insertBelow(origPersonBox, newPersonNode, generationIndex);
  newPersonBox.subtree = subtree;
  if (this.remainingPersonIds.contains(newPersonNode.personId)) {
    // This is the first time this person was added to the chart, so add it to the map and make sure we recurse on its relatives.
    this.remainingPersonIds.remove(newPersonNode.personId);
    needsRelativesQueue.push(newPersonBox);
  }
  else {
    // We've already seen this person
    this.duplicateBoxes.push(newPersonBox);
  }
  if (spouseFamilyLine) {
    newPersonBox.spouseLines.push(spouseFamilyLine);
  }
  if (parentFamilyLine) {
    newPersonBox.parentLines.push(parentFamilyLine);
  }
  return newPersonBox;
};

/**
 * Insert a new person box above an existing person box.  Fix up the above/below pointers.
 *   If this is the first time the new person has been added to the chart, then recurse on the relatives of the person.
 *   Otherwise, just add one box for this person and return without adding relatives, since this is a duplicate entry
 *   for this person.
 * @param origPerson - PersonBox above which the new PersonBox is being added
 * @param newPerson - PersonNode for whom a box is being added above 'origPerson'
 * @param generationIndex - generation to add the new person into
 * @return PersonBox that was created
 */
RelChartBuilder.prototype.insertAbove = function(origPerson, newPerson, generationIndex) {
  let newPersonBox = new PersonBox(newPerson, this.relChart, origPerson.above, origPerson, generationIndex, this.relGraphToGx);
  origPerson.above = newPersonBox;
  if (newPersonBox.above) {
    newPersonBox.above.below = newPersonBox;
  }
  return newPersonBox;
};

/**
 * Insert a new person box below an existing person box.  Fix up the above/below pointers.
 * If the new person has already had a box created for them, create a new one anyway, but
 *   return false, so that the calling routine knows not to recurse on the relatives of this person.
 * @param origPerson - person box above which the new person is being added
 * @param newPerson - person for whom a box is being added above 'origPerson'
 * @param generationIndex - generation to add the new person into
 * @return PersonBox that was created
 */
RelChartBuilder.prototype.insertBelow = function(origPerson, newPerson, generationIndex) {
  let newPersonBox = new PersonBox(newPerson, this.relChart, origPerson, origPerson.below, generationIndex, this.relGraphToGx);
  origPerson.below = newPersonBox;
  if (newPersonBox.below) {
    newPersonBox.below.above = newPersonBox;
  }
  return newPersonBox;
};

/**
 * Constructor.  Creates a RelChartBuilder object an initializes the various structures.
 *   Adds all of the persons from the relationship graph to 'remaining', beginning with the first person flagged as primary, or else the first person.
 * @param relGraph - relationship graph to build a chart for
 * @param $relChartDiv - JQuery object for the div that the chart goes in.
 * @param chartOptions - ChartOptions object (see ChartOptions.js)
 */
function RelChartBuilder(relGraph, $relChartDiv, chartOptions) {
  // Create a chart with PersonBoxes created, but no FamilyLines or Generations yet.
  this.relChart = new RelationshipChart(relGraph, $relChartDiv, chartOptions);
  this.ABOVE = true;
  this.BELOW = false;
  // Set of personIds remaining to be added to the chart.
  this.remainingPersonIds = new LinkedHashSet();
  // Set of personIds for PersonBoxes that are 'duplicates' of a box that already appeared elsewhere in the graph
  this.duplicateBoxes = [];
  this.generationMap = {}; // Map of generation index to Generation. (In relChart, it is a simple 0-based array, so no map is needed.)
}

/**
 *
 * @param doc - GedcomX document
 * @param relToGx - Map of relationship graph element id to the GedcomX object id that it goes with
 * @param imgToGx - Map of image overlay element id to the GedcomX object id that it goes with
 */
RelChartBuilder.prototype.correlateHighlights = function(doc, relToGx, imgToGx) {

  function gatherGxIdMap2(gx, parentId, personId) {
    if (gx) {
      if (Array.isArray(gx)) {
        for (let gxDoc of gx) {
          gatherGxIdMap2(gxDoc, parentId, personId);
        }
      }
      else {
        if (gx.id) {
          gxParentMap[gx.id] = parentId;
          gxPersonMap[gx.id] = personId;
          parentId = gx.id;
        }
        for (let child in gx) {
          if (gx.hasOwnProperty(child) && typeof gx[child] == "object") {
            gatherGxIdMap2(gx[child], parentId, personId);
          }
        }
      }
    }
  }

  function gatherGxParentMap(gxDoc) {
    if (gxDoc.persons) {
      for (let person of gxDoc.persons) {
        gatherGxIdMap2(person, gxDoc.id, person.id);
      }
    }
    if (gxDoc.relationships) {
      for (let rel of gxDoc.relationships) {
        let personId = getPersonIdFromReference(rel.person1);
        gatherGxIdMap2(rel, gxDoc.id, personId);
      }
    }
  }

  // Take a map of key->value and return a map of value->[keys], i.e., value to a list of keys that mapped to that value.
  function reverseMap(map) {
    let reversedMap = {};
    for (let key in map) {
      if (map.hasOwnProperty(key)) {
        let value = map[key];
        let list = reversedMap[value];
        if (!list) {
          list = [];
          reversedMap[value] = list;
        }
        list.push(key);
      }
    }
    return reversedMap;
  }

  function highlight(elements, myElement, elementsClass, myClass) {
    if (!isEmpty(highlightsToProcess)) {
      // Image viewer highlight elements don't exist when the graph is first being built, so wait until the first highlight is
      //  done before triggering that.
      for (let h of highlightsToProcess) {
        $("#" + h.imgElement).hover(
            function() {h(h.relElements, h.imgElement, "record-highlight", null);},
            function() {unhighlight(h.relElements, h.imgElement, "record-highlight", null);});
      }
      highlightsToProcess = []; // now handled, so clear it.
    }
    if (elements) {
      for (let element of elements) {
        $("#" + element).addClass(elementsClass);
      }
      if (myClass) {
        $("#" + myElement).addClass(myClass);
      }
    }
  }

  function unhighlight(elements, myElement, elementsClass, myClass) {
    if (elements) {
      for (let element of elements) {
        $("#" + element).removeClass(elementsClass);
      }
      if (myClass) {
        $("#" + myElement).removeClass(myClass);
      }
    }
  }

  //==============================================
  // correlateHighlights(doc, relToGx, imgToGx)===
  let gxParentMap = {}; // map of gx object id to parent (or ancestor) gx object id in hierarchy.
  let gxPersonMap = {}; // map of gx object id to person it is inside of. (or the p1 of a relationship it is inside of).
  gatherGxParentMap(doc);

  // let gxToImg = reverseMap(imgToGx); // map of gx object id to array of image overlay element ids that came from that object.
  let gxToRel = reverseMap(relToGx); // map of gx object id to array of relationship graph element ids that came from that object.
  // let personToGx = reverseMap(gxPersonMap); // map of personId to list of gx object ids within that person
  let relToImg = {}; // map of relGraph element to array of imgElements that were found to associate with it.

  // For each image overlay HTML element, find the gx object it goes with; then find the corresponding list of relationship graph elements
  //   that need to be highlighted when this image overlay element is hovered over.
  for (let imgElement in imgToGx) {
    if (imgToGx.hasOwnProperty(imgElement)) {
      let gxId = imgToGx[imgElement];
      // Since the image elements are based on fields, their gx id might be "lower" in the gx hierarchy than
      //   their corresponding relationship graph elements.
      // So walk up the parent chain looking for the lowest one that matches a rel chart element's gx id.
      while (gxId && gxId !== doc.id && !gxToRel[gxId]) {
        gxId = gxParentMap[gxId];
      }
      if (!gxId) {
        console.warn("Somehow missed root of document while traversing.");
      }
      else {
        let relElements = gxToRel[gxId];
        if (!empty(relElements)) {
          highlightsToProcess.push({imgElement: imgElement, relElements: relElements});
          // Add this imgElement to the list of imgElements associated with each of these relElements, so
          //  we can do highlighting in the reverse direction.
          for (let relElement of relElements) {
            let imgElements = relToImg[relElement];
            if (!imgElements) {
              imgElements = [];
              relToImg[relElement] = imgElements;
            }
            if (!imgElements.includes(relElement)) {
              imgElements.push(imgElement);
            }
          }
        }
      }
    }
  }

  for (let relElement in relToImg) {
    if (relToImg.hasOwnProperty(relElement)) {
      let imgElements = relToImg[relElement];
      if (!empty(imgElements)) {
        $("#" + relElement).hover(
            function() {highlight(imgElements, relElement, "img-highlight", "record-highlight");},
            function() {unhighlight(imgElements, relElement, "img-highlight", "record-highlight");});
      }
    }
  }
};

function isTreeGraph() {
  return typeof personAnalysisMap != 'undefined';
}

let highlightsToProcess = [];

/**
 * Build a relationship chart (RelChart) from this RelChartBuilder's relationship graph, starting at the given person.
 * @return RelationshipChart built from the given graph starting with the given person
 */
RelChartBuilder.prototype.buildChart = function(prevChart, imgOverlayToGx) {
  if (this.relChart.isEditable) {
    this.relChart.addEditControls();
  }
  this.relChart.detailedPersonIds = prevChart ? new Set(prevChart.detailedPersonIds) : new Set();
  this.relGraphToGx = {}; // map of relationship graph HTML element id to GedcomX object id that corresponds. Can be many-to-1
  this.relChart.animationSpeed = prevChart ? 1000 : 0;
  this.addPersons();
  this.relChart.generations = this.createGenerations();
  this.setFamilyLineTopBottoms();
  this.relChart.familyLines.sort(FamilyLine.prototype.compare);
  this.relChart.calculatePositions();
  if (prevChart) {
    this.relChart.setPreviousPositions(prevChart);
  }
  this.relChart.setPositions();
  if (this.relChart.isEditable) {
    this.relChart.addGapDropZones();
  }

  if (imgOverlayToGx) {
    this.correlateHighlights(this.relChart.getGedcomX(), this.relGraphToGx, imgOverlayToGx);
    this.relChart.imgOverlayToGx = imgOverlayToGx; // remember this so it's available in 'prevRelChart' when an update happens.
  }

  return this.relChart;
};
