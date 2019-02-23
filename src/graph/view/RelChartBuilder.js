/*
  Functions for construction a RelationshipChart from a RelationshipGraph, placing boxes in their order and generations, and creating family lines.
  RelationshipChart itself does the calculation of actual vertical offsets.
 */

RelChartBuilder.prototype.resetRemainingPersons = function() {
  var p;
  for (p = 0; p < this.relChart.relGraph.personNodes.length; p++) {
    this.remainingPersonIds.add(this.relChart.relGraph.personNodes[p].personId);
  }
};

// Get the next remaining person who is a principal person in the relGraph, if any. Otherwise, get the next remaining person.
RelChartBuilder.prototype.getNextRemainingPerson = function() {
  var p, personNode;
  for (p = 0; p < this.relChart.relGraph.principals.length; p++) {
    personNode = this.relChart.relGraph.principals[p];
    if (this.remainingPersonIds.contains(personNode.personId)) {
      return personNode.personId;
    }
  }
  // No principals, so return the first personNode in 'remaining'.
  return this.remainingPersonIds.getFirst();
};

// Get the Generation object with the given generationNumber from the generationMap, creating and adding it to the map if needed.
RelChartBuilder.prototype.getGen = function(generationNumber) {
  var generation = this.generationMap[generationNumber];
  if (!generation) {
    generation = new Generation(generationNumber, this.relChart);
    this.generationMap[generationNumber] = generation;
  }
  return generation;
};

/**
 * Tell whether the given family has only one person (or less).
 * @param familyNode - FamilyNode to check
 * @return true if the family has only one person (or zero); false if the family has multiple people
 */
