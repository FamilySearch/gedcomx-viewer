/*
  This file contains the methods needed to make changes to the RelationshipChart and the underlying RelationshipGraph and GedcomX.
  It contains 'prototype' methods for various other classes, but these are gathered here to keep the edit logic separate from the
  rest of the code, and to make it easier to see it all together.
 */

// EDIT CONTROLS ==============================
RelationshipChart.prototype.addEditControls = function() {
  // Edit controls
  this.$fatherX = this.makeControl("fatherX", "relX");
  this.$motherX = this.makeControl("motherX", "relX");
  this.$fatherPlus = this.makeControl("fatherPlus", RelationshipChart.prototype.REL_PLUS);
  this.$motherPlus = this.makeControl("motherPlus", RelationshipChart.prototype.REL_PLUS);
  this.editControlSize = this.$fatherPlus.width();
};

RelationshipChart.prototype.hideFamilyControls = function() {
  this.$fatherX.hide();
  this.$motherX.hide();
  this.$fatherPlus.hide();
  this.$motherPlus.hide();
  if (this.selectedFamilyLine && !isEmpty(this.selectedFamilyLine.$childrenX)) {
    for (let childX of this.selectedFamilyLine.$childrenX) {
      childX.hide();
    }
  }
};

RelationshipChart.prototype.positionFamilyControl = function($control, x, y) {
  $control.css({left: x, top: y});
  $control.show();
};

RelationshipChart.prototype.REL_PLUS = "relPlus";

/**
 * Create a '+' or 'x' control div for relationships.
 * @param divId - ID to use for the div.
 * @param imgClass - class to assign to the div ("relX" or "relPlus").
 * @param $containerDiv - JQuery object of a DIV in which to add the new DIV as a child.
 * @returns {jQuery.fn.init|jQuery|HTMLElement}
 */
RelationshipChart.prototype.makeControl = function(divId, imgClass, $containerDiv) {
  if (!$containerDiv) {
    $containerDiv = this.$editControlsDiv;
  }
  let html = `<div id="${this.chartId}-${divId}" class="${imgClass}"></div>`;
  let controlDiv = $.parseHTML(html);
  $containerDiv.append(controlDiv);
  let $control = $(`#${this.chartId}-${divId}`);
  $control.hide();
  $control.draggable({revert: true, scope : "personDropScope"});
  let relChart = this; // todo: Is this needed? Or can we use "this" in the method?
  $control.click(function(event) {
    event.stopPropagation();
    if (divId === "fatherX") {
      relChart.selectedFamilyLine.removeFather();
      updateRecord(relChart.relGraph.gx);
    }
    else if (divId === "motherX") {
      relChart.selectedFamilyLine.removeMother();
      updateRecord(relChart.relGraph.gx);
    }
    else {
      console.log("Click!");
    }
  });
  return $control;
};

// MERGE PERSONS ==========================
const GX_PART_PREFIX  = "http://gedcomx.org/Prefix";
const GX_PART_GIVEN   = "http://gedcomx.org/Given";
const GX_PART_SURNAME = "http://gedcomx.org/Surname";
const GX_PART_SUFFIX  = "http://gedcomx.org/Suffix";

/**
 * Find the Person object in the given GedcomX document's persons[] array that has an 'id' of the given personId.
 * @param gx - GedcomX document
 * @param pid - Person ID to find
 * @returns Person object with the given person id, or null if not found.
 */
RelationshipChart.prototype.findPerson = function(gx, pid) {
  if (gx.persons) {
    for (let person of gx.persons) {
      if (person.id === pid) {
        return person;
      }
    }
  }
  return null;
};

/**
 * Tell whether array1 contains everything in array2, using the given function 'hasOtherElement'
 *   to determine whether one element from array1 equals (or contains) the other one.
 * @param array1 - First "superset" array
 * @param array2 - Second "subset" array
 * @param hasOtherElement - Function that takes a non-empty element from each array and returns true if the one from array1
 *   "contains" the one from array2.
 * @returns {boolean}
 */
function hasOtherStuff(array1, array2, hasOtherElement) {
  if (isEmpty(array2)) {
    return true;
  }
  if (isEmpty(array1)) {
    return false;
  }
  if (!hasOtherElement) {
    hasOtherElement = function(a, b) { return a === b; }
  }
  for (let i = 0; i < array1.length; i++) {
    let element2 = array2[i];
    let found = false;
    for (let j = 0; j < array2.length; j++) {
      let element1 = array1[j];
      if (element1 === element2 || (element1 && element2 && hasOtherElement(element1, element2))) {
        found = true;
      }
    }
    if (!found) {
      return false;
    }
  }
  return true;
}

/**
 * Tell whether the two arrays contain the same elements, using the 'isSameElement' function to determine
 *   whether elements are the same.
 * @param array1 - First array of elements.
 * @param array2 - Second array of elements.
 * @param isSameElement - Function to determine if two elements are the same (if null, then "===" is used).
 * @returns {boolean} true if both elements empty or both contain the same list of elements.
 */
function hasSameStuff(array1, array2, isSameElement) {
  return hasOtherStuff(array1, array2, isSameElement) && hasOtherStuff(array2, array1, isSameElement);
}

/**
 * Tell whether the two given fields have the same sources, i.e., same image(s) with same rectangles (if any).
 * Returns true if both empty or neither has sources.
 * @param field1 - First field
 * @param field2 - Second field
 * @return {boolean} true if the two fields have the same sources (images and rectangles, if any). False otherwise.
 */
RelationshipChart.prototype.sameSources = function(field1, field2) {
  function sameSource(source1, source2) {
    function sameQualifier(qualifier1, qualifier2) {
      return qualifier1.name === qualifier2.name && qualifier1.value === qualifier2.value;
    }

    return source1.descriptionRef === source2.descriptionRef &&
        hasSameStuff(source1.qualifiers, source2.qualifiers, sameQualifier);
  }

  return hasSameStuff(field1 ? field1.sources : null, field2 ? field2.sources : null, sameSource);
};

/**
 * Tell whether field1 and field2 are duplicates of each other.
 * @param field1 - Field object
 * @param field2 - Field object to compare to field1.
 * @returns {boolean} true if the two given GedcomX Field objects have the same type, sources (and qualifiers) and field values.
 */
RelationshipChart.prototype.isDuplicateField = function(field1, field2) {
  function sameFieldValue(value1, value2) {
    return value1.type === value2.type && value1.labelId === value2.labelId && value1.text === value2.text;
  }

  return field1.type === field2.type
      && this.sameSources(field1, field2)
      && hasSameStuff(field1.values, field2.values, sameFieldValue);
};

/**
 * Merge the two arrays of fields and return the resulting array. Returns fields1 or fields2 if the other is empty.
 * If both are non-empty, then all elements of fields2 are added to fields1 UNLESS there is already an "identical"
 * field in fields1, meaning same type, value, label ID and bounding boxes (if any).
 * @param fields1 - First array (modified to be the returned value, if not null)
 * @param fields2 - Second array (incorporated into the first array, if both not null; or returned as-is if fields1 is null)
 */
RelationshipChart.prototype.mergeFields = function(fields1, fields2) {
  if (isEmpty(fields2)) {
    return fields1;
  }
  if (isEmpty(fields1)) {
    return fields2;
  }
  // Both field arrays have at least one Field in them, so add all entries in fields2 to fields1.
  for (let field2 of fields2) {
    let isDuplicate = false;
    for (let field1 of fields1) {
      if (this.isDuplicateField(field1, field2)) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      fields1.push(field2);
    }
  }
  return fields1;
};

/**
 * Look at the gender of both persons and return a gender object that combines the fields of both.
 * If one is male and the other female, then person1's gender is used.
 * If one is unknown then the other person's gender is used.
 * Fields of both objects are combined into the fields of the returned object.
 * @param gender1 - Gender object 1 (may be modified and returned).
 * @param gender2 - Gender object 2 (will be returned if gender1 is null).
 */
RelationshipChart.prototype.mergeGenders = function(gender1, gender2) {
  if (!gender1) {
    return gender2;
  }
  if (!gender2) {
    return gender1; // nothing to merge in, so return person1.gender as-is.
  }
  if (gender1.type !== gender2.type && gender1.type !== GX_MALE && gender1.type !== GX_FEMALE) {
    if (gender2.type === GX_MALE || gender2.type === GX_FEMALE) {
      // person1's gender is unknown, and person2's gender is known, so use that.
      gender1.type = gender2.type;
    }
  }
  gender1.fields = this.mergeFields(gender1.fields, gender2.fields);
  return gender1;
};

