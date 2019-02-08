var GX_COUPLE = "http://gedcomx.org/Couple";
var GX_PARENT_CHILD = "http://gedcomx.org/ParentChild";
var GX_MALE = "http://gedcomx.org/Male";
var GX_FEMALE = "http://gedcomx.org/Female";
var GENDER_CODE_MALE = "M";
var GENDER_CODE_FEMALE = "F";
var GENDER_CODE_UNKNOWN = "U";

function encode(s) {
  if (!s) {
    s="";
  }
  return $('<div/>').text(s).html();
}

// Get the 'type' of the fact, strip off the URI path up to the last slash (/),
// and convert 'FactTypeName' to 'Fact Type Name'. If no type, return "Other".
function getFactName(fact) {
  if (fact && fact.type) {
    // Strip up to last "/" to convert "http://gedcomx.org/MarriageBanns" to "MarriageBanns".
    // Then insert a space before all capital letters to get " Marriage Banns".
    // Then trim white space to get "Marriage Banns".
    return fact.type.replace(/.*\//g, '').replace(/([A-Z])/g, " $1" ).replace(/^ /, "");
  }
  return "Other";
}

// Get a date string from the date in the given fact (if any), or return 'undefined' otherwise.
function getDate(fact) {
  if (fact && fact.date && fact.date.original) {
    return fact.date.original;
  }
  return undefined;
}

function getPlace(fact) {
  if (fact && fact.place && fact.place.original) {
    return fact.place.original;
  }
  return undefined;
}

function getFactDatePlace(fact) {
  var date = getDate(fact);
  var place = getPlace(fact);
  if (date && place) {
    return date + "; " + place;
  }
  else return date ? date : place;
}

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

// Create a document node for a person box, complete with name and facts.
/*
  <div class='personNode' id='XXXX-YYY'>
    <span class='fullName'>Fred Jones</span></br>
    <div class='fact'><span class='factType'>Birth:</span> <span class='factDatePlace'>1820; Vermont</span>
  </div>
 */
function makePersonNode(person) {
  var gender = getGenderCode(person);
  var html = "<div class='personNode gender-" + gender + "' id='" + person.id + "'>\n";
  var n, f;
  var firstFullName = null;
  if (person.names) {
    for (n = 0; n < person.names.length; n++) {
      var name = person.names[n];
      if (name.nameForms) {
        for (f = 0; f < name.nameForms.length; f++) {
          var form = name.nameForms[f];
          if (form.fullText) {
            if (!firstFullName) {
              firstFullName = form.fullText;
            }
            html += "  <span class='fullName'>" + encode(form.fullText) + "</span><br/>\n";
          }
        }
      }
    }
  }
  if (!firstFullName) {
    firstFullName = "?";
    html += "  <span class='fullName'>" + encode(firstFullName) + "</span>\n";
  }
  if (person.facts) {
    for (f = 0; f < person.facts.length; f++) {
      var fact = person.facts[f];
      html += "<div class='fact'><span class='factType'>" + encode(getFactName(fact)) + ":</span> <span class='factDatePlace'>" + encode(getFactDatePlace(fact)) + "</span></div>";
    }
  }
  html += "</div>";
  // Construct PersonNode
  return {
    personId: person.id,
    name: firstFullName,
    gender: gender,
    personDiv: $.parseHTML(html),
    parentFamilies: [],
    spouseFamilies: [],
    height: 0
  };
}

// Add a PersonNode object to the graph for each person in the gedcomx.
// Also, add a corresponding person div to the #personNodes div.
// FamilyNodes are not yet set.
function addPersonNodes(graph) {
  var i;
  var personNode;
  var y = 0;
  var x = 0;
  var div;
  for (i = 0; i < graph.gx.persons.length; i++) {
    personNode = makePersonNode(graph.gx.persons[i]);
    graph.personNodes[i] = personNode;
    graph.personMap[personNode.personId] = personNode;

    // Add the HTML node to the persons div, and then look that node up via JQuery to get the object that seems to actually work.
    $(graph.personsDiv).append(personNode.personDiv);
    personNode.personDiv = $("#" + personNode.personId);
    personNode.height = personNode.personDiv.height();

    // Test animation. Really, we'll wait until the graph is built to do this.
    console.log("height of person " + i + ": " + personNode.height);
    personNode.personDiv.animate({"top": y, "left": x}, 1000);
    y += personNode.height + 10;
    x += 30;
  }
}

// Tell whether the genders of the father and mother need to be swapped.
function wrongGender(father, mother) {
  var guy = father ? father.gender : GENDER_CODE_UNKNOWN;
  var gal = mother ? mother.gender : GENDER_CODE_UNKNOWN;
  return (guy !== GENDER_CODE_MALE && gal === GENDER_CODE_MALE) ||
         (guy === GENDER_CODE_FEMALE && gal !== GENDER_CODE_FEMALE);
}

// Take a reference like "#p_1" or "http.../XXXX-YYY?blah" and return the person ID from it, i.e., "p_1" or "XXXX-YYY". If it is empty, return null.
function getPersonIdFromReference(ref) {
  //todo: Test this once on "#p1" and "https://familysearch.org/ark:/61903/1:1:XXXX-YYY?query=value&query2=value"
  if (ref && ref.resource && ref.resource.length > 0) {
    if (ref.resource.startsWith("#")) {
      return ref.resource.substring(1);
    }
  }
  // Remove "?" and anything after it.
  var noParams = ref.resource.replace(/\?.*/, "");
  // Strip everything up to last "/", and then up to last ":" to go from "https://familysearch.org/ark:/61903/1:1:XXXX-YYY" to "1:1:XXXX-YYY" to "XXXX-YYY".
  // Also handle "https://familysearch.org/platform/records/personas/XXXX-YYY" (i.e., no "1:1:").
  var noPath = noParams.replace(/.*\//, "").replace(/.*:/, "");
  return noPath;
}

// Create a new FamilyNode and add it to the graph (i.e., to its array of familyNodes[] and to its familyMap).
function addFamily(graph, familyId, fatherNode, motherNode, coupleRelationship) {
  var familyNode = {
    familyId: makeFamilyId(fatherNode, motherNode),
    father: fatherNode,
    mother: motherNode,
    children: [],
    coupleRel: coupleRelationship,
    fatherRels: [],
    motherRels: []
  };
  graph.familyNodes.push(familyNode);
  graph.familyMap[familyNode.familyId] = familyNode;
  return familyNode;
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
    for (r = 0; r < graph.gx.relationships; r++) {
      rel = graph.gx.relationships[r];
      if (rel.type === GX_COUPLE) {
        pid1 = getPersonIdFromReference(rel.person1);
        pid2 = getPersonIdFromReference(rel.person2);
        fatherNode = graph.personMap[pid1];
        motherNode = graph.personMap[pid2];
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

function addToArrayIfNotThere(value, array) {
  var i;
  for (i = 0; i < array.length; i++) {
    if (array[i] === value) {
      return;
    }
  }
  array[i] = value;
}

// Modify the given array by removing the first occurance of the given value.
function removeFromArray(value, array) {
  var i;
  for (i = 0; i < array.length; i++) {
    if (array[i] === value) {
      array.slice(i, 1);
      return;
    }
  }
}

// Get a map of personId -> list of person IDs of any of that person's parents.
function getParentMap(graph) {
  var parentMap = {};
  var r;
  var rel;
  var parentId, childId;
  var parentIds;
  if (graph.gx.relationships) {
    for (r = 0; r < graph.gx.relationships.length; r++) {
      rel = graph.gx.relationships[r];
      if (rel.type === GX_PARENT_CHILD) {
        parentId = getPersonIdFromReference(rel.person1);
        childId = getPersonIdFromReference(rel.person2);
        parentIds = parentMap[childId];
        if (parentIds) {
          addToArrayIfNotThere(parentId, parentIds);
        }
        else {
          parentMap[childId] = [parentId];
        }
      }
    }
    return parentMap;
  }
}

function makeFamilyId(fatherNode, motherNode) {
  var fatherId = fatherNode ? fatherNode.personId : "?";
  var motherId = motherNode ? motherNode.personId : "?";
  return fatherId + "&" + motherId;
}

// Add children to the existing FamilyNodes in the graph.
function addChildren(graph) {
  // get a map of childId -> array of parent IDs.
  var parentMap = getParentMap(graph);
  var personIndex, parent1, parent2, parent;
  var childNode;
  var parentIds;
  var unusedParentIds;
  var fatherNode, motherNode;
  var tempNode;
  var familyId;
  var familyNode;
  var singleParent;

  for (personIndex = 0; personIndex < graph.personNodes.length; personIndex++) {
    // For each person, get their list of parents. For each parent, see if there is a FamilyNode with that parent and any other in the list.
    // If so, add this person as a child to that family, and remove both parents from the list.
    // If not, find or create a single-parent family with that parent and add this child to it.
    childNode = graph.personNodes[personIndex];
    parentIds = parentMap[childNode.personId];
    if (parentIds && parentIds.length > 0) {
      unusedParentIds = parentIds.slice();
      for (parent1 = 0; parent1 < parentIds.length; parent1++) {
        for (parent2 = parent1 + 1; parent2 < parentIds.length; parent2++) {
          fatherNode = graph.personMap[parentIds[parent1]];
          motherNode = graph.personMap[parentIds[parent2]];
          if (wrongGender(fatherNode, motherNode)) {
            // Swap persons to make p1 the father and p2 the mother, if possible.
            tempNode = fatherNode;
            fatherNode = motherNode;
            motherNode = tempNode;
          }

          familyId = makeFamilyId(fatherNode, motherNode);
          familyNode = graph.familyMap[familyId];
          if (!familyNode) {
            familyId = makeFamilyId(motherNode, fatherNode); // in case genders were unknown or the same, try swapping to see if that couple exists.
            familyNode = graph.familyMap[familyId];
          }
          if (familyNode) {
            addToArrayIfNotThere(childNode, familyNode.children);
            removeFromArray(fatherNode.personId, unusedParentIds);
            removeFromArray(motherNode.personId, unusedParentIds);
          }
        }
      }
      // If any parents were not part of a couple, create a single-parent family for them.
      for (parent = 0; parent < unusedParentIds.length; parent++) {
        singleParent = graph.personMap[unusedParentIds[parent]];
        fatherNode = singleParent;
        motherNode = null;
        if (wrongGender(fatherNode, motherNode)) {
          fatherNode = null;
          motherNode = singleParent;
        }
        familyId = makeFamilyId(fatherNode, motherNode);
        familyNode = graph.familyMap[familyId];
        if (!familyNode) {
          familyNode = addFamily(graph, familyId, fatherNode, motherNode);
        }
        addToArrayIfNotThere(childNode, familyNode.children);
      }
    }
  }
}

function addSpouseFamily(personNode, familyNode) {
  if (personNode.spouseFamilies) {
    addToArrayIfNotThere(personNode.spouseFamilies, familyNode);
  }
  else {
    personNode.spouseFamilies = [familyNode];
  }
}

function addParentFamily(personNode, familyNode) {
  if (personNode.parentFamilies) {
    addToArrayIfNotThere(personNode.parentFamilies, familyNode);
  }
  else {
    personNode.parentFamilies = [familyNode];
  }
}

function addFamiliesToPersonNodes(graph) {
  var f;
  var familyNode;
  var c;

  for (f = 0; f < graph.familyNodes.length; f++) {
    familyNode = graph.familyNodes[f];
    if (familyNode.father) {
      addSpouseFamily(familyNode.father, familyNode);
    }
    if (familyNode.mother) {
      addSpouseFamily(familyNode.mother, familyNode);
    }
    if (familyNode.children) {
      for (c = 0; c < familyNode.children.length; c++) {
        addParentFamily(familyNode.children[c], familyNode);
      }
    }
  }
}

function addFamilyNodes(graph) {
  addCouples(graph);
  addChildren(graph);
  addFamiliesToPersonNodes(graph);
}
/*
   Take a Gedcomx document of a record (or a portion of a tree), and create a RelatioshipGraph, with
     gx: GedcomX object
       persons[]
         names[]
           nameForms[].fullText
         facts[]
           date.original
           place.original
       relationships[].type
         person1, person2

     personNodes[]: array of PersonNode object, each with:
       personId: JEncoded person ID
       name: First full name form full text
       gender: "M", "F" or null
       person: GedcomX person object
       personDiv: <div> of person
       parentFamilies[]: Array of FamilyNode for families where this person is a child.
       spouseFamilies[]: Array of FamilyNode for families where this person is a parent (or spouse).

     familyNodes: map of familyId -> FamilyNode object, each with:
       familyId: Husband person ID (or "?") + "+" + wife person ID (or "?"). Must not be "?+?".
       father: PersonNode of husband/father in family.
       mother: PersonNode of wife/mother in family.
       children[]: array of PersonNodes of children.
       coupleRel: GedcomX relationship for the couple (if any).
       fatherRels[]: GedcomX relationship between the father and each child with the corresponding index.
       motherRels[]: GedcomX relationship between the mother and each child with the corresponding index.
     if needed:
       personMap: map of personId -> PersonNode
       familyMap: map of familyId -> FamilyNode
     personDivs: HTML node for <div id="#personNodes">.

 */
function buildGraph(gx) {
  var graph = {
    gx: gx,
    personNodes: [],
    familyNodes: [],
    personMap: {},
    familyMap: {},
    personsDiv: $("#personNodes")
  };

  if (gx.persons) {
    addPersonNodes(graph);
  }

  if (gx.relationships) {
    addFamilyNodes(graph);
  }
}