/*
   PersonNode, representing a person in a relationship graph (but not the information about its location in the chart)
       personId: JEncoded person ID
       name: First full name form full text
       gender: "M", "F" or null
       person: GedcomX person object
       personDiv: <div> of person
       parentFamilies[]: Array of FamilyNode for families where this person is a child.
       spouseFamilies[]: Array of FamilyNode for families where this person is a parent (or spouse).
 */

const GX_MALE = "http://gedcomx.org/Male";
const GX_FEMALE = "http://gedcomx.org/Female";
const GENDER_CODE_MALE = "M";
const GENDER_CODE_FEMALE = "F";
const GENDER_CODE_UNKNOWN = "U";

PersonNode.prototype.getGenderCode = function(person) {
  if (!person) {
    person = this.person;
  }
  if (person.gender && person.gender.type) {
    if (person.gender.type === GX_MALE) {
      return GENDER_CODE_MALE;
    }
    else if (person.gender.type === GX_FEMALE) {
      return GENDER_CODE_FEMALE;
    }
  }
  return GENDER_CODE_UNKNOWN;
};

PersonNode.prototype. getFirstFullName = function(person) {
  if (!person) {
    person = this.person;
  }
  let firstFullName = null;
  if (person.names) {
    for (let name of person.names) {
      if (name.nameForms) {
        for (let form of name.nameForms) {
          if (form.fullText) {
            if (!firstFullName) {
              firstFullName = form.fullText;
            }
          }
        }
      }
    }
  }
  if (!firstFullName) {
    firstFullName = "?";
  }
  return firstFullName;
};

PersonNode.prototype.addRelative = function(label, personNode) {
  let relative = {};
  relative.label = label;
  relative.personNode = personNode;
  this.relatives.push(relative);
};

/*** Constructor ***/
function PersonNode(person) {
  this.person = person;
  this.personId = person.id;
  this.name = this.getFirstFullName(person);
  this.gender = this.getGenderCode(person);
  this.parentFamilies =[];
  this.spouseFamilies = [];
  this.relatives = []; // Array of "relatives", defined as {label: "<Label>", id: "<PersonNodeId>"}
  // Flags indicating that there are more relatives available for this person that are being included in this RelationshipGraph,
  //  i.e., there are relationships to people who either weren't included in the GedcomX, or are being hidden.
  this.hasMoreParents = false;
  this.hasMoreSpouses = false;
  this.hasMoreChildren = false;
}

PersonNode.prototype.addParentFamily = function(familyNode) {
  addToArrayIfNotThere(familyNode, this.parentFamilies);
};

PersonNode.prototype.addSpouseFamily = function(familyNode) {
  addToArrayIfNotThere(familyNode, this.spouseFamilies);
};
