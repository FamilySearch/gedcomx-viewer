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

var GX_MALE = "http://gedcomx.org/Male";
var GX_FEMALE = "http://gedcomx.org/Female";
var GENDER_CODE_MALE = "M";
var GENDER_CODE_FEMALE = "F";
var GENDER_CODE_UNKNOWN = "U";

function getGenderCode(person) {
  if (person.gender && person.gender.type) {
    if (person.gender.type === GX_MALE) {
      return GENDER_CODE_MALE;
    }
    else if (person.gender.type === GX_FEMALE) {
      return GENDER_CODE_FEMALE;
    }
  }
  return GENDER_CODE_UNKNOWN;
}

function getFirstFullName(person) {
  var firstFullName = null;
  var n, f;
  var name, form;
  if (person.names) {
    for (n = 0; n < person.names.length; n++) {
      name = person.names[n];
      if (name.nameForms) {
        for (f = 0; f < name.nameForms.length; f++) {
          form = name.nameForms[f];
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
}

/*** Constructor ***/
function PersonNode(person) {
  this.person = person;
  this.personId = person.id;
  this.name = getFirstFullName(person);
  this.gender = getGenderCode(person);
  this.parentFamilies =[];
  this.spouseFamilies = [];
}

PersonNode.prototype.addParentFamily = function(familyNode) {
  addToArrayIfNotThere(familyNode, this.parentFamilies);
};

PersonNode.prototype.addSpouseFamily = function(familyNode) {
  addToArrayIfNotThere(familyNode, this.spouseFamilies);
};