/**
 * Merge name part2 into name part1.
 * - If part2's
 * @param part1
 * @param part2
 */
RelationshipChart.prototype.mergeNamePart = function(part1, part2) {
  /**
   * Break a name or name part string into "pieces", separated by space or period,
   *   and return an array of these pieces (w/o spaces but with periods).
   * @param s - String to break into pieces
   * @returns {Array} Array of pieces of name string.
   */
  function getPieces(s) {
    const patt1 = /[A-Za-z.'"-()]+( |$)/g;
    const patt2 = /[^.]+([.]|$)/g;
    let results = s.match(patt1);
    let p = [];
    for (let result of results) {
      let piece = result.trim();
      let subparts = piece.match(patt2);
      if (subparts) {
        for (let subpart of subparts) {
          p.push(subpart);
        }
      }
      else {
        p.push(piece);
      }
    }
    return p;
  }

  /**
   * Take an array of name pieces and normalize each by converting to lower case, converting spaces, tabs, periods,
   *   parentheses, quotes, dashes and slashes into spaces, and then collapsing runs of spaces into a single space, and trimming.
   * @param pieces - Array of name pieces to normalize.
   * @returns {Array} Array of normalized name pieces corresponding to first array.
   */
  function normalizePieces(pieces) {
    let norm = [];
    for (let i = 0; i < pieces.length; i++) {
      norm[i] = pieces[i].toLowerCase().replace(/[ \t.,"()\\[\]\/]+/, " ").replace(/ +/, " ").replace(/'/, "").trim();
    }
    return norm;
  }

  /**
   * Tell whether pieces1 contains all of the "pieces" found in pieces2, meaning that all of the strings in pieces2
   *   exist as strings in pieces1 or as prefixes of substrings in pieces1.
   *   For example, "Elizabeth Jane" has the substrings ["elizabeth", "jane"], and this contains all
   *   the substrings for "Eliza Jane", "Elizabeth J."; but not for "Lizzie Jane".
   * @param pieces1 - First "superset" strings.
   * @param pieces2 - Second "subset" strings.
   */
  function containsAllPieces(pieces1, pieces2) {
    for (let piece2 of pieces2) {
      let containsPiece = false;
      for (let piece1 of pieces1) {
        if (piece1.startsWith(piece2)) { // equal or subset
          containsPiece = true;
          break;
        }
      }
      if (!containsPiece) {
        return false;
      }
    }
    return true;
  }

  // == mergeNamePart(part1, part2) ==
  this.mergeFields(part1.fields, part2.fields);
  let pieces1 = getPieces(part1.value);
  let pieces2 = getPieces(part2.value);
  let normPieces1 = normalizePieces(pieces1);
  let normPieces2 = normalizePieces(pieces2);

  if (!containsAllPieces(normPieces1, normPieces2)) {
    if (containsAllPieces(normPieces2, normPieces1)) {
      // Part2 contains everything that part1 does, and more, so use that.
      part1.value = part2.value;
    }
    else {
      // Remove from pieces2 and normPieces2 any elements where normPieces2 is contained within normPieces1
      for (let p2 = 0; p2 < normPieces2.length; p2++) {
        let foundPiece = false;
        for (let normPiece1 of normPieces1) {
          if (normPiece1.startsWith(normPieces2[p2])) {
            foundPiece = true;
            break;
          }
        }
        if (foundPiece) {
          normPieces2.splice(p2, 1);
          pieces2.splice(p2, 1);
          p2--;
        }
      }
      // Append any remaining pieces to pieces1
      if (pieces2.length > 0) {
        part1.value = pieces1.concat(pieces2).join(" ");
      }
    }
  }
  // else part1 already contains everything part2 does, so leave it as-is.
};

/**
 * Merge name form 2 into name form 1.
 * - Assumes they are both non-null and of a compatible 'lang' (language/script).
 *   (if lang is null, then "x-Latn" is assumed, so these two are treated as compatible).
 * - All fields for each part are merged into the fields for the corresponding part type.
 * - Fields for the name form itself are merged into form1.
 * - The conclusion value for the
 * @param form1 - Name form to merge into.
 * @param form2 - Name form to bring in, which will later be discarded.
 */
RelationshipChart.prototype.mergeNameForm = function(form1, form2) {
  function findLastPrefix(parts) {
    let lastPrefix = -1;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].type === GX_PART_PREFIX) {
        lastPrefix = i;
      }
    }
    return lastPrefix;
  }

  function findFirstSurname(parts) {
    let firstSurname = parts.length;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].type === GX_PART_SURNAME) {
        firstSurname = i;
      }
    }
    return firstSurname;
  }

  /**
   * Tell whether a surname appears in the given list before a given name (and a given name appears after the surname).
   * Returns false if there is not both a given and surname in the name or if the surname appears after the given name.
   * @param parts - Array of NamePart objects.
   * @returns {boolean} - true if a surname appears earlier in the array and a given name later in the array.
   */
  function isSurnameFirst(parts) {
    if (parts) {
      let sawSurname = false;
      for (let part of parts) {
        if (part.type === GX_PART_GIVEN) {
          return sawSurname;
        }
        if (part.type === GX_PART_SURNAME) {
          sawSurname = true;
        }
      }
    }
    return false;
  }

  // == mergeNameForm(form1, form2) ==

  form1.fields = this.mergeFields(form1.fields, form2.fields);
  if (isEmpty(form1.parts)) {
    form1.parts = form2.parts;
  }
  else if (!isEmpty(form2.parts)) {
    let remainingParts2 = form2.parts ? form2.parts.slice(0) : [];
    let surnameFirst = isSurnameFirst(form2.parts);
    for (let part1 of form1.parts) {
      for (let p2 = 0; p2 < remainingParts2.length; p2++) {
        let part2 = remainingParts2[p2];
        if (part1.type === part2.type) {
          this.mergeNamePart(part1, part2);
          remainingParts2.splice(p2--, 1);
        }
      }
    }
    if (remainingParts2.length > 0) {
      // There are remaining name parts in form2, and no corresponding part of the same type in form1.
      // So insert them into form1's array of name parts.
      for (let part2 of remainingParts2) {
        if (part2.type === GX_PART_PREFIX) {
          form1.parts.splice(0, 0, part2);
        }
        else if ((part2.type === GX_PART_GIVEN && !surnameFirst) || (part2.type === GX_PART_SURNAME && surnameFirst)) {
          form1.parts.splice(findLastPrefix(form1.parts) + 1, 0, part2);
        }
        else if ((part2.type === GX_PART_SURNAME && !surnameFirst) || (part2.type === GX_PART_GIVEN && surnameFirst)) {
          form1.parts.splice(findFirstSurname(form1.parts), 0, part2);
        }
        else if (part2.type === GX_PART_SUFFIX) {
          form1.parts.push(part2);
        }
        else {
          throw "Unexpected case...";
        }
      }
    }
  }
};

/**
 * Merge NameForm objects from remainingForms2 into nameForms1, as long as the forms are of the same type.
 * If 'mustBeSameLang', then they must be strictly of the same type. Otherwise, if either type is null,
 *   they can be merged as well.
 * @param nameForms1 - List of name forms to merge into.
 * @param remainingForms2 - List of remaining name forms to merge from. Any forms merged into nameForms1 will be removed from this list.
 * @param mustBeSameLang
 */
RelationshipChart.prototype.mergeSameLangNameForms = function(nameForms1, remainingForms2, mustBeSameLang) {
  for (let nameForm1 of nameForms1) {
    for (let f2 = 0; f2 < remainingForms2.length; f2++) {
      let nameForm2 = remainingForms2[f2];
      let lang1 = nameForm1.lang ? nameForm1.lang : "x-Latn";
      let lang2 = nameForm1.lang ? nameForm1.lang : "x-Latn";
      if (nameForm1.lang === nameForm2.lang || (!mustBeSameLang && lang1 === lang2)) {
        this.mergeNameForm(nameForm1, nameForm2);
        remainingForms2.splice(f2--, 1);
      }
    }
  }
};

