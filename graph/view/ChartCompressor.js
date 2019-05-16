/*
  Utility functions for compressing a RelationshipChart to make efficient use of white space.
 */

// === BumpGroup ===============================================
BumpGroup.prototype.addAll = function(otherGroup) {
  this.personBoxIds.addAll(otherGroup.personBoxIds);
  this.frontBoxIds.addAll(otherGroup.frontBoxIds);
};

BumpGroup.prototype.add = function(personBoxId) {
  this.personBoxIds.add(personBoxId);
  this.frontBoxIds.add(personBoxId);
};

// Return true if this BumpGroup contains the given person (in its persons set), or else false/null/undefined otherwise.
BumpGroup.prototype.contains = function(personId) {
  return this.personBoxIds.contains(personId);
};

BumpGroup.prototype.getSize = function() {
  return this.personBoxIds.getSize();
};

function BumpGroup() {
  // set of personBoxIds in the group
  this.personBoxIds = new LinkedHashSet();
  // personBoxIds at the "front" (as in "storm front"), i.e., person boxes who could still bump into someone who
  //   isn't already in the group.  The front is typically much smaller than the full set of person boxes, once the
  //   group gets large.  So having a front helps avoid O(n^2) comparisons.
  this.frontBoxIds = new LinkedHashSet();
}

ChartCompressor.prototype.clear = function(object) {
  if (object) {
    var key;
    for (key in object) {
      if (object.hasOwnProperty(key)) {
        delete object[key];
      }
    }
  }
};

// === ChartCompressor ===================================

function ChartCompressor(relChart) {
  this.relChart = relChart;
}

/**
 * Check for whether the given person bumps into the 'other' person at least as early as 'minMove'.
 * @param personBox - PersonBox to check
 * @param otherBox - other PersonBox that 'person' might bump into
 * @param bumpedSet - "LinkedHashSet" of personIDs that all have the same distance to their nearest 'bump', namely, minMove.
 * @param minMove - Object containing "value" element, which is smallest amount that 'group' can move before bumping into someone who isn't in the group.
 *                  null => no constraint found yet. "value" may be updated.
 * @param group - "LinkedHashSet" of person IDs that is moving down the chart looking for who it might bump into.
 * @return Boolean: true if the 'other' person is not already part of 'group' (and thus should remain part of group's "front")
 */
ChartCompressor.prototype.checkBump = function(personBox, otherBox, bumpedSet, minMove, group) {
  if (!otherBox || group.contains(otherBox.personBoxId)) {
    // There is nobody there, or the person is already part of this group, so just return
    return false;
  }
  var extraSpace;
  if (personBox.generation === otherBox.generation) {
    // Persons are in the same generation, so compare the bottom of one (+ vertical gap) to the top of the other.
    extraSpace = otherBox.getTop() - personBox.getBelow() - this.relChart.verticalGap - this.relChart.subtreeGap(personBox, otherBox);
  }
  else {
    // Persons are in different generations (parent/child), so compare the center of one (+ generation gap)
    //  to the center of the other.
    extraSpace = otherBox.getCenter() - personBox.getCenter() - this.relChart.generationGap;
  }
  // Correct for javascript rounding errors.
  if (extraSpace > -0.1 && extraSpace < 0.1) {
    extraSpace = 0;
  }
  if (extraSpace < 0) {
    throw "Violated constraints between " + personBox.personBoxId + " and " + otherBox.personBoxId + " (extra space < 0)";
  }
  if (minMove.value === -1 || extraSpace < minMove.value) {
    // New "closest" bump, so reset the bumped set and add the bumped person to it
    minMove.value = extraSpace;
    bumpedSet.clear();
    bumpedSet.add(otherBox.personBoxId);
  }
  else if (extraSpace === minMove.value) {
    // Tied for "closest" bump, so add the bumped person to it
    bumpedSet.add(otherBox.personBoxId);
  }
  return true;
};

