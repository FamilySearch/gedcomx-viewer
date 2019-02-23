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
  this.children = [];
  this.fatherRels = [];
  this.motherRels = [];
}

FamilyNode.prototype.addChild = function(child, fatherRel, motherRel) {
  var index = addToArrayIfNotThere(child, this.children);
  if (this.father) {
    fatherRel[index] = fatherRel;
  }
  if (this.mother) {
    motherRel[index] = motherRel;
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

function makeFamilyId(fatherNode, motherNode) {
  var fatherId = fatherNode ? fatherNode.personId : "none";
  var motherId = motherNode ? motherNode.personId : "none";
  return fatherId + "-n-" + motherId;
}