// Merge name2 into name1. Both must be non-null.
RelationshipChart.prototype.mergeName = function(name1, name2) {
  /**
   * If any type of name part has more than one NamePart object, concatenate them together.
   * @param nameForms - Array of name forms to process.
   */
  function consolidateNameParts(nameForms) {
    for (let form of nameForms) {
      // Map of part type to index of first occurance of that part type.
      let partIndexMap = {};
      if (form.parts) {
        for (let p = 0; p < form.parts.length; p++) {
          let part = form.parts[p];
          let type = part.type ? part.type : "<noType>";
          let firstIndex = partIndexMap[type];
          if (firstIndex === undefined) {
            partIndexMap[type] = p;
          }
          else {
            // Found another part of the same type as an earlier one.
            // So concatenate the 'value'; merge the list of fields;
            let prevPart = form.parts[firstIndex];
            this.mergeNamePart(prevPart, part);
            form.parts.splice(p--, 1);
          }
        }
      }
    }
  }

  //== mergeName(name1, name2) ==
  name1.fields = this.mergeFields(name1.fields, name2.fields);
  if (isEmpty(name1.nameForms)) {
    name1.nameForms = name2.nameForms;
  }
  else if (!isEmpty(name2.nameForms)) {
    consolidateNameParts(name1.nameForms);
    consolidateNameParts(name2.nameForms);
    let remainingForms2 = name2.nameForms.slice(0); // copy array of name forms.
    this.mergeSameLangNameForms(name1.nameForms, remainingForms2, true);
    this.mergeSameLangNameForms(name1.nameForms, remainingForms2, false);
    // Add any remaining name forms that had a different script.
    name1.nameForms = name1.nameForms.concat(remainingForms2);
  }
}; // mergeName

RelationshipChart.prototype.mergeSameTypeNames = function(names1, remainingNames2, mustBeSameType) {
  for (let name1 of names1) {
    for (let n2 = 0; n2 < remainingNames2.length; n2++) {
      let name2 = remainingNames2[n2];
      if (name1.type === name2.type || ((!name1.type || !name2.type) && !mustBeSameType)) {
        // Merge name2 into name1
        this.mergeName(name1, name2);
        remainingNames2.splice(n2--, 1);
      }
    }
  }
};

RelationshipChart.prototype.rebuildFullName = function(name) {
  if (name.nameForms) {
    for (let nameForm of name.nameForms) {
      if (nameForm.parts) {
        let pieces = [];
        for (let part of nameForm.parts) {
          pieces.push(part.value);
        }
        nameForm.fullText = pieces.join(" ");
      }
    }
  }
};

/**
 * Merge two arrays of names, presumably for two persons being merged.
 * - The common case for data coming out of ACE is that there is one Name object per person,
 *   and usually this is what we want to end up with.
 * - So when both arrays have one Name object, then names2[0] is merged into names1[0] as follows:
 *   a) Merge the list of fields on the name and each name part into the name1 and each corresponding name part.
 *   b) If either part is a subset of the other, create the superset.
 *   c) If there are name pieces for a part remaining in name2, concatenate it to the end of that part in name1.
 * - Only name objects of the same type are merged together, so an AkaName is not merged with a BirthName.
 * - However, a null-typed name can be merged with any other type.
 * @param names1 - First array of names. May be modified and returned.
 * @param names2 - Second array of names. Will be returned if names1 is null.
 * @returns array containing merged names from the two arrays.
 */
RelationshipChart.prototype.mergeNames = function(names1, names2) {
  // ==== mergeNames(names1, names2) ====
  if (isEmpty(names1)) {
    return names2;
  }
  if (isEmpty(names2)) {
    return names1;
  }
  // Arrays of names that haven't yet been
  let remainingNames2 = names2.slice(0);
  this.mergeSameTypeNames(names1, remainingNames2, true, this);
  if (remainingNames2.length > 0) {
    this.mergeSameTypeNames(names1, remainingNames2, false, this);
    if (remainingNames2.length > 0) {
      names1 = names1.concat(remainingNames2);
    }
  }
  for (let name1 of names1) {
    this.rebuildFullName(name1);
  }
  return names1;
};

/**
 * Merge all of the facts in facts2 into facts1 and return the resulting array (which might be facts2 if facts1 was empty).
 * If any facts in facts2 are the "same" as one in facts1 (i.e., same type, date.original, place.original, value),
 *   then merge the fields from facts2 and remove it from its list.
 * @param facts1 - Array to merge into
 * @param facts2 - Array to merge from (or returned if facts1 is null)
 * @returns Array of facts that is a combination of the two lists.
 */
RelationshipChart.prototype.mergeFacts = function(facts1, facts2) {
  if (!facts1) {
    return facts2;
  }
  if (!facts2) {
    return facts1;
  }

  function sameFact(fact1, fact2) {
    function sameDate(date1, date2) {
      let d1 = date1 ? date1.original : "";
      let d2 = date2 ? date2.original : "";
      return d1 === d2;
    }

    function samePlace(place1, place2) {
      let p1 = place1 ? place1.original : "";
      let p2 = place2 ? place2.original : "";
      return p1 === p2;
    }
    return fact1.type === fact2.type
        && sameDate(fact1.date, fact2.date)
        && samePlace(fact1.place, fact2.place)
        && fact1.value === fact2.value;
  }

  for (let fact2 of facts2) {
    for (let fact1 of facts1) {
      if (sameFact(fact1, fact2)) {
        fact1.fields = this.mergeFields(fact1.fields, fact2.fields);
        if (fact1.date && fact2.date) {
          fact1.date.fields = this.mergeFields(fact1.date.fields, fact2.date.fields);
        }
        if (fact1.place && fact1.place) {
          fact1.place.fields = this.mergeFields(fact1.place.fields, fact2.place.fields);
        }
        fact2 = null;
        break;
      }
    }
    if (fact2) { // no duplicate found, so ignore it.
      facts1.push(fact2);
    }
  }
};

/**
 * Go through the relationships in the given GedcomX document. Any relationships involving pid2 are changed to go to pid1 instead.
 * If there is already a relationship of that type between pid1 and the other person in the relationship,
 *   then merge the fields and facts between the two relationships and delete the one to pid2.
 * @param gx - GedcomX document to look through.
 * @param pid1 - PersonId 1 to move to
 * @param pid2 - PersonId 2 whose relationships are being moved to pid1.
 */
RelationshipChart.prototype.mergeRelationships = function(gx, pid1, pid2) {
  if (!gx.relationships) {
    return;
  }

  function samePerson(personRef, personId) {
    return personRef && personRef.resource === ("#" + personId);
  }

  function setPerson(personRef, personId) {
    personRef.resource = "#" + personId;
    if (personRef.resourceId) {
      personRef.resourceId = personId;
    }
  }

  function sameRelationship(rel1, rel2) {
    return rel1.type === rel2.type
        && rel1.person1.resource === rel2.person1.resource
        && rel1.person2.resource === rel2.person2.resource;
  }

  for (let r = 0; r < gx.relationships.length; r++) {
    let rel = gx.relationships[r];
    let changed = true;
    if (samePerson(rel.person1, pid2)) {
      setPerson(rel.person1, pid1);
    }
    else if (samePerson(rel.person2, pid2)) {
      setPerson(rel.person2, pid1);
    }
    else {
      changed = false;
    }
    if (changed) {
      // Changed the relationship, so see if there's already one of the same type with the same people.
      for (let r2 = 0; r2 < gx.relationships.length; r2++) {
        let origRel = gx.relationships[r2];
        if (r2 !== r && sameRelationship(rel, origRel)) {
          // There's already a relationship of the same type with the same people, so merge this one into that one.
          origRel.facts = this.mergeFacts(origRel.facts, rel.facts);
          origRel.fields = this.mergeFields(origRel.fields, rel.fields);
          break;
        }
      }
    }
  }
};

/**
 * Merge pid2 into pid1, and delete pid2 from the GedcomX document. Assumes that this is a GedcomX "record"
 *   in which all relationships point at "local" person IDs (i.e., located within the GedcomX document,
 *   rather than full URLs that point externally.)
 * @param pid1 - person id to merge into and modify.
 * @param pid2 - person id to merge from and delete.
 */
