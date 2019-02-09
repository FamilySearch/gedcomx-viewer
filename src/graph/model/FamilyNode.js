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

