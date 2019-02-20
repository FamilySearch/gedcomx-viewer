// /*
//   Utility functions for compressing a RelationshipChart to make efficient use of white space.
//  */
//
// function ChartCompressor(relChart) {
//   this.relChart = relChart;
// }
//
// BumpGroup.prototype.addAll = function(otherGroup) {
//   this.persons.addAll(otherGroup.persons);
//   this.front.addAll(otherGroup.front);
// };
//
// BumpGroup.prototype.add = function(person) {
//   this.persons.add(person);
//   this.front.add(person);
// };
//
// // Return true if this BumpGroup contains the given person (in its persons set), or else false/null/undefined otherwise.
// BumpGroup.prototype.contains = function(person) {
//   return this.persons.contains(person);
// };
//
// BumpGroup.prototype.size = function() {
//   return this.persons.size();
// };
//
// function BumpGroup() {
//   // set of PersonBox in the group (map of PersonBox to "true")
//   this.persons = new LinkedHashSet();
//   // Persons at the "front" (as in "storm front"), i.e., persons who could still bump into someone who
//   //   isn't already in the group.  The front is typically much smaller than the full set of persons, once the
//   //   group gets large.  So having a front helps avoid O(n^2) comparisons.
//   this.front = new LinkedHashSet();
//   this.size = 0;
// }
//
// ChartCompressor.prototype.clear = function(object) {
//   if (object) {
//     var key;
//     for (key in object) {
//       if (object.hasOwnProperty(key)) {
//         delete object[key];
//       }
//     }
//   }
// };
//
// /**
//  * Check for whether the given person bumps into the 'other' person at least as early as 'minMove'.
//  * @param person - PersonBox to check
//  * @param other - other PersonBox that 'person' might bump into
//  * @param bumpedSet - "LinkedHashSet" of PersonBoxes that all have the same distance to their nearest 'bump', namely, minMove.
//  * @param minMove - Object containing "value" element, which is smallest amount that 'group' can move before bumping into someone who isn't in the group.
//  *                  -1 => no constraint found yet. "value" may be updated.
//  * @param group - group of persons that is moving down the chart looking for who it might bump into.
//  * @return Boolean: true if the 'other' person is not already part of 'group' (and thus should remain part of group's "front")
//  */
// ChartCompressor.prototype.checkBump = function(person, other, bumpedSet, minMove, group) {
//   if (!other || group.contains(other)) {
//     // There is nobody there, or the person is already part of this group, so just return
//     return false;
//   }
//   var extraSpace;
//   if (person.generation === other.generation) {
//     // Persons are in the same generation, so compare the bottom of one (+ vertical gap) to the top of the other.
//     extraSpace = other.top - person.bottom - this.relChart.verticalGap - this.relChart.subtreeGap(person, other);
//   }
//   else {
//     // Persons are in different generations (parent/child), so compare the center of one (+ generation gap)
//     //  to the center of the other.
//     extraSpace = other.center - person.center - this.relChart.generationGap;
//   }
//   if (extraSpace < 0) {
//     throw "Violated constraints between " + person.toString() + " and " + other.toString();
//   }
//   if (minMove.value === -1 || extraSpace < minMove.value) {
//     // New "closest" bump, so reset the bumped set and add the bumped person to it
//     minMove.value = extraSpace;
//     bumpedSet.clear();
//     bumpedSet.add(other);
//   }
//   else if (extraSpace === minMove.value) {
//     // Tied for "closest" bump, so add the bumped person to it
//     bumpedSet.add(other);
//   }
//   return true;
// };
//
// ChartCompressor.prototype.compressGraph = function(personBoxes) {
//   // Group of people who are marching down the graph as one big group, having bumped into each other so far.
//   // Map of PersonBox to the BumpGroup that they have become part of
//   //Map<PersonBox, BumpGroup> groupMap = new LinkedHashMap<PersonBox, BumpGroup>();
//   var groupMap = {};
//
//   // Go through the list of persons.  Move each person down as far as possible until a constraint is violated,
//   //   starting with the top person.  When it "bumps into" other people, add those people to the "group" and
//   //   then keep trying to move the whole group down to where it "bumps into" other people.  Continue this until
//   //   all the people are in the group, or the group is not bumping into anyone else.
//   // When the group bumps into a person that is already part of another group, then the two groups merge,
//   //   and the process continues.
//   var p, person;
//   // LinkedHashSet of PersonBoxes that are all bumped into at the same distance of 'minMove'
//   var bumpedSet = new LinkedHashSet();
//   var removeSet = new LinkedHashSet();
//   var minMove;
//   var groupie;
//   var inFront;
//   var f, familyLine;
//   var group;
//
//   for (p = 0; p < personBoxes.length; p++) {
//     person = personBoxes[p];
//     if (groupMap[person]) {
//       // This person is already part of a group, so skip it.
//       continue;
//     }
//     group = new BumpGroup();
//     group.add(person); // add the top person
//
//     do {
//       minMove = new IntegerByRef(-1);
//       bumpedSet.clear();
//       removeSet.clear(); // set of person boxes to remove from group.front. (Wait to avoid modifying group while iterating through it).
//       for (groupie in group.front) {
//         if (!group.front.hasOwnProperty(groupie)) {
//           continue;
//         }
//         // Look to see how far this person can move down before violating a constraint
//
//         // Flag for whether this person should be in the "front" of its group, i.e., set this to true if
//         //   this person could possibly bump into someone below that is not part of this group.
//         inFront = false;
//
//         // Check for bumping into a person below in the same generation
//         inFront |= this.checkBump(groupie, groupie.genBelow, bumpedSet, minMove, group);
//
//         // Check for a father bumping into oldest child in previous generation
//         if (groupie.spouseLines) {
//           for (f = 0; f < groupie.spouseLines; f++) {
//             familyLine = groupie.spouseLines[f];
//             if (groupie === familyLine.father && !isEmpty(familyLine.children)) {
//               inFront |= this.checkBump(groupie, familyLine.children[0], bumpedSet, minMove, group);
//             }
//           }
//         }
//         // Check for a child bumping into mother in next generation
//         if (groupie.parentLines) {
//           for (f = 0; f < groupie.parentLines; f++) {
//             if (groupie === familyLine.children[familyLine.children.length - 1]) {
//               inFront |= this.checkBump(groupie, familyLine.mother, bumpedSet, minMove, group);
//             }
//           }
//         }
//         if (!inFront) {
//           // The person cannot bump into anyone who is not already in the group, so it does not need to be part of
//           //   the "front" that is checked for collisions.
//           removeSet.add(groupie);
//         }
//       }
//
//       // Remove any persons from group.front that cannot bump into anyone who is not already in the group.
//       for (groupie in removeSet.values()) {
//         if (removeSet.map.hasOwnProperty(groupie)) {
//           delete group.front[groupie];
//         }
//       }
// //        System.out.println("Groupies: (" + group.size() + "/" + personBoxes.size() + "). FrontSize=" + group.getFront().size() + ".");
// //        for (PersonBox personBox : group.getPersons()) {
// //          System.out.println("  " + personBox.toString());
// //        }
// //        System.out.println("Bump set (minMove = " + minMove.get() + ")");
// //        for (PersonBox personBox : bumpedSet) {
// //          System.out.println("  " + personBox.toString());
// //        }
//
//       if (minMove.get() > 0) {
//         // Move all the PersonBoxes in the group up or down by 'minMove.get()'.
//         for (groupie in group.persons) {
//           if (group.persons.hasOwnProperty(groupie)) {
//             groupie.move(minMove.get());
//           }
//         }
//       }
//
//       if (minMove.get() >= 0) {
//         var bumpedPerson;
//         for (bumpedPerson in bumpedSet.values()) {
//           if (bumpedSet.map.hasOwnProperty(bumpedPerson)) {
//             var otherGroup = groupMap[bumpedPerson];
//             if (otherGroup) {
//               var otherGroupPerson;
//               // The person we bumped into was part of an earlier group, so lump all those into this group now.
//               for (otherGroupPerson in otherGroup.persons.values()) {
//                 if (otherGroup.persons.map.hasOwnProperty(otherGroupPerson)) {
//                   // Remove them from the map, because we will add them all back in when the entire group is added.
//                   delete groupMap[otherGroupPerson];
//                 }
//               }
//               group.addAll(otherGroup);
//             }
//             else {
//               group.add(bumpedPerson);
//             }
//           }
//         }
//       }
//     } while (!bumpedSet.isEmpty() && group.size() < personBoxes.size());
//     // At this point, the 'group' has nobody left to push on, so put it into the group map
//     for (PersonBox groupie : group.getPersons()) {
//       groupMap.put(groupie, group);
//     }
//   }
//   if (groupMap.size() != personBoxes.size()) {
//     throw new IllegalStateException("Some people didn't end up in the map!");
//   }
//
//   // Look to see if any husbands can be moved down.
//   List<PersonBox> reverseList = new ArrayList<PersonBox>(personBoxes);
//   // Start at the bottom so that if someone is moved down, someone else might be able to be moved down, too.
//   Collections.reverse(reverseList);
//   for (PersonBox personBox : reverseList) {
//     if (personBox.getSpouseLines() != null) {
//       Integer minY = null; // minimum y that the center of personBox could be moved down to without violating a constraint.
//       boolean isFather = false;
//
//       // Check for a father bumping into oldest child in previous generation
//       for (FamilyLine familyLine : personBox.getSpouseLines()) {
//         if (personBox == familyLine.getFather()) {
//           isFather = true;
//           if (familyLine.getChildren() != null && familyLine.getChildren().size() > 0) {
//             // This person has children, so see where the highest one is.
//             int y = familyLine.getChildren().get(0).getCenter() - generationGap;
//             if (minY == null || y < minY) {
//               minY = y;
//             }
//           }
//         }
//       }
//
//       if (isFather) { // Person was a father, so might get moved down, so check remaining constraints.
//         // See where the highest constraint is on "mother below"
//         if (personBox.getParentLines() != null) {
//           for (FamilyLine familyLine : personBox.getParentLines()) {
//             if (familyLine.getMother() != null) {
//               int y = familyLine.getMother().getCenter() - generationGap;
//               if (minY == null || y < minY) {
//                 minY = y;
//               }
//             }
//           }
//         }
//
//         // See where next person in generation is
//         if (personBox.getGenBelow() != null) {
//           int y = personBox.getGenBelow().top - verticalGap - (personBox.bottom - personBox.getCenter());
//           if (minY == null || y < minY) {
//             minY = y;
//           }
//         }
//
//         if (minY != null && minY > personBox.getCenter()) {
//           move(personBox, minY - personBox.getCenter());
//         }
//       }
//     }
//   }
//
//   checkPositions(personBoxes);
//   translateVertical(personBoxes);
// }
//
// private static void checkPositions(Collection<PersonBox> personBoxes) {
//   for (PersonBox personBox : personBoxes) {
//     // Check for bumping into a person below in the same generation
//     checkPositions(personBox, personBox.getGenBelow(), "gen below");
//
//     // Check for a father bumping into oldest child in previous generation
//     if (personBox.getSpouseLines() != null) {
//       for (FamilyLine familyLine : personBox.getSpouseLines()) {
//         if (personBox == familyLine.getFather() && familyLine.getChildren() != null && familyLine.getChildren().size() > 0) {
//           checkPositions(personBox, familyLine.getChildren().get(0), "father to oldest child");
//         }
//         checkPositions(familyLine);
//       }
//     }
//     // Check for a child bumping into mother in next generation
//     if (personBox.getParentLines() != null) {
//       for (FamilyLine familyLine : personBox.getParentLines()) {
//         if (personBox == familyLine.getChildren().get(familyLine.getChildren().size() - 1)) {
//           checkPositions(personBox, familyLine.getMother(), "youngest child to mother");
//           checkPositions(familyLine);
//         }
//       }
//     }
//   }
// }
//
// private static void checkPositions(PersonBox person, PersonBox other, String message) {
//   if (other != null) {
//     int extraSpace;
//     if (person.generation == other.generation) {
//       // Persons are in the same generation, so compare the bottom of one (+ vertical gap) to the top of the other.
//       extraSpace = other.top - person.bottom - verticalGap;
//     }
//     else {
//       // Persons are in different generations (parent/child), so compare the center of one (+ generation gap)
//       //  to the center of the other.
//       extraSpace = other.getCenter() - person.getCenter() - generationGap;
//     }
//     if (extraSpace < 0) {
//       System.out.println("Error--Violated constraints between " + person.toString() + " and " + other.toString() + ": " + message);
//     }
//   }
// }
//
// private static int getHalfHeight(PersonBox box) {
//   return (box.top - box.bottom) / 2;
// }
//
// private static void checkPositions(FamilyLine familyLine) {
//   if (familyLine.getFather() != null && familyLine.getTopPerson() != familyLine.getFather()) {
//     System.out.println("Error: Father isn't top person in family line");
//   }
//   if (familyLine.getMother() != null && familyLine.getBottomPerson() != familyLine.getMother()) {
//     System.out.println("Error: Mother isn't bottom person in family line");
//   }
//   if (familyLine.getChildren() != null) {
//     for (int i = 1; i < familyLine.getChildren().size(); i++) {
//       PersonBox child = familyLine.getChildren().get(i);
//       if (child.getCenter() < familyLine.getChildren().get(i - 1).getCenter()) {
//         System.out.println("Error: Children out of order in family line");
//       }
//       if (child.getCenter() < familyLine.getTopPerson().getCenter()) {
//         System.out.println("Error: Child above top person in family line");
//       }
//       if (child.getCenter() > familyLine.getBottomPerson().getCenter()) {
//         System.out.println("Error: Child below bottom person in family line");
//       }
//     }
//   }
// }
// /**
//  * Slide the whole graph up or down so that the top of the uppermost person is at y=4
//  * @param personBoxes - list of person boxes to translate
//  */
// private static void translateVertical(List<PersonBox> personBoxes) {
//   Integer minY = null;
//   for (PersonBox personBox : personBoxes) {
//     if (minY == null || personBox.top < minY) {
//       minY = personBox.top;
//     }
//   }
//   if (minY == null) {
//     return; // no persons to translate
//   }
//   int delta = 4 - minY;
//
//   for (PersonBox personBox : personBoxes) {
//     move(personBox, delta);
//   }
// }
//
//
// private static int subtreeGap(PersonBox above, PersonBox below) {
//   if (above != null && below != null && above.generation.equals(below.generation)) {
//     // Put a small vertical gap between different subtrees
//     if (below.getSubtree() != above.getSubtree()) {
//       return treeGap;
//     }
//     // Also put a small vertical gap between a couple and adjacent siblings.
//     if (hasDifferentSpouse(below, above)) {
//       return treeGap;
//     }
//   }
//   return 0;
// }
//
// // Tell whether a has a spouse that is not b
// private static boolean hasDifferentSpouse(PersonBox personBox1, PersonBox personBox2) {
//   if (personBox1 == null || personBox2 == null) {
//     return false; // no need for gap if one person doesn't exist.
//   }
//
//   PersonNode person1 = personBox1.getPersonNode();
//   PersonNode person2 = personBox2.getPersonNode();
//   if (!isEmpty(person1.getSpouseFamilies())) {
//     for (FamilyNode spouseFamily : person1.getSpouseFamilies()) {
//       if (spouseFamily.getSpouse(person1) == person2) {
//         return false;
//       }
//     }
//     return true;
//   }
//   else if (!isEmpty(person2.getSpouseFamilies())) {
//     for (FamilyNode spouseFamily : person2.getSpouseFamilies()) {
//       if (spouseFamily.getSpouse(person2) == person1) {
//         return false;
//       }
//     }
//     return true;
//   }
//   else {
//     return false;
//   }
// }