RelationshipChart.prototype.mergeTwoPersons = function(pid1, pid2) {
  const gx = this.getGedcomX();

  const person1 = this.findPerson(gx, pid1);
  const person2 = this.findPerson(gx, pid2);

  // Merge fields:
  person1.fields = this.mergeFields(person1.fields, person2.fields);

  // Merge genders:
  person1.gender = this.mergeGenders(person1.gender, person2.gender);

  // Merge names:
  person1.names = this.mergeNames(person1.names, person2.names);

  // Merge facts:
  person1.facts = this.mergeFacts(person1.facts, person2.facts);

  // Merge relationships:
  // - For each relationship that refers to pid2,
  //   - Update reference to point at pid1.
  //   - Check to see if there is already a relationship of that type between those two people.
  //   - If so, merge the facts between the two (see below), and delete the duplicate relationship.
  this.mergeRelationships(gx, pid1, pid2);
  removeFromArray(person2, gx.persons);
};

// Merge all of the given person IDs into the first, and delete all but the first one from the GedcomX document.
RelationshipChart.prototype.mergePersonList = function(personIdsToMerge) {
  for (let i = 1; i < personIdsToMerge.length; i++) {
    this.mergeTwoPersons(personIdsToMerge[0], personIdsToMerge[i]);
  }
};

// DRAG AND DROP ==========================

/**
 * Parse a child 'x' control's div ID, and return an object with {familyId, childIndex}.
 * @param childXId - Child 'x' div ID, like "childX-parent1Id-parent2Id-c3".
 * @return object with familyId and childIndex, like {familyId: "parent1Id-parent2Id", childIndex: "3"}
 */
PersonBox.prototype.parseChildXId = function(childXId) {
  let parts = childXId.match(/childX-(.*)-c([0-9]*)/);
  return {familyId: parts[1], childIndex: parts[2]};
};

/**
 * Get the list of person IDs to merge, including the two provided, but also anyone
 *   else who is currently selected (if any).
 * @param boxId1 - personBoxId of "survivor" PersonBox that was dropped on.
 * @param boxId2 - personBoxId of "dropped" PersonBox, to be merged into the first one.
 */
RelationshipChart.prototype.getPersonIdsToMerge = function(boxId1, boxId2) {
  let personIds = [];
  personIds.push(this.personBoxMap[boxId1].personNode.personId);
  personIds.push(this.personBoxMap[boxId2].personNode.personId);
  for (let personBox of this.selectedPersonBoxes) {
    let personId = personBox.personNode.personId;
    if (!personIds.includes(personId)) {
      personIds.push(personId);
    }
  }
  return personIds;
};

RelationshipChart.prototype.getMergeMessage = function(personIdsToMerge) {
  let message = "Merge the following people together?\n";
  for (let p = 0; p < personIdsToMerge.length; p++) {
    let personNode = this.relGraph.personNodeMap[personIdsToMerge[p]];
    message += "  " + (p + 1) + ") " + personNode.getFirstFullName() + "\n";
  }
  message += "(Data from all these people will be combined into the first one)";
  return message;
};

/**
 * Handle an event in which a control ('+' or 'x') was dropped on this PersonBox.
 * @param e - Event. Has the div id of the dropped control in e.originalEvent.target.id
 * @param ui - UI object that has the div id of the dropped person if e doesn't have it.
 */
PersonBox.prototype.personDrop = function(e, ui) {
  let droppedPersonBox = this; // = relChart.personBoxMap[e.target.id]; The PersonBox that was dropped ONTO
  function getTargetId(element) {
    for(let i = 0; element && i < 3; i++) {
      if (element.id.search(/^[0-9]*-?box_/) >= 0) {
        return element.id;
      }
      if (element.id.search(/personNodes/) >= 0) {
        return null;
      }
      element = element.parentNode;
    }
  }

  let targetId = getTargetId(e.originalEvent.target);
  if (!targetId) {
    targetId = ui.draggable.attr("id");
  }
  // Remove initial chart#: 1-box_... => box_...
  targetId = targetId.replace(/^[0-9]*-/,"");

  if (targetId.startsWith("box_") && targetId.indexOf("Plus") < 0) {
    let personIdsToMerge = this.relChart.getPersonIdsToMerge(droppedPersonBox.personBoxId, targetId);
    if (targetId !== droppedPersonBox.personBoxId && confirm(this.relChart.getMergeMessage(personIdsToMerge))) {
      this.relChart.mergePersonList(personIdsToMerge);
    }
    else {
      return; // don't update the record: Nothing changed.
    }
  }
  else {
    let plus = targetId.replace(/.*-/, ""); // The div ID of the plus (or 'x') that was dropped on this person.
    if (plus.startsWith("childX")) {
      let oldFamilyIdInfo = this.parseChildXId(plus);
      this.relChart.selectedFamilyLine.changeChildParent(oldFamilyIdInfo.childIndex, droppedPersonBox);
    }
    else if (plus === "motherPlus" || plus === "fatherPlus" || plus === "fatherX" || plus === "motherX") {
      switch (plus) {
        case "motherPlus":
        case "motherX":
          this.relChart.selectedFamilyLine.changeMother(droppedPersonBox);
          break;
        case "fatherPlus":
        case "fatherX":
          this.relChart.selectedFamilyLine.changeFather(droppedPersonBox);
          break;
      }
    }
    else {
      // Remove final plus type: box_p1-1-personSpousePlus => box_p9-1
      let draggedPersonBoxId = targetId.replace(/-[^-]*$/, "");
      let draggedPersonBox = this.relChart.personBoxMap[draggedPersonBoxId];
      if (!draggedPersonBox) {
        console.log("Curious...");
      }
      let draggedPersonId = draggedPersonBox ? draggedPersonBox.getPersonId() : null;
      for (let sourcePersonBox of this.relChart.selectedPersonBoxes) {
        let sourcePersonId = sourcePersonBox.personNode.personId;
        let droppedPersonId = droppedPersonBox.personNode.personId;
        switch (plus) {
          case "personParentPlus":
            // Add all selected persons as children of the parent dropped on.
            this.relChart.ensureRelationship(GX_PARENT_CHILD, droppedPersonId, sourcePersonId);
            break;
          case "personChildPlus":
            // Don't make all selected persons be parents of the child dropped on--that would be unlikely to make sense.
            // Instead, ignore who is selected and only pay attention to whose child '+' was dragged.
            if (sourcePersonBox.personBoxId === draggedPersonBoxId) {
              this.relChart.ensureRelationship(GX_PARENT_CHILD, sourcePersonId, droppedPersonId);
            }
            break;
          case "personSpousePlus":
            // Don't make all selected persons be spouses of the person dropped on--that would be unlikely to make sense.
            // Instead, ignore who is selected and only pay attention to whose spouse '+' was dragged.
            if (sourcePersonId === draggedPersonId) {
              let sourcePersonNode = sourcePersonBox.personNode;
              let droppedPersonNode = droppedPersonBox.personNode;
              if (wrongGender(sourcePersonNode, droppedPersonNode)) {
                this.relChart.ensureRelationship(GX_COUPLE, droppedPersonId, sourcePersonId);
              }
              else {
                this.relChart.ensureRelationship(GX_COUPLE, sourcePersonId, droppedPersonId);
              }
            }
            break;
          default:
            return; // Don't update the record, because nothing happened.
        }
      }
    }
  }
  updateRecord(this.relChart.relGraph.gx);
};

/**
 * Handle a control ('+' or 'x') being dropped onto a family line.
 *   If a person's "parent plus" is dropped, then add them as a child to the family.
 *   If a family line's "child x" is dropped, then remove them from that family and add them as a child to this one.
 *   If a person's "spouse plus" OR "child plus" is dropped on a family then put them in as the father or mother
 *     (according to their gender).
 * @param e - Drop event. The dropped element's id is in e.originalEvent.target.id
 */