/**
 *
 * @param bumpGroup - BumpGroup, a group of persons all trying to move down by the same amount.
 * @param bumpedSet - Set of personIds that the people in BumpGroup bumped into at a distance of 'minMove' (which is returned).
 * @return minMove, the number of pixels that can be moved before someone in bumpGroup hits someone else.
 */
ChartCompressor.prototype.tryBump = function(bumpGroup, bumpedSet) {
  var g, groupie; // PersonBox that is a member of the BumpGroup being moved.
  var inFront;
  var f, familyLine;
  var removeSet = new LinkedHashSet(); // set of person IDs to remove from group.front. (Wait to avoid modifying group while iterating through it).
  var minMove = new IntegerByRef(-1);

  for (g = 0; g < bumpGroup.frontBoxIds.getSize(); g++) {
    var groupPersonId = bumpGroup.frontBoxIds.values[g];
    groupie = this.relChart.personBoxMap[groupPersonId];

    // Look to see how far this person can move down before violating a constraint

    // Flag for whether this person should be in the "front" of its group, i.e., set this to true if
    //   this person could possibly bump into someone below that is not part of this group.
    inFront = false;

    // Check for bumping into a person below in the same generation
    inFront |= this.checkBump(groupie, groupie.genBelow, bumpedSet, minMove, bumpGroup);

    // Check for a father bumping into oldest child in previous generation
    if (!isEmpty(groupie.spouseLines)) {
      for (f = 0; f < groupie.spouseLines.length; f++) {
        familyLine = groupie.spouseLines[f];
        if (groupie === familyLine.father && !isEmpty(familyLine.children)) {
          inFront |= this.checkBump(groupie, familyLine.children[0], bumpedSet, minMove, bumpGroup);
        }
      }
    }
    // Check for a child bumping into mother in next generation
    if (!isEmpty(groupie.parentLines)) {
      for (f = 0; f < groupie.parentLines.length; f++) {
        familyLine = groupie.parentLines[f];
        if (groupie === familyLine.children[familyLine.children.length - 1]) {
          inFront |= this.checkBump(groupie, familyLine.mother, bumpedSet, minMove, bumpGroup);
        }
      }
    }
    if (!inFront) {
      // The person cannot bump into anyone who is not already in the group, so it does not need to be part of
      //   the "front" that is checked for collisions.
      removeSet.add(groupie.personBoxId);
    }
  }

  // Remove any persons from group.front that cannot bump into anyone who is not already in the group.
  bumpGroup.frontBoxIds.removeAll(removeSet);
  return minMove.get();
};

ChartCompressor.prototype.moveHusbandsDown = function(personBoxes) {
  // Look to see if any husbands can be moved down.
  // Start at the bottom so that if someone is moved down, someone else might be able to be moved down, too.
  var reverseList = personBoxes.slice().reverse(); // copy the array and reverse it.
  var p, personBox;
  var f, familyLine;
  var y, minY;
  var isFather;

  for (p = 0; p < reverseList.length; p++) {
    personBox = reverseList[p];
    if (!isEmpty(personBox.spouseLines)) {
      minY = null; // minimum y that the center of personBox could be moved down to without violating a constraint.
      isFather = false;

      // Check for a father bumping into oldest child in previous generation
      for (f = 0; f < personBox.spouseLines.length; f++) {
        familyLine = personBox.spouseLines[f];
        if (personBox === familyLine.father) {
          isFather = true;
          if (!isEmpty(familyLine.children)) {
            // This person has children, so see where the highest one is.
            y = familyLine.children[0].getCenter() - this.relChart.generationGap;
            if (!minY || y < minY) {
              minY = y;
            }
          }
        }
      }

      if (isFather) { // Person was a father, so might get moved down, so check remaining constraints.
        // See where the highest constraint is on "mother below"
        if (!isEmpty(personBox.parentLines)) {
          for (f = 0; f < personBox.parentLines.length; f++) {
            familyLine = personBox.parentLines[f];
            if (familyLine.mother) {
              y = familyLine.mother.getCenter() - this.relChart.generationGap;
              if (!minY || y < minY) {
                minY = y;
              }
            }
          }
        }

        // See where next person in the same generation is
        if (personBox.genBelow) {
          y = personBox.genBelow.getTop() - this.relChart.verticalGap - (personBox.getBelow() - personBox.getCenter());
          if (!minY || y < minY) {
            minY = y;
          }
        }

        if (!minY && minY > personBox.getCenter()) {
          personBox.move(minY - personBox.getCenter());
        }
      }
    }
  }
};