RelChartBuilder.prototype.familyHasOnlyOnePerson = function(familyNode) {
  var numPersons = 0;
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
  var personNode = personBox.personNode;
  var spouseFamilies = personNode.spouseFamilies;
  var f;
  var spouseFamily;
  var spouseFamilyLine;
  var spouse; // PersonNode
  var spouseBox;
  var direction;
  var children;
  var childGeneration;
  var c, childBox;

  if (!isEmpty(spouseFamilies)) {
    for (f = 0; f < spouseFamilies.length; f++) {
      spouseFamily = spouseFamilies[f];
      if (this.familyHasOnlyOnePerson(spouseFamily)) {
        continue; // don't bother creating family lines that will not connect anyone
      }
      if (!this.relChart.familyLineMap[spouseFamily.familyId]) {
        spouseFamilyLine = new FamilyLine(spouseFamily, personBox.generation, this.relChart.$familyLinesDiv);
        this.relChart.familyLineMap[spouseFamily.familyId] = spouseFamilyLine;
        this.relChart.familyLines.push(spouseFamilyLine);
        personBox.spouseLines.push(spouseFamilyLine);
        spouse = spouseFamily.getSpouse(personNode);
        direction = personNode.gender === GENDER_CODE_MALE ? this.BELOW : this.ABOVE;
        spouseBox = this.insert(direction, personBox, spouse, personBox.generation, spouseFamilyLine, null, needsRelativesQueue, subtree);
        if (personNode.gender === GENDER_CODE_MALE) {
          spouseFamilyLine.setFather(personBox);
          spouseFamilyLine.setMother(spouseBox);
        }
        else {
          spouseFamilyLine.setFather(spouseBox);
          spouseFamilyLine.setMother(personBox);
        }
        children = spouseFamily.children;
        if (children) {
          childGeneration = this.getGen(personBox.generation.index - 1);
          if (personNode.gender === GENDER_CODE_MALE) {
            // Insert children below the person (i.e., the father), from last to first
            var childBoxes = [];
            for (c = children.length - 1; c >= 0; c--) {
              childBox = this.insert(direction, personBox, children[c], childGeneration, null, spouseFamilyLine, needsRelativesQueue, subtree);
              childBoxes.push(childBox);
            }
            // Reverse the list of children and then add them all to the spouse family line so they'll be in the right order
            childBoxes.reverse();
            for (c = 0; c < childBoxes.length; c++) {
              spouseFamilyLine.addChild(childBoxes[c]);
            }
          }
          else {
            // Insert children above the person (i.e., the mother), from first to last
            for (c = 0; c < spouseFamily.children.length; c++) {
              childBox = this.insert(direction, personBox, spouseFamily.children[c], childGeneration, null, spouseFamilyLine, needsRelativesQueue, subtree);
              spouseFamilyLine.addChild(childBox);
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
  var personNode = personBox.personNode;
  var parentFamilies = personNode.parentFamilies;
  var f, parentFamily;
  var parentFamilyLine;
  var parentGeneration;
  var fatherBox, motherBox; // PersonBoxes
  var children, c, child;
  var siblingBox, youngerSiblingBoxes;
  var personPosition;
  if (parentFamilies) {
    for (f = 0; f < parentFamilies.length; f++) {
      parentFamily = parentFamilies[f];
      if (this.familyHasOnlyOnePerson(parentFamily)) {
        // skip "empty" families that don't relate multiple people together.
        continue;
      }
      if (!this.relChart.familyLineMap[parentFamily.familyId]) {
        parentGeneration = this.getGen(personBox.generation.index + 1);
        parentFamilyLine = new FamilyLine(parentFamily, parentGeneration, this.relChart.$familyLinesDiv);
        this.relChart.familyLineMap[parentFamily.familyId] = parentFamilyLine;
        this.relChart.familyLines.push(parentFamilyLine);
        personBox.parentLines.push(parentFamilyLine);
        fatherBox = this.insert(this.ABOVE, personBox, parentFamily.father, parentGeneration, parentFamilyLine, null, needsRelativesQueue, subtree);
        motherBox = this.insert(this.BELOW, personBox, parentFamily.mother, parentGeneration, parentFamilyLine, null, needsRelativesQueue, subtree);
        parentFamilyLine.setFather(fatherBox);
        parentFamilyLine.setMother(motherBox);
        children = parentFamily.children;
        if (children) {
          personPosition = 0;
          // Add older siblings from oldest to youngest
          do {
            child = children[personPosition++];
            if (child !== personNode) {
              siblingBox = this.insert(this.ABOVE, personBox, child, personBox.generation, null, parentFamilyLine, needsRelativesQueue, subtree);
              parentFamilyLine.addChild(siblingBox);
            }
          } while (personPosition < children.length && child !== personNode);

          // Add the person to the parent family line's child list
          parentFamilyLine.addChild(personBox);

          // Insert younger siblings below the person from youngest to oldest
          youngerSiblingBoxes = [];
          for (c = children.length - 1; c >= personPosition; c--) {
            child = children[c];
            if (child === personNode) {
              throw "Error: person appears in child list twice.";
            }
            siblingBox = this.insert(this.BELOW, personBox, child, personBox.generation, null, parentFamilyLine, needsRelativesQueue, subtree);
            youngerSiblingBoxes.push(siblingBox);
          }
          // Add younger siblings to the family line from oldest to youngest so that the child list is in order
          for (c = youngerSiblingBoxes.length - 1; c >= 0; c--) {
            parentFamilyLine.addChild(youngerSiblingBoxes[c]);
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
  var needsRelativesQueue = [];
  do {
    personBox.subtree = subtree;

    this.addSpouses(personBox, subtree, needsRelativesQueue);
    this.addParents(personBox, subtree, needsRelativesQueue);

    personBox = needsRelativesQueue.length > 0 ? needsRelativesQueue.splice(0, 1)[0] : null;
  } while (personBox);
};

RelChartBuilder.prototype.getPersonNode = function(personId) {
  var personNode = this.relChart.relGraph.personNodeMap[personId];
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
  var personId, personNode; // PersonNode
  var previousBottom = null; // bottom box of previous disconnected sub-graph, if any
  var subtree = 1;
  var personBox;
  var topBox;

  this.resetRemainingPersons();
  do {
    // The first time through, use the primary person, if there is one; otherwise, use the first remaining person (who is disconnected from anyone already used).
    personId = this.getNextRemainingPerson();
    if (personId) {
      this.remainingPersonIds.remove(personId);
      personNode = this.getPersonNode(personId);
      personBox = new PersonBox(personNode, this.relChart.$personsDiv, null, null, this.getGen(0));
      this.relChart.personBoxMap[personNode.personId] = personBox;
      this.addRelatives(personBox, subtree++);
      // Find the first person box in this sub-graph
      topBox = null;
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
 * @return Array of Generation objects that were created, with person lists filled in.
 */
RelChartBuilder.prototype.createGenerations = function() {
  // Get the minimum value of any key in the given map (object). Assumes that the keys are numeric.
  function getMinKey(map) {
    var min = null;
    var key;
    for (key in map) {
      if (map.hasOwnProperty(key)) {
        if (min === null || key < min) {
          min = key;
        }
      }
    }
    return min;
  }

  // Get an array of the generations in the given map, with their generation indexes shifted so that the returned array
  //   has generation[index].index = index, and index goes from 0 to generation.length - 1.
  function shiftGenerations(generationMap) {
    //Todo: do this within each subtree so that each subtree has its leftmost person in generation. Otherwise it's sort of random.
    // Fix generation index so it starts at 0 (though it really doesn't matter)
    var minGenerationIndex = getMinKey(generationMap);
    var generations = [];
    var generationIndex;
    var generation;
    for (generationIndex in generationMap) {
      if (generationMap.hasOwnProperty(generationIndex)) {
        generation = generationMap[generationIndex];
        generation.index = generationIndex - minGenerationIndex;
        generations[generation.index] = generation;
      }
    }

    // Verify that the array has no empty spots and that the generation numbers are right
    for (generationIndex = 0; generationIndex < generations.length; generationIndex++) {
      if (!generations[generationIndex] || generations[generationIndex].index !== generationIndex) {
        throw "Error in generations array: Missing one, or an index is wrong.";
      }
    }
    return generations;
  }

  // Add each person box to the generation list that it is part of, and set its global position number.
  function addPersonsToGenerations(personBoxes) {
    var globalPosition = 0;
    var p;
    var personBox;

    for (p = 0; p < personBoxes.length; p++) {
      personBox = personBoxes[p];
      personBox.order = globalPosition++; // set the global order of this person
      personBox.generation.genPersons.push(personBox);
    }
  }

  function setGenerationPositions(generations) {
    // Set the genAbove/genBelow for each person within each generation
    var g, generation;
    var aboveInGen;
    var generationPosition;
    var p, personBox;

    for (g = 0; g < generations.length; g++) {
      generation = generations[g];
      aboveInGen = null;
      generationPosition = 0;
      for (p = 0; p < generation.genPersons.length; p++) {
        personBox = generation.genPersons[p];
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

  // Create an array of generations, with generation.index=0...numGenerations-1.
  var generations = shiftGenerations(this.generationMap);
  // Add PersonBoxes to each generation, and set their global positions.
  addPersonsToGenerations(this.relChart.personBoxes);
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
  var f, familyLine;
  for (f = 0; f < this.relChart.familyLines.length; f++) {
    familyLine = this.relChart.familyLines[f];
    familyLine.topPerson = familyLine.father ? familyLine.father : familyLine.children[0];
    familyLine.bottomPerson = familyLine.mother ? familyLine.mother : familyLine.children[familyLine.children.length - 1];
  }
};


/**
 * Insert a person above or below the given origPerson PersonBox.
 * @param isAbove - whether to insert above (true) or below (false)
 * @param origPerson - PersonBox above or below which to insert.
 * @param newPersonNode - PersonNode to insert into a new PersonBox.
 * @param generation - Generation that the new PersonBox will be in.
 * @param spouseFamilyLine -
 * @param parentFamilyLine -
 * @param needsRelativesQueue - Queue to add the new PersonBox to, since their relatives will need to be added as well.
 * @param subtree - Index of subtree that this person is being added to.
 * @return new PersonBox
 */
RelChartBuilder.prototype.insert = function(isAbove, origPerson, newPersonNode, generation,
                                            spouseFamilyLine, parentFamilyLine, needsRelativesQueue, subtree) {
  if (!newPersonNode) {
    return null;
  }
  var newPersonBox = isAbove ?
      this.insertAbove(origPerson, newPersonNode, generation) :
      this.insertBelow(origPerson, newPersonNode, generation);
  newPersonBox.subtree = subtree;
  if (this.remainingPersonIds.contains(newPersonNode.personId)) {
    // This is the first time this person was added to the chart, so add it to the map and make sure we recurse on its relatives.
    this.remainingPersonIds.remove(newPersonNode.personId);
    this.relChart.personBoxMap[newPersonNode.personId] = newPersonBox;
    needsRelativesQueue.push(newPersonBox);
  }
  else {
    // We've already seen this person
    newPersonBox.duplicateOf = this.relChart.personBoxMap[newPersonNode.personId];
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
 * @param generation - generation to add the new person into
 * @return PersonBox that was created
 */
RelChartBuilder.prototype.insertAbove = function(origPerson, newPerson, generation) {
  var newPersonBox = new PersonBox(newPerson, this.relChart.$personsDiv, origPerson.above, origPerson, generation, this.shouldIncludeDetails);
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
 * @param generation - generation to add the new person into
 * @return PersonBox that was created
 */
RelChartBuilder.prototype.insertBelow = function(origPerson, newPerson, generation) {
  var newPersonBox = new PersonBox(newPerson, this.relChart.$personsDiv, origPerson, origPerson.below, generation, this.shouldIncludeDetails);
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
 * @param $personsDiv - JQuery object for div with "#persons"
 * @param $familyLinesDiv - JQuery object for the div with "#familyLines"
 * @param shouldIncludeDetails - Whether to include alternate names and facts in the chart initially.
 * @param shouldCompress - Whether to do collapsing initially.
 */
function RelChartBuilder(relGraph, $personsDiv, $familyLinesDiv, shouldIncludeDetails, shouldCompress) {

  // Create a chart with PersonBoxes created, but no FamilyLines or Generations yet.
  this.relChart = new RelationshipChart(relGraph, $personsDiv, $familyLinesDiv, shouldIncludeDetails, shouldCompress);

  this.ABOVE = true;
  this.BELOW = false;
  // Set of personIds remaining to be added to the chart.
  this.remainingPersonIds = new LinkedHashSet();
  // Set of personIds for PersonBoxes that are 'duplicates' of a box that already appeared elsewhere in the graph
  this.duplicateBoxes = [];
  this.generationMap = {}; // Map of generation index to Generation. (In relChart, it is a simple 0-based array, so no map is needed.)
}

/**
 * Build a relationship chart (RelChart) from a relationship graph, starting at the given person.
 * @return RelationshipChart built from the given graph starting with the given person
 */
RelChartBuilder.prototype.buildChart = function() {
  this.relChart.$personsDiv.empty();
  this.relChart.$familyLinesDiv.empty();
  this.addPersons();
  this.relChart.generations = this.createGenerations();
  this.setFamilyLineTopBottoms();
  this.relChart.familyLines.sort(FamilyLine.prototype.compare);
  this.relChart.calculatePositions();
  this.relChart.setPositions();
};