FamilyLine.prototype.familyDrop = function(e) {
  let plus = e.originalEvent.target.id.replace(/.*-/, "");
  let sourcePersonId;
  if (plus === "personSpousePlus" || plus === "personChildPlus") {
    // A person's spouse or child "plus" has been dropped on this family line,
    // so we're saying "this person is the parent or spouse in this family".
    // So add or replace the appropriate parent (based on gender).
    if (this.relChart.selectedPersonBoxes.length === 1) { // If multiple persons selected, avoid ambiguity by doing nothing.
      let personBox = this.relChart.selectedPersonBoxes[0];
      if (personBox.personNode.gender === "M") {//!this.father) {
        this.changeFather(personBox);
      }
      else if (personBox.personNode.gender === "F") {//!this.mother) {
        this.changeMother(personBox);
      }
    }
    else {
      return;
    } // no need to update.
  }
  else {
    if (plus === "personParentPlus") {
      for (let selectedPersonBox of this.relChart.selectedPersonBoxes) {
        sourcePersonId = selectedPersonBox.personNode.personId;
        if (this.father) {
          this.relChart.ensureRelationship(GX_PARENT_CHILD, this.father.personNode.personId, sourcePersonId);
        }
        if (this.mother) {
          this.relChart.ensureRelationship(GX_PARENT_CHILD, this.mother.personNode.personId, sourcePersonId);
        }
      }
    }
    else {
      let oldFamilyIdInfo = PersonBox.prototype.parseChildXId(e.originalEvent.target.id);
      let oldFamilyId = oldFamilyIdInfo.familyId;
      if (oldFamilyId === this.familyId) {
        return; // Dropped '+' on same family the child was already in, so do nothing.
      }
      let oldFamilyLine = this.relChart.familyLineMap[oldFamilyId];
      let childBox = oldFamilyLine.children[oldFamilyIdInfo.childIndex];
      oldFamilyLine.removeChild(childBox);
      sourcePersonId = childBox.personNode.personId;
      if (this.father) {
        this.relChart.ensureRelationship(GX_PARENT_CHILD, this.father.personNode.personId, sourcePersonId);
      }
      if (this.mother) {
        this.relChart.ensureRelationship(GX_PARENT_CHILD, this.mother.personNode.personId, sourcePersonId);
      }
    }
  }
  updateRecord(this.getGedcomX());
};

// DRAG PERSONS TO REORDER =====================================

/**
 * Move all persons in a given subtree to just above everyone in the 'below' subtree, in the gedcomx "persons" array.
 *   For example, if subtree=7 and belowSubtree=3, then everyone in subtree 7 will be inserted just before the first person in subtree 3.
 * Leave as many other people in the same order as possible.
 * @param movingSubtree - Index of subtree being moved.
 * @param belowSubtree - Index of the subtree that will end up below, above which the people are being inserted.
 */
RelationshipChart.prototype.moveSubtree = function(movingSubtree, belowSubtree) {
  let persons = this.relGraph.gx.persons;

  // 1. Get the index in the GedcomX persons[] array of the first person in the 'belowSubtree'.
  // 2. For persons after that who are in the 'movingSubtree', (a) remove them from the array, and then (b) insert them at the 'insertPos'.
  let insertPos = null;
  let movingPersons = [];

  for (let p = 0; p < persons.length; p++) {
    let person = persons[p];
    let personBoxId = PersonBox.prototype.getPersonBoxId(persons[p].id);
    let subtreeIndex = this.personBoxMap[personBoxId].subtree;
    if (insertPos === null && subtreeIndex === belowSubtree) {
      insertPos = p;
    }
    else if (subtreeIndex === movingSubtree) {
      movingPersons.push(person);
      persons.splice(p--, 1);
    }
  }
  if (insertPos === null) {
    insertPos = persons.length;
  }
  for (let movingPerson of movingPersons) {
    persons.splice(insertPos++, 0, movingPerson);
  }
};

/**
 * Tell whether one PersonBox is above the other one, in the same generation (and if they're both non-null).
 * @param aboveBox - PersonBox that may be above
 * @param belowBox - PersonBox that may be below
 * @return {boolean} true if both person boxes are non-null, are both in the same generation, and if 'aboveBox' is earlier in the genPersons array. false otherwise.
 */
RelationshipChart.prototype.aboveInGeneration = function(aboveBox, belowBox) {
  if (aboveBox && belowBox && aboveBox.generation === belowBox.generation) {
    let aboveGenIndex = aboveBox.generation.genPersons.indexOf(aboveBox);
    let belowGenIndex = belowBox.generation.genPersons.indexOf(belowBox);
    return aboveGenIndex < belowGenIndex;
  }
  return false;
};


/**
 * Find the FamilyLine in which both given PersonBox's appear as children.
 * @param childBox1 - PersonBox of first child to check.
 * @param childBox2 - PersonBox of second child to check.
 * @return FamilyLine that has both of these children PersonBoxes in it, or null if none in common.
 */
RelationshipChart.prototype.sameParentFamily = function(childBox1, childBox2) {
  for (let parentLine of childBox1.parentLines) {
    if (childBox2.parentLines.includes(parentLine)) {
      return parentLine;
    }
  }
  return null;
};

/**
 * Move one element from where it is now to just above (in front of) the one specified (or at the end if null)
 * @param array - Array of elements to modify
 * @param aboveElement - Element to remove from the array and insert above (before) the other one.
 * @param belowElement - Element that will end up below when the 'above' element is inserted before it. (If null, move the 'above' element to the end).
 */
FamilyLine.prototype.moveAbove = function(array, aboveElement, belowElement) {
  if (array && aboveElement) {
    array.splice(array.indexOf(aboveElement), 1);
    let insertPosition = belowElement ? array.indexOf(belowElement) : array.length;
    array.splice(insertPosition, 0, aboveElement);
  }
};

/**
 * Move the 'above' child in the GedcomX so that it will appear above the 'below' child.
 * - Move the person earlier in the persons array.
 * - Move the parent-child relationships between the 'above' child and each of the parents in this family earlier in the relationships array.
 * @param above - PersonBox of the child that should be moved above the 'below' child.
 * @param below - PersonBox of the child that should end up below the 'above' child.
 */
FamilyLine.prototype.moveChildUp = function(above, below) {
  // Move 'above' just before 'below' in the person array.
  let gx = this.getGedcomX();
  this.moveAbove(gx.persons, above.personNode.person, below.personNode.person);

  // Move parent-child relationships for the 'above' child above those of the 'below' child.
  let aboveChildIndex = this.children.indexOf(above);
  let belowChildIndex = this.children.indexOf(below);
  this.moveAbove(gx.relationships, this.familyNode.fatherRels[aboveChildIndex], this.familyNode.fatherRels[belowChildIndex]);
  this.moveAbove(gx.relationships, this.familyNode.motherRels[aboveChildIndex], this.familyNode.motherRels[belowChildIndex]);
};

/**
 * Move one element from where it is now to just in below (after) the one specified (or at the beginning if null)
 * @param array - Array of elements to modify
 * @param aboveElement - Element to remove from the array and insert after the other one.
 * @param belowElement - Element after which the first element will be inserted. (If null, move it to the beginning).
 */
FamilyLine.prototype.moveBelow = function(array, aboveElement, belowElement) {
  if (array && belowElement) {
    array.splice(array.indexOf(aboveElement), 1);
    let insertPosition = belowElement ? array.indexOf(belowElement) + 1 : 0;
    array.splice(insertPosition, 0, aboveElement);
  }
};

/**
 * Move the 'below' child in the GedcomX so that it will appear just below the 'above' child.
 * - Move the person later in the persons array.
 * - Move the parent-child relationships between the 'below' child and each of the parents in this family later in the relationships array.
 * @param above - PersonBox of the child that should end up above the 'below' child.
 * @param below - PersonBox of the child that should be moved below the 'above' child.
 */
FamilyLine.prototype.moveChildDown = function(above, below) {
  // Move 'above' just before 'below' in the person array.
  let gx = this.getGedcomX();
  this.moveBelow(gx.persons, above.personNode.person, below.personNode.person);

  // Move parent-child relationships for the 'above' child above those of the 'below' child.
  let aboveChildIndex = this.children.indexOf(above);
  let belowChildIndex = this.children.indexOf(below);
  this.moveBelow(gx.relationships, this.familyNode.fatherRels[aboveChildIndex], this.familyNode.fatherRels[belowChildIndex]);
  this.moveBelow(gx.relationships, this.familyNode.motherRels[aboveChildIndex], this.familyNode.motherRels[belowChildIndex]);
};

/**
 * Get a sorted list of subtree indexes to move. If the dropped person is one of multiple selected persons, then get a sorted list
 *   of unique subtree indexes among any of the selected persons. Otherwise, just include the dropped person's subtree index.
 * The idea is to allow the user to multi-select persons, and then drag any of them above someone else in order to move them all above,
 *   while keeping the set of moved persons in the same order relative to each other.
 * @param selectedPersonBoxes - Array of selected PersonBoxes, if any.
 * @param droppedPersonBox - PersonBox that was drag & dropped on a drop zone.
 * @returns {Array} subtree indexes that should be moved.
 */