ChartCompressor.prototype.checkPersonPosition = function(personBox, otherBox, message) {
  if (otherBox) {
    var extraSpace;
    if (personBox.generation === otherBox.generation) {
      // Persons are in the same generation, so compare the bottom of one (+ vertical gap) to the top of the other.
      extraSpace = otherBox.getTop() - personBox.getBelow() - this.relChart.verticalGap;
    }
    else {
      // Persons are in different generations (parent/child), so compare the center of one (+ generation gap)
      //  to the center of the other.
      extraSpace = otherBox.getCenter() - personBox.getCenter() - this.relChart.generationGap;
    }
    if (extraSpace < 0) {
      throw "Error--Violated constraints between " + personBox.personBoxId + " and " + otherBox.personBoxId + ": " + message;
    }
  }
};

ChartCompressor.prototype.checkFamilyLinePositions = function(familyLine) {
  var i, childBox;

  if (familyLine.father && familyLine.topPerson !== familyLine.father) {
    throw "Error: Father isn't top person in family line";
  }
  if (familyLine.mother && familyLine.bottomPerson !== familyLine.mother) {
    throw "Error: Mother isn't bottom person in family line";
  }
  if (familyLine.children) {
    for (i = 1; i < familyLine.children.length; i++) {
      childBox = familyLine.children[i];
      if (childBox.getCenter() < familyLine.children[i - 1].getCenter()) {
        throw "Error: Children out of order in family line";
      }
      if (childBox.getCenter() < familyLine.topPerson.getCenter()) {
        throw "Error: Child above top person in family line";
      }
      if (childBox.getCenter() > familyLine.bottomPerson.getCenter()) {
        throw "Error: Child below bottom person in family line";
      }
    }
  }
};

ChartCompressor.prototype.checkPositions = function(personBoxes) {
  var p, personBox;
  var f, familyLine;
  for (p = 0; p < personBoxes.length; p++) {
    personBox = personBoxes[p];
    // Check for bumping into a person below in the same generation
    this.checkPersonPosition(personBox, personBox.genBelow, "gen below");

    // Check for a father bumping into oldest child in previous generation
    if (personBox.spouseLines) {
      for (f = 0; f < personBox.spouseLines.length; f++) {
        familyLine = personBox.spouseLines[f];
        if (personBox === familyLine.father && !isEmpty(familyLine.children)) {
          this.checkPersonPosition(personBox, familyLine.children[0], "father to oldest child");
        }
        this.checkFamilyLinePositions(familyLine);
      }
    }
    // Check for a child bumping into mother in next generation
    if (!isEmpty(personBox.parentLines)) {
      for (f = 0; f < personBox.parentLines.length; f++) {
        familyLine = personBox.parentLines[f];
        if (personBox === familyLine.children[familyLine.children.length - 1]) {
          this.checkPersonPosition(personBox, familyLine.mother, "youngest child to mother");
          this.checkFamilyLinePositions(familyLine);
        }
      }
    }
  }
};

/**
 * Slide the whole graph up or down so that the top of the uppermost person is at y=4
 * @param personBoxes - list of person boxes to translate
 */
ChartCompressor.prototype.translateVertical = function(personBoxes) {
  var minY = null;
  var p, personBox;
  var dy;

  for (p = 0; p < personBoxes.length; p++) {
    personBox = personBoxes[p];
    if (!minY || personBox.top < minY) {
      minY = personBox.top;
    }
  }

  if (minY) {
    dy = 4 - minY;

    for (p = 0; p < personBoxes.length; p++) {
      personBox = personBoxes[p];
      personBox.move(dy);
    }
  }
};

