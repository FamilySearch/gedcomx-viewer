/*
  RelationshipGraph represents a graph of PersonNodes connected via FamilyNodes.
    It includes the genealogical information, but not the display layout.
  Members:
    gx - GedcomX document that this RelationshipGraph is derived from.
    personNodes: array of PersonNode objects for all the persons in the graph.
    familyNodes: array of FamilyNode objects for all the families in the graph.
    personMap: map of personId -> PersonNode
    familyMap: map of familyId -> FamilyNode
  Methods:
    getPerson(personId) - Return PersonNode for that personId
    getFamily(familyId) - Return FamilyNode for that familyId
 */

function addPersonNodes(graph) {
  if (graph.gx.persons) {
    var p;
    var personNode;
    for (p = 0; p < graph.gx.persons.length; p++) {
      personNode = new PersonNode(graph.gx.persons[p]);
      graph.personNodes[p] = personNode;
      graph.personNodeMap[personNode.personId] = personNode;
      if (graph.gx.persons[p].principal) {
        graph.principals.push(personNode);
      }
    }
  }
}

// Take a reference like "#p_1" or "http.../XXXX-YYY?blah" and return the person ID from it, i.e., "p_1" or "XXXX-YYY". If it is empty, return null.
function getPersonIdFromReference(ref) {
  if (ref && ref.resource && ref.resource.length > 0) {
    if (ref.resource.substring(0, 1) === "#") {
      return ref.resource.substring(1);
    }
    else {
      // Remove "?" and anything after it.
      var noParams = ref.resource.replace(/\?.*/, "");
      // Strip everything up to last "/", and then up to last ":" to go from "https://familysearch.org/ark:/61903/1:1:XXXX-YYY" to "1:1:XXXX-YYY" to "XXXX-YYY".
      // Also handle "https://familysearch.org/platform/records/personas/XXXX-YYY" (i.e., no "1:1:").
      return noParams.replace(/.*\//, "").replace(/.*:/, "");
    }
  }
  return null;
}

// Create a new FamilyNode and add it to the graph (i.e., to its array of familyNodes[] and to its familyMap).
function addFamily(graph, familyId, fatherNode, motherNode, coupleRelationship) {
  var familyNode = new FamilyNode(familyId, fatherNode, motherNode, coupleRelationship);
  graph.familyNodes.push(familyNode);
  graph.familyNodeMap[familyNode.familyId] = familyNode;
  return familyNode;
}

// Tell whether the genders of the father and mother need to be swapped.
function wrongGender(father, mother) {
  var guy = father ? father.gender : GENDER_CODE_UNKNOWN;
  var gal = mother ? mother.gender : GENDER_CODE_UNKNOWN;
  return (guy !== GENDER_CODE_MALE && gal === GENDER_CODE_MALE) ||
      (guy === GENDER_CODE_FEMALE && gal !== GENDER_CODE_FEMALE);
}

/**
 * Add a FamilyNode for each couple relationship in the given GedcomX document.
 */
function addCouples(graph) {
  if (graph.gx.relationships) {
    var r;
    var rel;
    var pid1, pid2;
    var fatherNode, motherNode, temp;
    for (r = 0; r < graph.gx.relationships.length; r++) {
      rel = graph.gx.relationships[r];
      if (rel.type === GX_COUPLE) {
        pid1 = getPersonIdFromReference(rel.person1);
        pid2 = getPersonIdFromReference(rel.person2);
        fatherNode = graph.personNodeMap[pid1];
        motherNode = graph.personNodeMap[pid2];
        if (wrongGender(fatherNode, motherNode)) {
          // Swap persons to make p1 the father and p2 the mother, if possible.
          temp = fatherNode;
          fatherNode = motherNode;
          motherNode = temp;
        }
        addFamily(graph, makeFamilyId(fatherNode, motherNode), fatherNode, motherNode, rel);
      }
    }
  }
}

// Get a map of personId -> list of objects that contain parentId (of one of that person's parents) and parentChildRelationship (from the GedcomX) for that parent.
function getParentMap(graph) {
  var parentMap = {};
  var r;
  var rel;
  var parentId, childId;
  var parentIds;
  var parentIdAndRel;

  if (graph.gx.relationships) {
    for (r = 0; r < graph.gx.relationships.length; r++) {
      rel = graph.gx.relationships[r];
      if (rel.type === GX_PARENT_CHILD) {
        parentId = getPersonIdFromReference(rel.person1);
        childId = getPersonIdFromReference(rel.person2);
        parentIds = parentMap[childId];
        parentIdAndRel = {
          parentId: parentId,
          parentChildRelationship: rel
        };
        if (parentIds) {
          // Add object to end of array, which is already in the map
          parentIds.push(parentIdAndRel);
        }
        else {
          // Create a new array with this one element and add it to the map.
          parentMap[childId] = [parentIdAndRel];
        }
      }
    }
  }
  return parentMap;
}

// Modify the given array by removing the first occurrence of the given value, if any.
function removeFromArray(value, array) {
  var i;
  for (i = 0; i < array.length; i++) {
    if (array[i] === value) {
      array.splice(i, 1);
      return;
    }
  }
}

// Add children to the existing FamilyNodes in the graph.
function addChildren(graph) {
  // get a map of childId -> array of parent IDs.
  var parentMap = getParentMap(graph);
  var personIndex, parent1, parent2, parent;
  var childNode;
  var parentIdsAndRels;      // Array of objects with {personId, parentChildRelationship}
  var unusedParentIdsAndRels;
  var fatherNode, motherNode; // PersonNode
  var fatherRel, motherRel; // GedcomX ParentChildRelationships
  var temp;
  var familyId;
  var familyNode;

  for (personIndex = 0; personIndex < graph.personNodes.length; personIndex++) {
    // For each person, get their list of parents. For each parent, see if there is a FamilyNode with that parent and any other in the list.
    // If so, add this person as a child to that family, and remove both parents from the list.
    // If not, find or create a single-parent family with that parent and add this child to it.
    childNode = graph.personNodes[personIndex];
    parentIdsAndRels = parentMap[childNode.personId];
    if (parentIdsAndRels && parentIdsAndRels.length > 0) {
      unusedParentIdsAndRels = parentIdsAndRels.slice();
      for (parent1 = 0; parent1 < parentIdsAndRels.length; parent1++) {
        for (parent2 = parent1 + 1; parent2 < parentIdsAndRels.length; parent2++) {
          fatherNode = graph.getPerson(parentIdsAndRels[parent1].parentId);
          motherNode = graph.getPerson(parentIdsAndRels[parent2].parentId);
          fatherRel = parentIdsAndRels[parent1].parentChildRelationship;
          motherRel = parentIdsAndRels[parent2].parentChildRelationship;
          if (wrongGender(fatherNode, motherNode)) {
            // Swap persons to make p1 the father and p2 the mother, if possible.
            temp = fatherNode;
            fatherNode = motherNode;
            motherNode = temp;
            temp = fatherRel;
            fatherRel = motherRel;
            motherRel = temp;
          }

          familyId = makeFamilyId(fatherNode, motherNode);
          familyNode = graph.getFamily(familyId);
          if (!familyNode) {
            familyId = makeFamilyId(motherNode, fatherNode); // in case genders were unknown or the same, try swapping to see if that couple exists.
            familyNode = graph.getFamily(familyId);
          }
          if (familyNode) {
            familyNode.addChild(childNode, fatherRel, motherRel);
            removeFromArray(parentIdsAndRels[parent1], unusedParentIdsAndRels);
            removeFromArray(parentIdsAndRels[parent2], unusedParentIdsAndRels);
          }
        }
      }
      // If any parents were not part of a couple, create a single-parent family for them.
      for (parent = 0; parent < unusedParentIdsAndRels.length; parent++) {
        fatherNode = graph.personNodeMap[unusedParentIdsAndRels[parent].parentId];
        motherNode = null;
        fatherRel = unusedParentIdsAndRels[parent].parentChildRelationship;
        motherRel = null;
        if (wrongGender(fatherNode, motherNode)) {
          motherNode = fatherNode;
          fatherNode = null;
          motherRel = fatherRel;
          fatherRel = null;
        }
        familyId = makeFamilyId(fatherNode, motherNode);
        familyNode = graph.getFamily(familyId);
        if (!familyNode) {
          familyNode = addFamily(graph, familyId, fatherNode, motherNode); // single parent, so no couple relationship
        }
        familyNode.addChild(childNode, fatherRel, motherRel);
      }
    }
  }
}

function addFamiliesToPersonNodes(graph) {
  var f;
  var familyNode;
  var c;

  for (f = 0; f < graph.familyNodes.length; f++) {
    familyNode = graph.familyNodes[f];
    if (familyNode.father) {
      familyNode.father.addSpouseFamily(familyNode);
    }
    if (familyNode.mother) {
      familyNode.mother.addSpouseFamily(familyNode);
    }
    if (familyNode.children) {
      for (c = 0; c < familyNode.children.length; c++) {
        familyNode.children[c].addParentFamily(familyNode);
      }
    }
  }
}

function addFamilyNodes(graph) {
  addCouples(graph);
  addChildren(graph);
  addFamiliesToPersonNodes(graph);
}

RelationshipGraph.prototype.getPerson = function(personId) {
  return this.personNodeMap[personId];
};

RelationshipGraph.prototype.getFamily = function(familyId) {
  return this.familyNodeMap[familyId];
};

RelationshipGraph.prototype.removeFamilyNode = function(familyNode) {
  var index = this.familyNodes.indexOf(familyNode);
  if (index >= 0) {
    this.familyNodes.splice(index, 1);
  }
  delete this.familyNodeMap[familyNode.familyId];
};

/*** Constructor ***/
function RelationshipGraph(gx) {
  this.gx = gx; // GedcomX document (record or portion of a tree).
  this.personNodes = []; // array of PersonNode
  this.familyNodes = []; // array of FamilyNode
  this.personNodeMap = {}; // map of personId to PersonNode
  this.familyNodeMap = {}; // map of familyId to FamilyNode
  this.principals = []; // array of principal PersonNodes
  addPersonNodes(this);
  addFamilyNodes(this);
}