RelationshipChart.prototype.getSelectedSubtrees = function(selectedPersonBoxes, droppedPersonBox) {
  let selectedSubtrees = [];
  if (selectedPersonBoxes && selectedPersonBoxes.length > 1 && selectedPersonBoxes.includes(droppedPersonBox)) {
    for (let selectedPersonBox of selectedPersonBoxes) {
      let subtree = selectedPersonBox.subtree;
      if (!selectedSubtrees.includes(subtree)) {
        selectedSubtrees.push(subtree);
      }
    }
  }
  else {
    selectedSubtrees.push(droppedPersonBox.subtree);
  }
  return selectedSubtrees;
};

/**
 * Handle a PersonBox being dropped on the gap between (or above or below) PersonBoxes in a generation.
 * - If person A in subtree 2 is dragged above person B in a higher subtree 1, then move everyone in subtree 2 above everyone in subtree 1.
 * - If person A in subtree 1 is dragged below person B in a lower subtree 2, then move everyone in subtree 1 below everyone in subtree 2.
 * - If person B is dragged above person A and they're both in the same subtree:
 *   - If A is a higher child than B in the same family, then move B above A and B's parent-child relationships in the same families above A's.
 *   - If A is an earlier spouse of the same PersonBox as B, then move B's couple relationship to that spouse earlier than A's.
 * - Else if person A is dragged below person B and they're both in the same subtree:
 *   - If A is a lower child than B in the same family, then move A below B and A's parent-child relationships in the same families below B's.
 *   - If A is a lower spouse of the same PersonBox as B, then move A's couple relationship to that spouse later than B's.
 * @param generationIndex - Index of which generation the dropped-on gap is in.
 * @param personIndex - Index of person within that generation above which the gap exists. (If below bottom person, personIndex = # persons in generation)
 * @param draggedPersonBox - PersonBox object that was dropped on the gap.
 * @param newTop - top (in pixels) of where the draggedPersonBox was dropped.
 * @param newLeft - left (in pixels) of where the draggedPersonBox was dropped.
 */
RelationshipChart.prototype.gapDrop = function(generationIndex, personIndex, draggedPersonBox, newTop, newLeft) {
  let generation = this.generations[generationIndex];
  let above = personIndex > 0 ? generation.genPersons[personIndex - 1] : null; // PersonBox above the dropped-on gap (if any)
  let below = personIndex < generation.genPersons.length ? generation.genPersons[personIndex] : null; // PersonBox below the dropped-on-gap
  let dropped = draggedPersonBox;
  let changed = false;
  let commonFamily = null;

  if (below && dropped.subtree > below.subtree) {
    // If a person in subtree X is dragged above a person in subtree Y, move everyone in X just above the persons in Y.
    let selectedSubtrees = this.getSelectedSubtrees(this.selectedPersonBoxes, dropped);
    for (let selectedSubtree of selectedSubtrees) {
      this.moveSubtree(selectedSubtree, below.subtree);
    }
    changed = true;
  }
  else if (above && dropped.subtree < above.subtree) {
    // If a person in subtree X is dragged below a person in subtree Y, move everyone in X between the persons in Y and Y + 1.
    let selectedSubtrees = this.getSelectedSubtrees(this.selectedPersonBoxes, dropped);
    for (let selectedSubtree of selectedSubtrees) {
      this.moveSubtree(selectedSubtree, above.subtree + 1);
    }
    changed = true;
  }
  else if (this.aboveInGeneration(below, dropped) && (commonFamily = this.sameParentFamily(below, dropped)) !== null) {
    // The dropped person was dropped above someone who is in the same family but is currently above them.
    // So move 'dropped' above 'below'; and move their parent-child relationships above below's parent-child relationships to the same parents.
    commonFamily.moveChildUp(dropped, below);
    changed = true;
  }
  else if (this.aboveInGeneration(dropped, above) && (commonFamily = this.sameParentFamily(dropped, above)) !== null) {
    // The dropped person was dropped below someone who is in the same family but is currently above them.
    // So move 'dropped' below 'above'; and move their parent-child relationships below above's parent-child relationships to the same parents.
    commonFamily.moveChildDown(dropped, above);
    changed = true;
  }
  if (changed) {
    draggedPersonBox.move(newTop - draggedPersonBox.getTop());
    // A PersonBox normally derives its left coordinate from its Generation. However, when a PersonBox is dragged somewhere,
    //   it is natural to have it animate from wherever it was dropped to its new location, instead of jumping to its Generation.
    draggedPersonBox.prevLeft = newLeft;
    updateRecord(this.getGedcomX());
  }
};

/**
 * Create a "drop zone" above the given person index in the given generation (or below the last person
 *   if the person index is beyond the list of persons for that generation).
 * @param generationIndex - Index in relChart.generations[g] of the generation in which this drop zone exists.
 * @param personIndex - Index in relCharts.generations[g].genPersons[p] of the person above which this drop zone is placed.
 *                      (or below the last one, if beyond the length of genPersons).
 * @param top    - Pixel coordinates of the drop zone div.
 * @param left
 * @param width
 * @param height
 */
RelationshipChart.prototype.addGapDropZone = function(generationIndex, personIndex, top, left, width, height) {
  let divId = `${this.chartId}-gen-${generationIndex}-above-p-${personIndex}`;
  let html = `<div id="${divId}" class="gapDrop"></div>`;
  let controlDiv = $.parseHTML(html);
  this.$editControlsDiv.append(controlDiv);
  let relChart = this;
  let $control = $(`#${divId}`);
  $control.css({left: left, top: top, width: width, height: height});
  $control.droppable({
    hoverClass: "gapDropHover", scope: "personDropScope", "tolerance": "pointer", drop: function(e, ui) {
      let draggedPersonBoxId = e.originalEvent.target.id;
      if (!draggedPersonBoxId) {
        draggedPersonBoxId = ui.draggable.attr("id");
      }
      relChart.gapDrop(generationIndex, personIndex, relChart.personBoxMap[draggedPersonBoxId], ui.draggable.position().top, ui.draggable.position().left);
      e.stopPropagation();
    }
  });
};

/**
 * Add a "drop zone" div between persons in each generation (and above first and below last),
 *   in order to support drag & drop of person boxes for reordering of persons in the relationship graph.
 */
RelationshipChart.prototype.addGapDropZones = function() {
  for (let g = 0; g < this.generations.length; g++) {
    let generation = this.generations[g];
    let prevPersonBox = null;
    for (let p = 0; p < generation.genPersons.length; p++) {
      let personBox = generation.genPersons[p];
      let top = (p === 0) ? 0 : prevPersonBox.getBottom();
      let height = Math.max(10, personBox.getTop() - top);
      let left = personBox.getLeft();
      let width = this.generationWidth;
      this.addGapDropZone(g, p, top, left, width, height);
      prevPersonBox = personBox;
    }
    if (prevPersonBox) {
      this.addGapDropZone(g, generation.genPersons.length, prevPersonBox.getBottom(), prevPersonBox.getLeft(), this.generationWidth, 30);
    }
  }
};

// SELECTION ==================================

PersonBox.prototype.deselectPerson = function() {
  // Clicked on the only selected person, so deselect it.
  this.$personDiv.removeAttr("chosen");
  if (this.relChart.isEditable) {
    this.$parentPlus.hide();
    this.$spousePlus.hide();
    this.$childPlus.hide();
  }
  removeFromArray(this, this.relChart.selectedPersonBoxes);
};

PersonBox.prototype.selectPerson = function() {
  this.$personDiv.attr("chosen", "uh-huh");
  this.relChart.selectedPersonBoxes.push(this);

  if (this.relChart.isEditable) {
    // Set the '+' controls: child at center of left side; parent at center of right side;
    //    and spouse in center of top (if female or unknown) or bottom (if male).
    let d = this.relChart.editControlSize / 2;
    let centerX = (this.getLeft() + this.getRight()) / 2;
    this.relChart.positionFamilyControl(this.$childPlus, this.getLeft() - d, this.getCenter() - d);
    this.relChart.positionFamilyControl(this.$parentPlus, this.getRight() - d, this.getCenter() - d);
    this.relChart.positionFamilyControl(this.$spousePlus, centerX - d, this.personNode.gender === 'F' ? this.getTop() - d : this.getBottom() - d);
    this.$personDiv.focus(); // avoid text getting selected accidentally.
  }
};