ChartCompressor.prototype.pushPeopleDown = function(personBoxes) {
  // Map of personBox.personBoxId to the BumpGroup that that PersonBox become part of.
  var bumpGroupMap = {};

  // Go through the list of persons.  Move each person down as far as possible until a constraint is violated,
  //   starting with the top person.  When it "bumps into" other people, add those people to the "group" and
  //   then keep trying to move the whole group down to where it "bumps into" other people.  Continue this until
  //   all the people are in the group, or the group is not bumping into anyone else.
  // When the group bumps into a person that is already part of another group, then the two groups merge,
  //   and the process continues.
  var p, personBox;
  var bumpGroup, groupie, g;

  for (p = 0; p < personBoxes.length; p++) {
    personBox = personBoxes[p];
    if (bumpGroupMap[personBox.personBoxId]) {
      // This person is already part of a group, so skip it.
      continue;
    }
    bumpGroup = new BumpGroup();
    bumpGroup.add(personBox.personBoxId); // add the top person

    do {
      // LinkedHashSet of personBoxIds that are all bumped into at the same distance of 'minMove'
      var bumpedSet = new LinkedHashSet();

      // Try moving everyone in "bumpGroup" (which is just the current personBox the first time through)
      //   down until at least one person in the group bumps into someone at a distance of 'minMove'.
      // 'bumpedSet' is filled with the persons who are bumped into.
      // 'bumpGroup' is modified so that its 'front' no longer contains people who can no longer bump into anyone and thus don't need to be checked for collisions.
      var minMove = this.tryBump(bumpGroup, bumpedSet);

      if (minMove > 0) {
        // Move all the PersonBoxes in the group up or down by minMove.
        for (g = 0; g < bumpGroup.personBoxIds.values.length; g++) {
          groupie = this.relChart.personBoxMap[bumpGroup.personBoxIds.values[g]];
          groupie.move(minMove);
        }
      }

      if (minMove >= 0) {
        var bumpedPersonBoxId;
        var b;
        for (b = 0; b < bumpedSet.values.length; b++) {
          bumpedPersonBoxId = bumpedSet.values[b];
          var otherBumpGroup = bumpGroupMap[bumpedPersonBoxId];
          if (otherBumpGroup) {
            var i;
            // The person box we bumped into was part of an earlier group, so lump all those into this group now.
            for (i = 0; i < otherBumpGroup.personBoxIds.length; i++) {
              // Remove them from the map, because we will add them all back in when the entire group is added.
              delete bumpGroupMap[otherBumpGroup.personBoxIds[i]];
            }
            bumpGroup.addAll(otherBumpGroup);
          }
          else {
            bumpGroup.add(bumpedPersonBoxId);
          }
        }
      }
    } while (!bumpedSet.isEmpty() && bumpGroup.getSize() < personBoxes.length);

    // At this point, the 'bumpGroup' has nobody left to push on, so put it into the group map
    for (g = 0; g < bumpGroup.personBoxIds.values.length; g++) {
      var pid = bumpGroup.personBoxIds.values[g];
      bumpGroupMap[pid] = bumpGroup;
    }
  }

  // Make sure everyone ended up in the bumpGroupMap.
  var numHandled = 0;
  var personBoxId;
  for (personBoxId in bumpGroupMap) {
    if (bumpGroupMap.hasOwnProperty(personBoxId)) {
      numHandled++;
    }
  }
  if (numHandled !== personBoxes.length) {
    throw "Some people didn't end up in the map!";
  }
};

/**
 * Compress the vertical position of the given array of personBoxes by attempting to slide them together.
 * @param personBoxes - Array of PersonBox to compress.
 */
ChartCompressor.prototype.compressGraph = function(personBoxes) {
  // Group of people who are marching down the graph as one big group, having bumped into each other so far.

  this.pushPeopleDown(personBoxes);

  this.moveHusbandsDown(personBoxes);
  try {
    this.checkPositions(personBoxes);
  }
  catch (err) {
    console.log(err);
  }
  this.translateVertical(personBoxes);
};
