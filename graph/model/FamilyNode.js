/*
     FamilyNode:
       familyId: Husband person ID (or "?") + "+" + wife person ID (or "?"). Must not be "?+?".
       father: PersonNode of husband/father in family.
       mother: PersonNode of wife/mother in family.
       children[]: array of PersonNodes of children.
       coupleRel: GedcomX relationship for the couple (if any).
       fatherRels[]: GedcomX relationship between the father and each child with the corresponding index.
       motherRels[]: GedcomX relationship between the mother and each child with the corresponding index.

 */

function FamilyNode(familyId, fatherNode, motherNode, coupleRelationship) {
  this.familyId = familyId;
  this.father = fatherNode;
  this.mother = motherNode;
  this.coupleRel = coupleRelationship;
  this.children = []; // PersonNode for child c.
  this.fatherRels = []; // Parent-child relationships between the father and child c.
  this.motherRels = []; // Parent-child relationships between the mother and child c.
}

FamilyNode.prototype.findChildIndex = function(personNode) {
  for (let c = 0; c < this.children.length; c++) {
    if (this.children[c] === personNode) {
      return c;
    }
  }
  return null;
};

FamilyNode.prototype.addChild = function(childNode, fatherRel, motherRel) {
  let index = addToArrayIfNotThere(childNode, this.children);
  if (this.father) {
    this.fatherRels[index] = fatherRel;
  }
  if (this.mother) {
    this.motherRels[index] = motherRel;
  }
};

// Get the spouse of personNode in the family, or null if none.
FamilyNode.prototype.getSpouse = function(personNode) {
  if (this.father === personNode) {
    return this.mother;
  }
  else if (this.mother === personNode) {
    return this.father;
  }
  return null;
};

function makeFamilyId(chartId, fatherNode, motherNode) {
  let fatherId = fatherNode ? fatherNode.personId : "none";
  let motherId = motherNode ? motherNode.personId : "none";
  return `${chartId}-${fatherId}-n-${motherId}`;
}