PersonBox.prototype.isSelected = function() {
  return this.$personDiv[0].hasAttribute("chosen");
};

/**
 * Handle a click event on a person. Behavior is similar to click, shift-click (range) and cmd-click (multiselect) in Mac Finder lists.
 * - Click selects a person, unless that person is the only one already selected, in which case it deselects (toggles) it.
 * - Shift-click selects a "range" between the last-selected person and the shift-clicked one, within the same generation.
 * - Cmd/Meta/Ctrl-click
 * @param event
 */
PersonBox.prototype.clickPerson = function(event) {
  this.relChart.clearSelectedFamilyLine();
  let selected = this.relChart.selectedPersonBoxes;

  if (selected.length === 1 && selected[0] === this) {
    // Clicked the only selected person, so whether or not shift or cmd/ctrl are used, deselect the person.
    this.deselectPerson();
  }
  else if (event.metaKey || event.ctrlKey) {
    // Person was clicked with Cmd or Control held down, so toggle that person's selection.
    if (this.isSelected()) {
      this.deselectPerson();
    }
    else {
      this.selectPerson();
    }
  }
  else if (event.shiftKey) {
    // Shift key is held down, so if the clicked person is in the same generation as the most recently-selected person,
    //   then select all of the people in that generation that are between them.
    // Otherwise, deselect everyone, and select just the newly-clicked person.
    if (selected.length > 0) {
      let lastSelected = selected[selected.length - 1];
      if (lastSelected.generation === this.generation) {
        // Shift-clicked on someone in same generation as the latest selected person, so select everyone between them.
        // (Don't select the last-selected one, because it's already selected; and don't select the clicked one,
        // because that will be done "last").
        if (this.genOrder > lastSelected.genOrder) {
          for (let g = lastSelected.genOrder + 1; g < this.genOrder; g++) {
            this.generation.genPersons[g].selectPerson();
          }
        }
        else {
          for (let g = this.genOrder + 1; g < lastSelected.genOrder; g++) {
            this.generation.genPersons[g].selectPerson();
          }
        }
      }
      else {
        // Wrong generation, so deselect everyone who is selected before selecting the newly-clicked person.
        this.relChart.clearSelections();
      }
    }
    this.selectPerson();
  }
  else {
    this.relChart.clearSelections();
    this.selectPerson();
  }

  // Prevent parent divs from getting the event, since that would immediately clear the selection.
  if (event) {
    event.stopPropagation();
    // Prevent HTML text from being selected when doing a shift-click on persons.
    document.getSelection().removeAllRanges();
  }
};

// Toggle whether the given familyId is selected.
FamilyLine.prototype.toggleFamilyLine = function(event) {
  let relChart = this.relChart;
  relChart.clearSelectedPerson();
  let familyLine = this;
  if (relChart.selectedFamilyLine === this) {
    // Deselect family line.
    familyLine.$familyLineDiv.removeAttr("chosen");
    relChart.hideFamilyControls();
    relChart.selectedFamilyLine = null;
  }
  else {
    if (relChart.selectedFamilyLine) {
      // Deselect currently selected family line
      relChart.selectedFamilyLine.toggleFamilyLine();
    }
    familyLine.$familyLineDiv.attr("chosen", "yep");
    relChart.selectedFamilyLine = familyLine;
    // Set the + or x controls at the top and bottom of the family line.
    let x = familyLine.x + familyLine.lineThickness;
    let d = relChart.editControlSize / 2;
    relChart.positionFamilyControl(familyLine.father ? relChart.$fatherX : relChart.$fatherPlus, x, familyLine.getTop() + 1 - d);
    relChart.positionFamilyControl(familyLine.mother ? relChart.$motherX : relChart.$motherPlus, x, familyLine.getBottom() - d + familyLine.lineThickness);

    if (!isEmpty(familyLine.$childrenX)) {
      for (let childX of familyLine.$childrenX) {
        childX.show();
      }
    }
  }
  // Prevent parent divs from getting the event, since that would immediately clear the selection.
  if (event) {
    event.stopPropagation();
  }
};

RelationshipChart.prototype.clearSelectedPerson = function() {
  while (this.selectedPersonBoxes.length > 0) {
    this.selectedPersonBoxes[0].deselectPerson();
  }
};

RelationshipChart.prototype.clearSelectedFamilyLine = function() {
  if (this.selectedFamilyLine) {
    this.selectedFamilyLine.toggleFamilyLine();
  }
};

RelationshipChart.prototype.clearSelections = function() {
  this.clearSelectedPerson();
  this.clearSelectedFamilyLine();
};


// GRAPH UPDATING =============================
/**
 * Delete the JQuery object at the given index in the array (removing it from the DOM), and remove that element from the array.
 * @param $divs - Array of JQuery objects for divs.
 * @param index - Index in the array of the div to delete.
 */
function removeDiv($divs, index) {
  // Remove the DIV from the DOM
  $divs[index].remove();
  // Remove the object from the given array, too.
  $divs.splice(index, 1);
}

FamilyLine.prototype.getGedcomX = function() {
  return this.relChart.relGraph.gx;
};

/**
 * Remove a parent from this FamilyLine, updating the underlying GedcomX.
 * @param parentNode - father or mother in the FamilyLine.
 * @param spouseNode - mother or father in the FamilyLine (or null or undefined if there isn't one).
 * @param parentRels - fatherRels or motherRels for the family.
 */
FamilyLine.prototype.removeParent = function(parentNode, spouseNode, parentRels) {
  let doc = this.getGedcomX();
  let familyNode = this.familyNode;
  if (spouseNode) {
    // Remove couple relationship between father and mother.
    let index = doc.relationships.indexOf(familyNode.coupleRel);
    doc.relationships.splice(index, 1);
  }
  // Remove this family from the parentNode's list of spouseFamilies so it won't get in the way when we look for remaining spouseFamilies with the same child.
  for (let s = 0; s < parentNode.spouseFamilies.length; s++) {
    if (parentNode.spouseFamilies[s] === familyNode) {
      parentNode.spouseFamilies.splice(s, 1);
      break;
    }
  }
  // Remove parent-child relationships between this parent and each child in the family,
  //  UNLESS there's another family with this parent in it (i.e., with another spouse)
  //  that has this same child, in which case that relationship is kept.
  if (familyNode.children) {
    for (let c = 0; c < familyNode.children.length; c++) {
      let childId = familyNode.children[c].personId;
      let foundParentWithOtherSpouse = false;
      for (let s = 0; s < parentNode.spouseFamilies.length && !foundParentWithOtherSpouse; s++) {
        let otherSpouseFamily = parentNode.spouseFamilies[s];
        if (otherSpouseFamily.children) {
          for (let otherSpouseFamilyChild of otherSpouseFamily.children) {
            if (otherSpouseFamilyChild.personId === childId) {
              foundParentWithOtherSpouse = true;
              break;
            }
          }
        }
      }
      if (!foundParentWithOtherSpouse) {
        // The only family in which child c is a child of this father is the one in which the father is being removed.
        // So remove the parent-child relationship from this father to this child.
        removeFromArray(parentRels[c], doc.relationships);
      }
    }
  }
};

FamilyLine.prototype.updateParents = function(fatherBox, motherBox) {
  this.father = fatherBox;
  this.mother = motherBox;
  if (fatherBox || motherBox) {
    let newFamilyId = makeFamilyId(this.relChart.chartId, fatherBox ? fatherBox.personNode : null, motherBox ? motherBox.personNode : null);
    if (!this.relChart.familyLineMap[newFamilyId]) {
      // We're creating a new family line out of this one. So update this one so that the new chart will re-use its position.
      this.familyId = newFamilyId;
      this.relChart.familyLineMap[newFamilyId] = this;
    }
  }
};

// Remove the father from this family, updating the underlying GedcomX
FamilyLine.prototype.removeFather = function() {
  this.removeParent(this.father.personNode, this.mother ? this.mother.personNode : null, this.familyNode.fatherRels);
  this.updateParents(null, this.mother);
};

// Remove the mother from this family, updating the underlying GedcomX
FamilyLine.prototype.removeMother = function() {
  this.removeParent(this.mother.personNode, this.father ? this.father.personNode : null, this.familyNode.motherRels);
  this.updateParents(this.father, null);
};

// Remove the given parentChildRel from the array of relationships unless there is still a parentFamily of this box's personNode that includes it.
PersonNode.prototype.removeParentChildRelationshipIfOnlyOne = function(isFather, parentChildRel, relationships) {
  if (parentChildRel) {
    let parentFamilies = this.parentFamilies;
    for (let parentFamily of parentFamilies) {
      let childIndex = parentFamily.children.indexOf(this);
      let parentRel = isFather ? parentFamily.fatherRels[childIndex] : parentFamily.motherRels[childIndex];
      if (parentRel === parentChildRel) {
        return; // There is still another parent family of this child that has this parent-child relationship.
      }
    }
    // Did not find any parent family of this person that still had the given parent-child relationship in it, so remove it from the GedcomX.
    let relIndex = relationships.indexOf(parentChildRel);
    relationships.splice(relIndex, 1);
  }
};

// Remove the given child from the family. Delete the parent-child relationships from the GedcomX (unless still needed for another parent family of this same child).
FamilyLine.prototype.removeChild = function(childBox) {
  let doc = this.getGedcomX();
  let childIndex = this.children.indexOf(childBox);
  let familyNode = this.familyNode;
  let fatherRel = !isEmpty(familyNode.fatherRels) ? familyNode.fatherRels[childIndex] : null;
  let motherRel = !isEmpty(familyNode.motherRels) ? familyNode.motherRels[childIndex] : null;

  // These updates fix up the relationship graph, which is unnecessary if we're going to rebuild it from scratch.
  familyNode.children.splice(childIndex, 1);
  familyNode.fatherRels.splice(childIndex, 1);
  familyNode.motherRels.splice(childIndex, 1);
  removeFromArray(familyNode, childBox.personNode.parentFamilies);
  removeDiv(this.$childrenLineDivs, childIndex);
  removeDiv(this.$childrenLineDots, childIndex);
  removeDiv(this.$childrenX, childIndex);
  childBox.removeParentFamilyLine(this);

  // if this is the only family in which this child is a child of each parent, then remove that parent-child relationship.
  childBox.personNode.removeParentChildRelationshipIfOnlyOne(true, fatherRel, doc.relationships);
  childBox.personNode.removeParentChildRelationshipIfOnlyOne(false, motherRel, doc.relationships);

  if (RelChartBuilder.prototype.familyHasOnlyOnePerson(familyNode)) {
    // Removed last child, and only one parent, so family line should go away.
    this.relChart.removeFamily(this);
  }
};

// Set the person in the given motherBox to be the mother of this family, updating the underlying GedcomX as needed. Update record.
FamilyLine.prototype.changeMother = function(motherBox) {
  if (this.mother) {
    // Remove the existing mother from the family, if any.
    this.removeMother();
  }
  let fatherNode = this.father ? this.father.personNode : null;
  let fatherId = fatherNode ? fatherNode.personId : null;
  let motherId = motherBox.personNode.personId;
  let familyId = makeFamilyId(this.relChart.chartId, fatherNode, motherBox.personNode);
  // See if there's already a family with this couple. If so, merge this family with that one.
  let existingFamilyLine = this.relChart.familyLineMap[familyId];
  if (!existingFamilyLine) {
    // Create the missing couple relationship between the father and mother.
    this.relChart.ensureRelationship(GX_COUPLE, fatherId, motherId);
    // Change the family ID of this FamilyLine so that the new chart will use its position.
    this.familyId = familyId;
    this.mother = motherBox;
    this.relChart.familyLineMap[familyId] = this;
  }
  // Create any missing parent-child relationships between the mother and each child.
  this.relChart.ensureRelationships(GX_PARENT_CHILD, motherId, this.children);
};

// Set the person in the given fatherBox to be the father of this family, updating the underlying GedcomX as needed. Update record.
FamilyLine.prototype.changeFather = function(fatherBox) {
  if (this.father) {
    // Remove the existing mother from the family, if any.
    this.removeFather();
  }
  let motherNode = this.mother ? this.mother.personNode : null;
  let motherId = motherNode ? motherNode.personId : null;
  let fatherId = fatherBox.personNode.personId;
  let familyId = makeFamilyId(this.relChart.chartId, fatherBox.personNode, motherNode);
  // See if there's already a family with this couple. If so, merge this family with that one.
  let existingFamilyLine = this.relChart.familyLineMap[familyId];
  if (!existingFamilyLine) {
    // Create the missing couple relationship between the father and mother.
    this.relChart.ensureRelationship(GX_COUPLE, fatherId, motherId);
    // Change the family ID of this FamilyLine so that the new chart will use its position.
    this.familyId = familyId;
    this.father = fatherBox;
    this.relChart.familyLineMap[familyId] = this;
  }
  // Create any missing parent-child relationships between the mother and each child.
  this.relChart.ensureRelationships(GX_PARENT_CHILD, fatherId, this.children);
};

// Remove the given child from this family and add 'parentBox' as a parent of them.
FamilyLine.prototype.changeChildParent = function(childIndex, parentBox) {
  let childPersonId = this.children[childIndex].personNode.personId;
  let parentPersonId = parentBox.personNode.personId;
  this.removeChild(this.children[childIndex]);
  this.relChart.ensureRelationship(GX_PARENT_CHILD, parentPersonId, childPersonId);
};

/**
 * Add a relationship of the given type between the two given persons to the given GedcomX document.
 * @param relType - Relationship type (GX_PARENT_CHILD or GX_COUPLE)
 * @param personId1 - JEncoded person ID of the first person.
 * @param personId2 - JEncoded person ID of the second person.
 */
RelationshipChart.prototype.addRelationship = function(relType, personId1, personId2) {
  let doc = this.relGraph.gx;
  if (!doc.relationships) {
    doc.relationships = [];
  }
  let relationship = {};
  let prefix = (relType === GX_PARENT_CHILD ? "r-pc" : (relType === GX_COUPLE ? "r-c" : "r-" + relType));
  relationship.id = prefix + "-" + personId1 + "-" + personId2;
  relationship.type = relType;
  relationship.person1 = {resource :"#" + personId1, resourceId : personId1};
  relationship.person2 = {resource : "#" + personId2, resourceId : personId2};
  doc.relationships.push(relationship);
};


RelationshipChart.prototype.sameId = function(personRef1, personId2) {
  if (personRef1 && personId2) {
    let personId1 = getPersonIdFromReference(personRef1);
    return personId1 === personId2;
  }
};

/**
 * Make sure the given relationship type exists between the two person IDs in the given GedcomX document.
 * If not, then add it.
 * @param relType - Relationship type (GX_PARENT_CHILD or GX_COUPLE)
 * @param personId1 - JEncoded person ID of the first person.
 * @param personId2 - JEncoded person ID of the second person.
 */
RelationshipChart.prototype.ensureRelationship = function(relType, personId1, personId2) {
  let doc = this.relGraph.gx;
  if (personId1 && personId2) {
    if (doc.relationships) {
      for (let rel of doc.relationships) {
        if (rel.type === relType && this.sameId(rel.person1, personId1) && this.sameId(rel.person2, personId2)) {
          return; // Relationship already exists.
        }
      }
    }
    this.addRelationship(relType, personId1, personId2);
  }
};

/**
 * Ensure that the given relationship type exists between the first person ID and the person ID of all of the PersonNodes in the person2Nodes array.
 * @param relType - Relationship type (GX_PARENT_CHILD or GX_COUPLE)
 * @param person1Id - Person ID for person1 in each relationship.
 * @param person2Nodes - Array of PersonNode from which to get the personId for checking each relationship.
 */
RelationshipChart.prototype.ensureRelationships = function(relType, person1Id, person2Nodes) {
  if (person2Nodes) {
    for (let person2Node of person2Nodes) {
      let person2Id = person2Node.personNode.personId;
      this.ensureRelationship(relType, person1Id, person2Id);
    }
  }
};

// Remove a FamilyLine from the chart, along with its corresponding FamilyNode and HTML elements.
RelationshipChart.prototype.removeFamily = function(familyLine) {
  familyLine.$familyLineDiv.remove();
  if (familyLine.$fatherLineDiv) {
    familyLine.$fatherLineDiv.remove();
  }
  if (familyLine.$motherLineDiv) {
    familyLine.$motherLineDiv.remove();
  }
  this.familyLines.splice(this.familyLines.indexOf(familyLine), 1);

  let familyNode = familyLine.familyNode;
  delete this.familyLineMap[familyNode.familyId];
  this.relGraph.removeFamilyNode(familyNode);
};
