/**
 * A collection of functions for accessing parts of the GedcomX response.
 */
(function defineGedxPersonaPOJO(global) {

  var GedxPersonaPOJO = function GedxPersonaPOJO() {};

  var searchUtilsPOJO = null;

  var nodejs = !!(typeof process !== 'undefined' && process.env && process.env.NODE_ENV); // See if we are in Node or in the browser
  if (nodejs) {
    var srequire = require;
    searchUtilsPOJO = srequire('../SearchUtilsPOJO');
  }
  else {
    searchUtilsPOJO = window.SearchUtilsPOJO;
  }

  var useHtmlEncode = true; // Whether names should be html encoded


  var siblingRelationship = {
    type: "http://familysearch.org/types/relationships/Sibling",
    category: "parentsSiblings",
    p1: {M: "Brother", F: "Sister", U: "Sibling"},
    p2: {M: "Brother", F: "Sister", U: "Sibling"}
  };

  var unknownRelationship = {
    type: "http://familysearch.org/types/relationships/Unknown",
    category: "othersOnRecord",
    p1: {M: "Unknown", F: "Unknown", U: "Unknown"},
    p2: {M: "Unknown", F: "Unknown", U: "Unknown"}
  };

  // See https://almtools.ldschurch.org/fhconfluence/pages/viewpage.action?pageId=66877982
  // The map entry with no 'id' field is considered the default map and must be at the end of the 'type' list
  var relationshipTypeMap = [
    {
      type: "http://gedcomx.org/ParentChild",
      id: "http://familysearch.org/types/relationships/AdoptedParent",
      category: "parentsSiblings",
      p1: {M: "AdoptedSon", F: "AdoptedDaughter", U: "AdoptedChild"},
      p2: {M: "AdoptiveFather", F: "AdoptiveMother", U: "AdoptiveParent"}
    },
    {
      type: "http://gedcomx.org/ParentChild",
      id: "http://familysearch.org/types/relationships/FosterParentChild",
      category: "parentsSiblings",
      p1: {M: "FosterSon", F: "FosterDaughter", U: "FosterChild"},
      p2: {M: "FosterFather", F: "FosterMother", U: "FosterParent"}
    },
    {
      type: "http://gedcomx.org/ParentChild",
      id: "http://familysearch.org/types/relationships/GuardianParentChild",
      category: "parentsSiblings",
      p1: {M: "GuardianSon", F: "GuardianDaughter", U: "GuardianChild"},
      p2: {M: "GuardianFather", F: "GuardianMother", U: "GuardianParent"}
    },
    {
      type: "http://gedcomx.org/ParentChild",
      id: "http://familysearch.org/types/relationships/StepParentChild",
      category: "parentsSiblings",
      p1: {M: "StepSon", F: "StepDaughter", U: "StepChild"},
      p2: {M: "StepFather", F: "StepMother", U: "StepParent"}
    },
    { // Catch all - no ID specified
      type: "http://gedcomx.org/ParentChild",
      category: "parentsSiblings",
      p1: {M: "Son", F: "Daughter", U: "Child"},
      p2: {M: "Father", F: "Mother", U: "Parent"}
    },
    {
      type: "http://familysearch.org/types/relationships/ParentChildInLaw",
      p1: {M: "SonInLaw", F: "DaughterInLaw", U: "ChildInLaw", category: "spouseChildren"},
      p2: {M: "FatherInLaw", F: "MotherInLaw", U: "ParentInLaw", category: "parentsSiblings"}
    },
    {
      type: "http://familysearch.org/types/relationships/GrandParent",
      category: "extendedFamily",
      p1: {M: "Grandson", F: "Granddaughter", U: "Grandchild"},
      p2: {M: "Grandfather", F: "Grandmother", U: "Grandparent"}
    },
    {
      type: "http://familysearch.org/types/relationships/AuntOrUncle",
      category: "extendedFamily",
      p1: {M: "Nephew", F: "Niece", U: "NephewOrNiece"},
      p2: {M: "Uncle", F: "Aunt", U: "UncleOrAunt"}
    },
    {
      type: "http://familysearch.org/types/relationships/Cousin",
      category: "extendedFamily",
      p1: {M: "MaleCousin", F: "FemaleCousin", U: "Cousin"},
      p2: {M: "MaleCousin", F: "FemaleCousin", U: "Cousin"}
    },
    {
      type: "http://gedcomx.org/Couple",
      id: "http://familysearch.org/types/relationships/DivorcedCouple",
      category: "spouseChildren",
      p1: {M: "ExHusband", F: "ExWife", U: "ExSpouse"},
      p2: {M: "ExHusband", F: "ExWife", U: "ExSpouse"}
    },
    {
      type: "http://gedcomx.org/Couple",
      id: "http://familysearch.org/types/relationships/Fiance",
      category: "spouseChildren",
      p1: {M: "MaleFiance", F: "FemaleFiance", U: "Fiance"},
      p2: {M: "MaleFiance", F: "FemaleFiance", U: "Fiance"}
    },
    {
      type: "http://gedcomx.org/Couple",
      id: "http://familysearch.org/types/relationships/DomesticPartnership",
      category: "spouseChildren",
      p1: {M: "DomesticHusband", F: "DomesticWife", U: "DomesticSpouse"},
      p2: {M: "DomesticHusband", F: "DomesticWife", U: "DomesticSpouse"}
    },
    {
      type: "http://gedcomx.org/Couple",
      category: "spouseChildren",
      p1: {M: "Husband", F: "Wife", U: "Spouse"},
      p2: {M: "Husband", F: "Wife", U: "Spouse"}
    },
    siblingRelationship,
    {
      type: "http://familysearch.org/types/relationships/StepSibling",
      category: "parentsSiblings",
      p1: {M: "StepBrother", F: "StepSister", U: "StepSibling"},
      p2: {M: "StepBrother", F: "StepSister", U: "StepSibling"}
    },
    {
      type: "http://familysearch.org/types/relationships/SiblingInLaw",
      category: "parentsSiblings",
      p1: {M: "BrotherInLaw", F: "SisterInLaw", U: "SiblingInLaw"},
      p2: {M: "BrotherInLaw", F: "SisterInLaw", U: "SiblingInLaw"}
    },
    {
      type: "http://familysearch.org/types/relationships/Descendant",
      category: "extendedFamily",
      p1: {M: "MaleDescendant", F: "FemaleDescendant", U: "Descendant"},
      p2: {M: "MaleAncestor", F: "FemaleAncestor", U: "Ancestor"}
    },
    {
      type: "http://familysearch.org/types/relationships/Relative",
      category: "extendedFamily",
      p1: {M: "MaleRelative", F: "FemaleRelative", U: "Relative"},
      p2: {M: "MaleRelative", F: "FemaleRelative", U: "Relative"}
    },
    unknownRelationship,
    {
      type: "http://familysearch.org/types/relationships/NonRelative",
      category: "othersOnRecord",
      p1: {M: "Nonrelative", F: "Nonrelative", U: "Nonrelative"},
      p2: {M: "Nonrelative", F: "Nonrelative", U: "Nonrelative"}
    }
  ];

  var relationshipMap = [
    {
      type: "http://gedcomx.org/Couple",
      p1: {M: "Husband", F: "Wife", U: "Spouse"},
      p2: {M: "Husband", F: "Wife", U: "Spouse"}
    },
    {
      type: "http://gedcomx.org/ParentChild",
      p1: {M: "Son", F: "Daughter", U: "Child"},
      p2: {M: "Father", F: "Mother", U: "Parent"}
    }
  ];

  // ===========================================================================
  // PUBLIC ACCESSOR/HELPER METHODS
  // ===========================================================================

  /**
   * Return all URLs for the images associated with this record.
   *
   * @param {object} record The record object.
   * @returns {Array} array of image URLs
   */
  GedxPersonaPOJO.prototype.getAllImageURLs = function getAllImageURLs(record) {
    var imageUrls = [];
    var sources = getAllSourceDescriptionsOfType(record, "http://gedcomx.org/DigitalArtifact");
    for (var i = 0; i < sources.length; ++i) {
      if (sources[i].about) {
        imageUrls.push(sources[i].about);
      }
      else if (sources[i].identifiers &&
          sources[i].identifiers["http://gedcomx.org/Persistent"] &&
          sources[i].identifiers["http://gedcomx.org/Persistent"][0]) {

        imageUrls.push(sources[i].identifiers["http://gedcomx.org/Persistent"][0]);
      }
    }
    return imageUrls;
  };

  /**
   * @param {object} person The person object (see getPerson).
   * @returns {null|string} Other names for the primary person.
   */
  GedxPersonaPOJO.prototype.getAlternateNames = function getAlternateNames(person) {
    var names = [];
    for (var i = 1; i < person.names.length; ++i) {
      var nameForm = person.names[i].nameForms[0];
      var nameText = nameForm.fullText;
      if (!nameText && nameForm.parts && nameForm.parts.length > 0) {
        var j;
        nameText = "";
        for (j = 0; j < nameForm.parts.length; j++) {
          nameText += (j > 0) ? " " : nameForm.parts[j].value;
        }
      }
      names.push(safeName(nameText));
    }

    if (names.length > 0) {
      return "[" + names.join(", ") + "]";
    }
    return null;
  };

  /**
   * Get the best match for the age of the person.
   *
   * @param {object} person The person object (see getPerson).
   * @returns {string} The age for the person.
   */
  GedxPersonaPOJO.prototype.getBestAgeValue = function getBestAgeValue(person) {
    var age;

    var ageField = this.getField(person, "http://gedcomx.org/Age");
    if (ageField) {
      age = this.getBestValue(ageField);
    }

    if (!age) {
      age = GedxPersonaPOJO.prototype.getCharacteristicValue(person, "http://familysearch.org/types/fields/AgeYears");
    }
    return age;
  };

  /**
   * Returns an approximate birth year for a person: birth, if provided; christening, if not
   *
   * @param {object} person The person object returned by GedxPersonaPOJO.prototype.getPerson
   * @returns {string} The 4-digit birth year for the person. May be empty.
   */
  GedxPersonaPOJO.prototype.getBestBirthYear = function getBestBirthYear(person) {
    var birthYear = '';

    // get the ISO date string (year should be the first 4 digits)
    var birthDate = this.getFactISODateString(this.getFact(person, "http://gedcomx.org/Birth"));
    if (birthDate === "") {
      birthDate = this.getFactISODateString(this.getFact(person, "http://gedcomx.org/Christening"));
    }
    var matches = birthDate.match(/^(\d{4})/); // the first four digits should be the year
    if (matches && matches[1]) {
      birthYear = matches[1];
    }
    return birthYear;
  };

  /**
   * Returns an approximate death year for a person: death, if provided; burial, if not
   *
   * @param {object} person The person object returned by GedxPersonaPOJO.prototype.getPerson
   * @returns {string} The 4-digit birth year for the person. May be empty.
   */
  GedxPersonaPOJO.prototype.getBestDeathYear = function getBestDeathYear(person) {
    var deathYear = '';

    // get the ISO date string (year should be the first 4 digits)
    var deathDate = this.getFactISODateString(this.getFact(person, "http://gedcomx.org/Death"));
    if (deathDate === "") {
      deathDate = this.getFactISODateString(this.getFact(person, "http://gedcomx.org/Burial"));
    }
    var matches = deathDate.match(/^(\d{4})/); // the first four digits should be the year
    if (matches && matches[1]) {
      deathYear = matches[1];
    }
    return deathYear;
  };

  /**
   * @param {object} person The person object (see getPerson).
   * @returns {String|null} The name for the primary person.
   */
  GedxPersonaPOJO.prototype.getBestNameValue = function getBestNameValue(person) {
    if (!person) {
      return safeName(null);
    }

    if (person.display && person.display.name) {
      return safeName(person.display.name);
    }
    if (!person.names || !person.names.length) {
      return safeName(null);
    }
    var name = person.names[0];
    if (!name.nameForms || !name.nameForms.length) {
      return safeName(null);
    }
    var nameForm = name.nameForms[0];
    return safeName(formName(nameForm.fullText));

    function formName(nameString) {
      if (!nameString && nameForm.parts && nameForm.parts.length > 0) {
        var i;
        nameString = "";
        for (i = 0; i < nameForm.parts.length; i++) {
          if (i > 0) {
            nameString += " ";
          }
          nameString += nameForm.parts[i].value;
        }
      }
      return nameString;
    }
  };

  /**
   * Return the best value from the field (interpreted if avail, otherwise original).
   *
   * @param {object} field The field.
   * @returns {string} The best value (original, or interpreted), may be empty.
   */
  GedxPersonaPOJO.prototype.getBestValue = function getBestValue(field) {
    var value = "";
    if (field && field.values) {
      for (var i = 0; i < field.values.length; i++) {
        if (field.values[i].type === "http://gedcomx.org/Original" && value.length === 0) {
          value = field.values[i].text;
        }
        else if (field.values[i].type === "http://gedcomx.org/Interpreted") {
          value = field.values[i].text;
          break;  // Interpreted values win so there's no need to continue
        }
      }
    }
    return value;
  };

  /**
   * Returns the birth place for a person.
   *
   * @param {object} person The person object returned by GedxPersonaPOJO.prototype.getPerson
   * @returns {string} The birthplace for the person. May be empty.
   */
  GedxPersonaPOJO.prototype.getBirthplace = function getBirthplace(person) {
    var place = "";
    var fact = this.getFact(person, "http://gedcomx.org/Birth");
    if (fact) {
      place = this.getFactPlace(fact);
    }
    return place;
  };

  /**
   * Returns the death place for a person.
   *
   * @param {object} person The person object returned by GedxPersonaPOJO.prototype.getPerson
   * @returns {string} The death place for the person. May be empty.
   */
  GedxPersonaPOJO.prototype.getDeathplace = function getDeathplace(person) {
    var place = "";
    var fact = this.getFact(person, "http://gedcomx.org/Death");
    if (fact) {
      place = this.getFactPlace(fact);
    }
    return place;
  };

  /**
   * Return the value for a characteristic.
   *
   * @param {object} person The person object.
   * @param {string} typeOrLabel The characteristic type (e.g. IMAGE_PAL, PR_AGE, or http://gedcomx.org/Age)
   * @returns {string|undefined} value of characteristic
   */
  GedxPersonaPOJO.prototype.getCharacteristicValue = function getCharacteristicValue(person, typeOrLabel) {
    var value;
    if (person && person.fields && typeOrLabel) {
      if (charTypeMap[typeOrLabel]) {
        typeOrLabel = charTypeMap[typeOrLabel];
      }

      var fields = getPersonFields(person, [], true);
      if (fields[typeOrLabel]) {
        value = fields[typeOrLabel].value;
      }
    }

    return value;
  };

  /**
   * Returns the citation value from the citation record.
   *
   * @param {object} citationRecord A record with only a citation.
   * @returns {string} The citation, or an empty string if not found.
   */
  GedxPersonaPOJO.prototype.getCitation = function getCitation(citationRecord) {
    var citation = "";

    if (citationRecord && citationRecord.sourceDescriptions) {
      for (var i = 0; i < citationRecord.sourceDescriptions.length; i++) {
        if (citationRecord.sourceDescriptions[i] &&
            citationRecord.sourceDescriptions[i].citations &&
            citationRecord.sourceDescriptions[i].citations[0] &&
            citationRecord.sourceDescriptions[i].citations[0].value) {
          citation = citationRecord.sourceDescriptions[i].citations[0].value;
        }
      }
    }

    return citation;
  };

  /**
   * Return the collection name for the record.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @returns {string} The collection name.
   */
  GedxPersonaPOJO.prototype.getCollectionDescription = function getCollectionDescription(personaOrRecord) {
    var collectionDescription = "";
    var srcDesc = getCollectionSourceDescription(personaOrRecord);
    if (srcDesc && srcDesc.descriptions) {
      collectionDescription = getFirst(srcDesc.descriptions).value;
    }
    return collectionDescription;
  };

  /**
   * Return the collection ID for the record.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @returns {string} The collection identifier.
   */
  GedxPersonaPOJO.prototype.getCollectionId = function getCollectionId(personaOrRecord) {
    var collectionId = "";
    var collectionURL = this.getCollectionURL(personaOrRecord);
    if (collectionURL) {
      // var parts = url.match(/collections\/(.*)[\/|\?]/);
      var parts = collectionURL.match(/collections\/(.*)/); // Strip the # off the URL
      if (parts.length > 0) {
        collectionId = parts[1];
      }
    }
    return collectionId;
  };

  /**
   * Return the mediaType for the collection's sourceDescription.
   *
   * @param {Object} collection The collection. Not NULL.
   * @return {string} The mediaType specified in the collection's sourceDescription. This is usually 'image/jpeg',
   *            but in the case of born digital it is 'application/json'. May be NULL if not defined.
   */
  GedxPersonaPOJO.prototype.getCollectionMediaType = function getCollectionMediaType(collection) {
    var mediaType = null;
    if (collection && collection.sourceDescriptions) {
      for (var i = 0; i < collection.sourceDescriptions.length; i++) {
        var srcDesc = collection.sourceDescriptions[i];
        if (srcDesc.resourceType === "http://gedcomx.org/Collection") {
          mediaType = srcDesc.mediaType || null;
          break;
        }
      }
    }
    return mediaType;
  };

  /**
   * Return the collection name for the record.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @returns {string} The collection name.
   */
  GedxPersonaPOJO.prototype.getCollectionName = function getCollectionName(personaOrRecord) {
    var collectionName = "";
    var srcDesc = getCollectionSourceDescription(personaOrRecord);
    if (srcDesc && srcDesc.titles) {
      collectionName = getFirst(srcDesc.titles).value;
    }
    return collectionName;
  };

  /**
   * Return the collection URL for the record.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @returns {string} The collection URL. May be NULL if not found.
   */
  GedxPersonaPOJO.prototype.getCollectionURL = function getCollectionURL(personaOrRecord) {
    var collectionURL = null;

    var srcDesc = getCollectionSourceDescription(personaOrRecord);
    if (srcDesc && srcDesc.identifiers) {
      collectionURL = getFirst(srcDesc.identifiers["http://gedcomx.org/Primary"]);
    }
    else {
      // console.log("Unable to get collection URL for personaOrRecord:", personaOrRecord);
    }
    return collectionURL;
  };

  /**
   * Returns the first fact of a specific type for the person.
   *
   * @param {object} person The person object returned by GedxPersonaPOJO.prototype.getPerson
   * @param {string} factType The fact type (e.g. http://gedcomx.org/Birth)
   * @returns {*} The fact or NULL if not found.
   */
  GedxPersonaPOJO.prototype.getFact = function getFact(person, factType) {
    var fact = null;

    if (person && person.facts) {
      for (var i = 0; i < person.facts.length; i++) {
        if (person.facts[i].type === factType) {
          fact = person.facts[i];
          break;
        }
      }
    }
    return fact;
  };

  /**
   * Return the date for the fact.
   *
   * @param {Object} fact The fact object returned by GedxPersonaPOJO.prototype.getFact
   * @returns {string} The date string or an empty string.
   */
  GedxPersonaPOJO.prototype.getFactDate = function getFactDate(fact) {
    var date = "";
    if (fact && fact.date) {
      if (fact.date.original && !this.isISODate(fact.date.original)) {
        date = fact.date.original;
      }
      else if (fact.date.normalized) {
        date = fact.date.normalized[0].value;
      }
    }
    return date;
  };

  /**
   * Return the ISO 8601 date string for the fact (a parsed valid date)
   *
   * @param {Object} fact The fact object, returned by GedxPersonaPOJO.prototype.getFact
   * @returns {string} the ISO 8601 date string for the fact
   */
  GedxPersonaPOJO.prototype.getFactISODateString = function getFactISODateString(fact) {

    var isoDate = "";
    if (fact && fact.date) {
      // build an array of dates
      var dates = [];
      if (fact.date.original) {
        dates.push(fact.date.original);
      }

      // look in the fields for date values
      addDateFields(dates, fact.date.fields);

      // look in the "normalized" date array (tree stores some dates there)
      addNormalized(dates, fact.date.normalized);

      // try to parse them into an ISO date, with the fallback year option
      isoDate = parseDates(dates, fact.date.fields);
    }
    return isoDate;

    // look in the fields for date values
    // side effect: modifies dateArray
    function addDateFields(dateArray, fields) {
      if (fields) {
        for (var i = 0; i < fields.length; i++) {
          var field = fields[i];
          if (field && (field.type === "http://gedcomx.org/Date") && field.values && field.values[0].text) {
            dateArray.push(field.values[0].text);
          }
        }
      }
    }

    // look in the "normalized" date array (tree stores some dates there)
    // side effect: modifies dateArray
    function addNormalized(dateArray, normalized) {
      if (normalized) {
        for (var i = 0; i < normalized.length; i++) {
          if (normalized[i].value) {
            dateArray.push(normalized[i].value);
          }
        }
      }
    }

    // try to parse them into an ISO date, with the fallback year option
    function parseDates(dateArray, fields) {
      var newISODate = searchUtilsPOJO.toISODateString(dateArray);

      // if no ISO date or year found, try one more time to get just a year from the gedx record
      if ((newISODate.length === 0) && fields) {
        for (var i = 0; i < fields.length; i++) {
          var field = fields[i];
          if (field && (field.type === "http://gedcomx.org/Year") && field.value && field.value.text) {
            newISODate = field.value.text;
            break;
          }
        }
      }
      return newISODate;
    }
  };

  /**
   * Return the place for the fact.
   *
   * @param {Object} fact The fact object returned by GedxPersonaPOJO.prototype.getFact
   * @returns {string} The place string or an empty string.
   */
  GedxPersonaPOJO.prototype.getFactPlace = function getFactPlace(fact) {
    var place = "";

    if (fact && fact.place) {
      if (fact.place.original) {
        place = fact.place.original;
      }
      else if (fact.place.normalized) {
        place = fact.place.normalized[0].value;
      }
    }
    return place;
  };

  /**
   * Returns an array of known facts for the person.
   *
   * @param {object} person The person object returned by GedxPersonaPOJO.prototype.getPerson
   * @param {string} [factType] (optional) A fact type filter (e.g. http://gedcomx.org/Birth)
   * @returns {Array} Array of all facts, filtered facts, or empty array if not found.
   */
  GedxPersonaPOJO.prototype.getFacts = function getFacts(person, factType) {
    var factList = [];

    if (person && person.facts) {
      if (factType) {
        addFacts(factList, person.facts);
      }
      else {
        factList = orderFacts(person.facts);
      }
    }

    return factList;

    // add facts relating to the fact type to the facts array
    // side effect: adds to the facts array
    function addFacts(facts, personFacts) {
      for (var i = 0; i < personFacts.length; i++) {
        if (personFacts[i].type === factType) {
          facts.push(personFacts[i]);
        }
      }
    }
  };

  /**
   * Returns an array of facts for the record.
   * @param record The record object
   * @returns {Array} Array of all facts or empty array if not found.
   */
  GedxPersonaPOJO.prototype.getAllFacts = function getAllFacts(record) {
    var i, factList = [], that = this;

    if (Array.isArray(record)) {
      for (i = 0; i < record.length; i++) {
        if (typeof record[i] === 'object') {
          factList.push(this.getAllFacts(record[i]));
        }
      }
    }
    else if (typeof record === 'object') {
      processRecord();
    }
    return flattenArray(factList);
    function processRecord() {
      for (var property in record) {
        if (property === 'facts') {
          for (i = 0; i < record.facts.length; i++) {
            factList.push(record.facts[i]);
          }
        }
        else if (typeof record[property] === 'object') {
          factList.push(that.getAllFacts(record[property]));
        }
      }
    }
  };

  /**
   * Return the place for the fact.
   *
   * @param {Object} fact The fact object returned by GedxPersonaPOJO.prototype.getFact
   * @returns {string} The place string or an empty string.
   */
  GedxPersonaPOJO.prototype.getFactValue = function getFactValue(fact) {
    var value = "";

    if (fact && fact.value) {
      value = fact.value;
    }
    return value;
  };

  /**
   * Return the year for the fact.
   *
   * @param {Object} fact The fact object returned by GedxPersonaPOJO.prototype.getFact
   * @returns {string} The place string or an empty string.
   */
  GedxPersonaPOJO.prototype.getFactYear = function getFactYear(fact) {
    var birthYear = '';
    var longDate = this.getFactISODateString(fact);
    var matches = longDate.match(/^(\d{4})/); // the first four digits should be the year
    if (matches && matches[1]) {
      birthYear = matches[1];
    }
    return birthYear;
  };

  /**
   * Returns the field for the person.
   *
   * @param {object} person The person object returned by GedxPersonaPOJO.prototype.getPerson
   * @param {string} fieldType The field type (e.g. http://familysearch.org/types/fields/FsCollectionId)
   * @returns {*} The field or NULL if not found.
   */
  GedxPersonaPOJO.prototype.getField = function getField(person, fieldType) {
    var field = null;

    if (person && person.fields) {
      for (var i = 0; i < person.fields.length; i++) {
        if (person.fields[i].type === fieldType) {
          field = person.fields[i];
          break;
        }
      }
    }
    return field;
  };

  /**
   * Get the display name for a field out of the list of display names for the collection
   *
   * @param {Object} collection - collection object
   * @param {Object} personaRecord - persona or record object
   * @param {Object} field - field to get label out of
   * @returns {string} field display name
   */
  GedxPersonaPOJO.prototype.getFieldDisplayName = function getFieldDisplayName(collection, personaRecord, field) {
    var fieldLabels = findLabels(field);
    var displayName = '';

    var collectionDesc = getRecordDescriptor(collection, personaRecord);
    if (field && collectionDesc && collectionDesc.fields) {
      var matchingFields = collectionDesc.fields.filter(findFieldLabels);
      if (matchingFields && matchingFields.length) {
        // return the first matching value
        displayName = matchingFields[0].values[0].labels[0].value;
      }
    }

    return displayName;

    function findLabels(field) {
      var labels = [];
      if (field && field.labelId) {
        labels.push(field.labelId);
      }
      if (field && field.values) {
        for (var i = 0; i < field.values.length; i++) {
          if (field.values[i].labelId) {
            labels.push(field.values[i].labelId);
          }
        }
      }
      return labels;
    }
    function findFieldLabels(item) {
      if (item.values) {
        for (var i = 0; i < item.values.length; i++) {
          var itemLabelId = item.values[i].labelId;
          if (fieldLabels.indexOf(itemLabelId) > -1) {
            return true;
          }
        }
      }
      return false;
    }
  };

  /**
   * Return the list of matching fields.
   *
   * @param {object} personaRecordOrPerson The persona record or person object
   * @param {string|regex} [fieldType] The field type name (leave empty or undefined to get all fields)
   * @param {boolean} [regex] True if the fieldType is a regular expression. (optional parameter)
   * @returns {Array} list of matching fields
   */
  GedxPersonaPOJO.prototype.getFields = function getFields(personaRecordOrPerson, fieldType, regex) {
    var fields = [];
    if (personaRecordOrPerson && personaRecordOrPerson.fields) {
      var matchFunc = function matchFunc1(field, fieldType) {
        return (field.type === fieldType);
      };

      if (regex && fieldType) {
        var regexObj = new RegExp(fieldType);
        matchFunc = function matchFunc2(field, fieldType) {
          if (regexObj.test(field.type)) {
            return true;
          }
          if (field.values) {
            for (var i = 0; i < field.values.length; i++) {
              if (regexObj.test(field.values[i].labelId)) {
                return true;
              }
            }
          }
          return false;
        };
      }

      for (var fieldIdx = 0; fieldIdx < personaRecordOrPerson.fields.length; fieldIdx++) {
        if (!fieldType || (fieldType && matchFunc(personaRecordOrPerson.fields[fieldIdx], fieldType))) {
          fields.push(personaRecordOrPerson.fields[fieldIdx]);
        }
      }

    }
    return fields;
  };

  /**
   * Return Male/Female/Unknown for the gender of the person
   *
   * @param {object} person The person object returned by GedxPersonaPOJO.prototype.getPerson
   * @returns {string} Male/Female/Unknown for the person's gender.
   */
  GedxPersonaPOJO.prototype.getGenderString = function getGenderString(person) {
    var gender = "Unknown";

    if (person && person.gender && person.gender.type) {
      switch (person.gender.type) {
        case "http://gedcomx.org/Male":
          gender = "Male";
          break;
        case "http://gedcomx.org/Female":
          gender = "Female";
          break;
        default:
          break;
      }
    }
    return gender;
  };

  /**
   * @param {object} person The person object (see getPerson).
   * @returns {String} The name for the primary person.
   */
  GedxPersonaPOJO.prototype.getGivenName = function getGivenName(person) {
    if (!person) {
      return safeName(null);
    }

    if (!person.names || !person.names.length) {
      return safeName(null);
    }
    var name = person.names[0];
    if (!name.nameForms || !name.nameForms.length) {
      return safeName(null);
    }

    return checkNameForms(name.nameForms[0]);

    // look through the name forms for the give name; if it doesn't exist, return 'Unknown'.
    function checkNameForms(nameForm) {
      if (nameForm.parts && nameForm.parts.length > 0) {
        var i;
        for (i = 0; i < nameForm.parts.length; i++) {
          if (nameForm.parts[i].type === "http://gedcomx.org/Given") {
            return safeName(nameForm.parts[i].value);
          }
        }
      }

      return safeName(null);
    }
  };

  /**
   * Collect and process the image variables.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @returns {object} imageMeta stuff
   */
  GedxPersonaPOJO.prototype.getImageMeta = function getImageMeta(personaOrRecord) {
    var imageMeta = {
      thirdPartyHostName: "",
      isExternalImage: false,
      thirdPartyURL: ""
    };
    imageMeta.imageURL = this.getImageURL(personaOrRecord);

    if (imageMeta.imageURL) {
      imageMeta.isExternalImage = imageMeta.imageURL.indexOf("familysearch.org") === -1;
      if (imageMeta.isExternalImage) {
        setExternalData(imageMeta, personaOrRecord);
      }
      else {
        imageMeta.thirdPartyHostName = "das.familysearch.org";
        imageMeta.thirdPartyURL = "";
      }
    }

    return imageMeta;

    // sets third party host name & url for an external image
    // side effect: modifies meta
    function setExternalData(meta, obj) {
      if (obj.agents)
        for (var i = 0; i < obj.agents.length; i++) {
          var agent = obj.agents[i];
          if (agent.identifiers && agent.identifiers['http://gedcomx.org/Persistent']) {
            meta.thirdPartyHostName = agent.identifiers['http://gedcomx.org/Persistent'][0];
            break;
          }
        }
      meta.thirdPartyURL = meta.imageURL;

    }
  };

  /**
   * Return the media type for the image for this record.
   *
   * @param {object} personaOrRecord The persona record object.
   * @returns {string} media type
   */
  GedxPersonaPOJO.prototype.getImageMediaType = function getImageMediaType(personaOrRecord) {
    var mediaType = "";
    var source = getSourceDescriptionByType(personaOrRecord, "http://gedcomx.org/DigitalArtifact");
    if (source) {
      if (source.mediaType) {
        mediaType = source.mediaType;
      }
    }
    return mediaType;
  };

  /**
   * Return the URL for the image for this record.
   *
   * @param {object} personaOrRecord The persona record object.
   * @returns {string} image URL
   */
  GedxPersonaPOJO.prototype.getImageURL = function getImageURL(personaOrRecord) {
    var imageUrl = "";
    var source = getSourceDescriptionByType(personaOrRecord, "http://gedcomx.org/DigitalArtifact");
    if (source) {
      if (source.about) {
        imageUrl = source.about;
      }
      else if (source.identifiers && source.identifiers["http://gedcomx.org/Persistent"] && source.identifiers["http://gedcomx.org/Persistent"][0]) {
        imageUrl = source.identifiers["http://gedcomx.org/Persistent"][0];
      }
    }
    return imageUrl;
  };

  /**
   * Return the marriage fact for a person
   * Searches through the relationship data for a marriage fact
   *
   * @param {object} personaRecord The person record object.
   * @param {object} focusPerson The person object.
   * @returns {{}} Fact
   */
  GedxPersonaPOJO.prototype.getMarriageFact = function getMarriageFact(personaRecord, focusPerson) {
    var fact = {};
    var focusRelationships = getRelationships(personaRecord, focusPerson);
    for (var i = 0; i < focusRelationships.length; i++) {
      if (focusRelationships[i].facts && (focusRelationships[i].type === "http://gedcomx.org/Couple")) {
        fact = getCoupleFact(focusRelationships[i]);
      }
    }
    return fact;

    function getCoupleFact(focusRelationship) {
      var coupleFact = {};
      for (var j = 0; j < focusRelationship.facts.length; j++) {
        if (focusRelationship.facts[j].type === "http://gedcomx.org/Marriage") {
          coupleFact = focusRelationship.facts[j];
          break;
        }
      }
      return coupleFact;
    }
  };

  /**
   * Return all marriage facts for one or more person/spouse relationships
   * Searches through the relationship data for all marriage facts for a couple relationship
   *
   * @param {object} personaRecord The person record object.
   * @param {object} focusPerson The person object.
   * @param {object} spousePerson The spouse in the relationship to find
   * @returns {[]} Facts
   */
  GedxPersonaPOJO.prototype.getMarriageFacts = function getMarriageFacts(personaRecord, focusPerson, spousePerson) {
    var facts = [];
    var focusRelationships = getRelationships(personaRecord, focusPerson);
    for (var i = 0; i < focusRelationships.length; i++) {
      if (focusRelationships[i].facts && (focusRelationships[i].type === "http://gedcomx.org/Couple")) {
        addCoupleFacts(facts, spousePerson, focusRelationships[i]);
      }
    }
    return facts;

    // adds all found couple facts to the fact list
    // side effect: adds facts to factList
    function addCoupleFacts(factList, spousePersona, focusRelationship) {
      var spousePid = '#' + spousePersona.id;
      if (focusRelationship.person1.resource === spousePid || focusRelationship.person2.resource === spousePid) {
        for (var j = 0; j < focusRelationship.facts.length; j++) {
          factList.push(focusRelationship.facts[j]);
        }
      }
    }
  };

  /**
   * Returns the obituary data for display.
   *
   * @param {Object} collection The collection object with the field descriptor (display names)
   * @param {object} personaRecord The person record object.
   * @param {object} focusPerson The person object.
   * @returns {object} relatives object
   */
  GedxPersonaPOJO.prototype.getObituaryData = function getObituaryData(collection, personaRecord, focusPerson) {
    var relatives = {
      parentsSiblings: [],
      spouseChildren: [],
      deceasedPersons: [],
      extendedFamily: [],
      othersOnRecord: []
    };
    var parentSiblingTypes = ['father', 'mother', 'brother', 'sister', 'sibling', 'parent'];
    var spouseChildrenTypes = ['husband', 'wife', 'spouse', 'daughter', 'step-daughter', 'son', 'step-son', 'child',
      'step-child'];
    var extendedFamilyTypes = ['cousin', 'uncle', 'aunt', 'grandfather', 'grandmother', 'grandparent', 'son-in-law',
      'daughter-in-law', 'father-in-law', 'mother-in-law', 'brother-in-law', 'sister-in-law', 'child-in-law',
      'soninlaw', 'daughterinlaw', 'fatherinlaw', 'motherinlaw', 'brotherinlaw', 'sisterinlaw', 'childinlaw', 'siblinginlaw', 'parentinlaw',
      'niece', 'nephew', 'grandson', 'granddaughter', 'grandchild', 'sibling-in-law', 'parent-in-law'];
    var that = this;

    if (personaRecord && personaRecord.persons) {
      for (var i = 0; i < personaRecord.persons.length; i++) {
        addObitRelative(collection, personaRecord, focusPerson);
      }
    }

    function addObitRelative(coll, object, focusPersona) {
      var person = object.persons[i];
      person.personBestName = that.getBestNameValue(person);
      person.url = that.getPersonUrl(object, person);
      if (person.principal) {
        relatives.deceasedPersons.push(processDeceasedPerson(coll, object, focusPersona, person));
      }
      else {
        if (focusPersona.id === person.id) { // don't put the focus person in the 'relatives' section
          return;
        }
        person.localizedGender = that.getGenderString(person);
        person.relationship = getRelationshipToDeceased(object, focusPersona, person);
        var rel = person.relationship.toLowerCase();
        if (-1 !== parentSiblingTypes.indexOf(rel)) {
          relatives.parentsSiblings.push(person);
        }
        else if (-1 !== spouseChildrenTypes.indexOf(rel)) {
          relatives.spouseChildren.push(person);
        }
        else if (-1 !== extendedFamilyTypes.indexOf(rel)) {
          relatives.extendedFamily.push(person);
        }
        else {
          relatives.othersOnRecord.push(person);
        }
      }

    }
    return relatives;
  };

  /**
   * Get the other persons on the record from the characteristics
   *
   * @param {object} personaRecord The persona record object.
   * @returns {Array} other persons on record
   */
  GedxPersonaPOJO.prototype.getOtherPersonsOnRecord = function getOtherPersonsOnRecord(personaRecord) {
    var personArray = [];
    var nameFields = this.getFields(personaRecord, "http://familysearch.org/types/fields/OtherOnPageName\\d", true);
    var urlFields = this.getFields(personaRecord, "http://familysearch.org/types/fields/OtherOnPageUrl\\d", true);

    for (var i = 0; i < nameFields.length; i++) {
      var otherPerson = {};
      var nameNum = nameFields[i].type.substring("http://familysearch.org/types/fields/OtherOnPageName".length);
      otherPerson.name = this.getBestValue(nameFields[i]);
      for (var j = 0; j < urlFields.length; j++) {
        var urlNum = urlFields[j].type.substring("http://familysearch.org/types/fields/OtherOnPageUrl".length);
        if (nameNum === urlNum) {
          otherPerson.url = this.getBestValue(urlFields[j]);
        }
      }
      personArray.push(otherPerson);
    }
    return personArray;
  };

  /**
   * Returns parents and siblings in organized objects
   * Note: Only puts parents and siblings together if there is an explicit relationship for them
   *
   * @param {object} personaRecord - gedx persona or record
   * @param {object} focusPerson - person to get parents & siblings for
   * @returns {Array} parents and siblings [{ parents: [person], siblings: [person] }]
   */
  GedxPersonaPOJO.prototype.getParentsAndSiblings = function getParentsAndSiblings(personaRecord, focusPerson) {
    var i, parentsAndSiblings = [];
    var focusRelationships = getRelationships(personaRecord, focusPerson);
    var parents = getParents(personaRecord, focusPerson, focusRelationships);
    var allSiblings = getSiblings(personaRecord, focusPerson, focusRelationships);

    // store found siblings so we know if there are extras at the end; mark focus person as found
    var foundSiblings = [focusPerson];

    // store processed couple relationships so they aren't processed twice
    var foundCouples = {};

    for (i = 0; i < parents.length; i++) {
      var parent1Spouses = getSpouses(personaRecord, parents[i]);
      var parent1Relationships = getRelationships(personaRecord, focusPerson);
      var allParent1Children = getChildren(personaRecord, parents[i]);
      var spousesNotParents = [];

      for (var j = 0; j < parent1Spouses.length; j++) {

        // skip couple relationships that have already been processed
        if (foundCouples[parent1Spouses[j].id + '-' + parents[i].id] === true) {
          continue;
        }

        // handle couple relationship, with children if there are any
        var parentObject = {
          parents: [parents[i], parent1Spouses[j]]
        };
        parentObject.siblings = getChildrenWithSpouse(personaRecord, parents[i], parent1Spouses[j], parent1Relationships);

        // if focus person is not in the list, add parent to spousesNotParents
        // so we can move this family to the end of the parentsAndSiblings array
        if (!parentObject.siblings.find(findPerson, focusPerson)) {
          spousesNotParents.push(parent1Spouses[j]);
        }

        // remove focus person from list
        parentObject.siblings = parentObject.siblings.filter(filterPersonArray, { persons: [focusPerson] });
        parentsAndSiblings.push(parentObject);
        foundSiblings = foundSiblings.concat(parentObject.siblings);

        // mark this couple relationship as processed
        foundCouples[parents[i].id + '-' + parent1Spouses[j].id] = true;
      }

      // move families where the 2nd parent isn't the focus person's parent to the end
      parentsAndSiblings.sort(orderFamilies);

      // handle parent1-only family if children are left OR if no spouses
      var extraParent1Children = allParent1Children.filter(filterPersonArray, { persons: foundSiblings });
      if (extraParent1Children.length || (parent1Spouses.length === 0)) {
        var extraParentObject = {
          parents: [parents[i]]
        };
        extraParentObject.siblings = extraParent1Children;
        parentsAndSiblings.push(extraParentObject);
        foundSiblings = foundSiblings.concat(extraParent1Children);
      }
    }

    // handle no-parent family if children are still left
    var extraSiblings = allSiblings.filter(filterPersonArray, { persons: foundSiblings });
    if (extraSiblings && extraSiblings.length) {
      parentsAndSiblings.push({
        parents: [],
        siblings: extraSiblings
      });
    }

    return parentsAndSiblings;

    function orderFamilies(a, b) {
      var aIsParent = 1;
      if (spousesNotParents.find(findPerson, a.parents[1])) {
        aIsParent = 0;
      }
      var bIsParent = 1;
      if (spousesNotParents.find(findPerson, b.parents[1])) {
        bIsParent = 0;
      }
      return -(aIsParent - bIsParent);
    }
  };

  /**
   * Return the person for the given person Id.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @param {string|null} [idOrUrl] The person Id or URL. May be NULL for main person.
   * @returns {Object} GxPerson The person matching the personId or NULL if not found.
   */
  GedxPersonaPOJO.prototype.getPerson = function getPerson(personaOrRecord, idOrUrl) {
    if (!personaOrRecord) {
      // console.log("Warning: GedxPersonaPOJO.getPerson called with no personaOrRecord");
      return null;
    }

    if (!idOrUrl) {
      var mainSrcDesc = getMainSourceDescription(personaOrRecord);
      if (!mainSrcDesc) {
        // console.log("Warning: GedxPersonaPOJO.getPerson has no main source description");
        return null;
      }
      idOrUrl = mainSrcDesc.about;  // get the main person
    }

    var person = null;
    if (personaOrRecord.persons) {
      for (var i = 0; i < personaOrRecord.persons.length; i++) {
        if (isPersonMatch(personaOrRecord.persons[i], idOrUrl)) {
          person = personaOrRecord.persons[i];
          break;
        }
      }
    }
    if (!person) {
      // console.log("Warning: GedxPersonaPOJO.getPerson unable to find person by idOrUrl=", idOrUrl);
    }
    return person;
  }; // getPerson()

  /**
   * Return the characteristics for the given person (age, birth, gender).
   *
   * @param {object} person The person
   * @return {Object} Object with properties charName:charValue
   */
  GedxPersonaPOJO.prototype.getPersonCharacteristics = function getPersonCharacteristics(person) {
    var chars = {};

    var ageKey = "http://gedcomx.org/Age";
    var ageField = this.getField(person, ageKey);
    if (ageField) {
      chars[ageKey] = this.getBestValue(ageField);
    }

    var birthPlace = this.getBirthplace(person);
    if (birthPlace.length > 0) {
      chars['http://gedcomx.org/Birthplace'] = birthPlace;
    }

    chars["http://gedcomx.org/Gender"] = this.getGenderString(person);

    return chars;
  };

  /**
   * Return the citation for the person if there is one.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @param {object} person The person from the record.
   * @returns {string} The citation or NULL if none found.
   */
  GedxPersonaPOJO.prototype.getPersonCitation = function getPersonCitation(personaOrRecord, person) {
    var citation = null;

    if (personaOrRecord && person) {
      var srcDesc = getSourceDescriptionForPerson(personaOrRecord, person);
      if (srcDesc) {
        citation = getFirst(srcDesc.citations).value;
      }
    }

    return citation;
  };

  /**
   * Return a list of the person IDs from the record.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @returns {[string]} the person IDs from the record
   */
  GedxPersonaPOJO.prototype.getPersonIds = function getPersonIds(personaOrRecord) {
    if (!personaOrRecord) {
      // console.log("Warning: GedxPersonaPOJO.getPerson called with no personaOrRecord");
      return null;
    }

    var ids = [];

    if (personaOrRecord.persons) {
      for (var i = 0; i < personaOrRecord.persons.length; i++) {
        var person = personaOrRecord.persons[i];
        ids.push(person.id);
      }
    }
    return ids;
  };

  GedxPersonaPOJO.prototype.getPersonImageURL = function getPersonImageURL(personaOrRecord, person) {
    var imageURL = null;

    if (personaOrRecord && person && person.sources) {
      var srcDescID = getFirst(person.sources).description;
      var srcDesc = this.getSourceDescription(personaOrRecord, srcDescID);
      if (srcDesc) {
        imageURL = getFirst(srcDesc.identifiers["http://gedcomx.org/Persistent"]);
      }
    }

    return imageURL;
  };

  /**
   * Find the record descriptor in the collection for a person.
   *
   * @param {Object} collection The collection. Not NULL.
   * @param {object} personaOrRecord The persona or record object. Not NULL.
   * @param {string} [personId] The person ID. Optional.
   * @returns {*} The record descriptor or NULL if not found.
   */
  GedxPersonaPOJO.prototype.getPersonRecordDescriptor = function getPersonRecordDescriptor(collection, personaOrRecord, personId) {
    var descriptor = null;
    var srcDesc = null;

    if (!personId) {
      srcDesc = getMainSourceDescription(personaOrRecord);
    }
    else {
      var person = this.getPerson(personaOrRecord, personId);
      if (person) {
        srcDesc = getSourceDescriptionForPerson(personaOrRecord, person);
      }
    }

    while (srcDesc && !srcDesc.descriptor && srcDesc.componentOf) {
      srcDesc = GedxPersonaPOJO.prototype.getSourceDescription(personaOrRecord, srcDesc.componentOf.description);
    }

    if (srcDesc) {
      var ref = srcDesc.descriptor.resource;
      var pos = ref.indexOf('#');
      if (pos > 0) {
        descriptor = getCollectionRecordDescriptor(collection, ref.substring(pos + 1));
      }
    }

    return descriptor;
  }; // getPersonRecordDescriptor()

  /**
   * Return the person title if there is one.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @param {object} person The person from the record.
   * @returns {string} The title or NULL if none found.
   */
  GedxPersonaPOJO.prototype.getPersonTitle = function getPersonTitle(personaOrRecord, person) {
    var title = null;

    if (personaOrRecord && person) {
      var srcDesc = getSourceDescriptionForPerson(personaOrRecord, person);
      if (srcDesc) {
        title = getFirst(srcDesc.titles).value;
      }
    }

    return title;
  };

  /**
   * Return the URL for a person on the record.
   *
   * @param {object} personaOrRecord The persona record object.
   * @param {string|{identifiers}} personOrId The person identifier
   * @returns {string} The url for the person
   */
  GedxPersonaPOJO.prototype.getPersonUrl = function getPersonUrl(personaOrRecord, personOrId) {
    var url = null;
    if (personOrId && personOrId.identifiers) {
      person = personOrId;
    }
    else {
      var person = this.getPerson(personaOrRecord, personOrId);
    }
    if (person) {
      url = getFirst(person.identifiers["http://gedcomx.org/Persistent"]);
    }
    return url;
  };

  /**
   * Return the name for the principal(s) on the record
   *
   * @param {object} personaOrRecord The persona or record object.
   * @returns {object} principal person in the record
   */
  GedxPersonaPOJO.prototype.getPrincipalOnRecord = function getPrincipalOnRecord(personaOrRecord) {
    var principalPerson;
    var principals = [];
    for (var i = 0; i < personaOrRecord.persons.length; ++i) {
      if (personaOrRecord.persons[i].principal) {
        var name = this.getBestNameValue(personaOrRecord.persons[i]);
        if (name) {
          var gender = this.getGenderString(personaOrRecord.persons[i]);
          principals.push({name: name, gender: gender});
        }
      }
    }

    if (principals.length === 2) {
      if (principals[0].gender === "Male") {
        principalPerson = [principals[0].name, principals[1].name];
      }
      else {
        principalPerson = [principals[1].name, principals[0].name];
      }
    }
    else if (principals.length === 0) {
      principalPerson = this.getBestNameValue(personaOrRecord);
    }
    else {
      principalPerson = principals[0].name;
    }
    return principalPerson;
  };

  /**
   * Determines if the record has been retired.
   *
   * @param {object} personaRecord The person record object.
   * @return {string|null} The URL of the new record if it has been retired, otherwise NULL.
   */
  GedxPersonaPOJO.prototype.getRecordRetiredURL = function getRecordRetiredURL(personaRecord) {
    var url = null;
    var mainDesc = getMainSourceDescription(personaRecord);
    if (mainDesc && mainDesc.replacedBy) {
      url = mainDesc.replacedBy;
    }
    else {
      // In the odd event that the record has been redirected but the persona has not we will use the record redirect.
      // This will navigate to our record details page using the first person in the new record since the person we
      // were trying to view is no longer in the new record.
      var srcDesc = getSourceDescriptionByType(personaRecord, "http://gedcomx.org/Record");
      if (srcDesc.replacedBy) {
        // console.log("Warning: Record has been retired but the persona has not been redirected - using record instead");
        url = srcDesc.replacedBy;
      }
    }

    return url;
  };

  /**
   * Return the record type
   * @param {object} personaOrRecord The persona or record object.
   * @returns {Boolean | String} the record type (e.g. http://gedcomx.org/Census)
   */
  GedxPersonaPOJO.prototype.getRecordType = function getRecordType(personaOrRecord) {
    var recordType = null;

    var srcDesc = getMainSourceDescription(personaOrRecord);
    if (!srcDesc) {
      return false;
    }
    while (srcDesc && !srcDesc.coverage) {
      srcDesc = srcDesc.componentOf ? this.getSourceDescription(personaOrRecord, srcDesc.componentOf.description) : null;
    }
    if (srcDesc && srcDesc.coverage.length > 0) {
      for (var i = 0; i < srcDesc.coverage.length; i++) {
        if (srcDesc.coverage[i].recordType) {
          recordType = srcDesc.coverage[i].recordType;
          break;
        }
      }
    }
    return recordType;
  };

  /**
   * Find the data provider for this record
   *
   * @param {Object} personaOrRecord The persona or record object.
   * @returns {string} URL of data owner.
   */
  GedxPersonaPOJO.prototype.getRecordProvider = function getRecordProvider(personaOrRecord) {
    var provider = '';
    if (personaOrRecord.agents) {
      for (var i = 0; i < personaOrRecord.agents.length; i++) {
        var agent = personaOrRecord.agents[i];
        if (agent.identifiers && agent.identifiers['http://gedcomx.org/Persistent']) {
          provider = agent.identifiers['http://gedcomx.org/Persistent'][0];
          break;
        }
      }
    }
    return provider;
  };

  GedxPersonaPOJO.prototype.getRecordURL = function getRecordURL(personaOrRecord) {
    var recordURL = null;

    var srcDesc = getSourceDescriptionByType(personaOrRecord, "http://gedcomx.org/Record");
    if (srcDesc) {
      recordURL = srcDesc.about;
    }

    return recordURL;
  }; // getRecordURL()

  /**
   * Return the relationship information between two people on the record.
   *
   * @param {object} personaRecord The record
   * @param {object} focusPerson The focus person object
   * @param {object} person The person object (the result is how person is related to focusPerson)
   * @returns {*} - null if focusPerson and person are the same or no relationship is found.
   *    category: {"spouseChildren"|"parentsSiblings"|"extendedFamily"}
   *    gedcomxType: gedcomx type string (e.g. http://gedcomx.org/Couple, http://familysearch.org/types/relationships/Sibling, etc.)
   *    labelKey: label key (e.g. GrandParent.p1.M = Grandson, Grandparent.p2.M = Grandfather, etc.)
   *    label: I18N label for the relationship (e.g. "Grandson", "Grandfather", etc.)
   */
  GedxPersonaPOJO.prototype.getRelationshipType = function getRelationshipType(personaRecord, focusPerson, person) {
    var relationship = null;
    if (focusPerson.id !== person.id) {
      var genderType = GedxPersonaPOJO.prototype.getGenderString(person).charAt(0);

      var relList = getRelationships(personaRecord, person);
      if (relList) {
        relationship = findRelationshipToFocusPerson(relList, focusPerson, genderType);
      }

      if (!relationship) {
        // Check for siblings by looking at the parents of both persons
        relationship = getSiblingTypeFromParents(personaRecord, focusPerson, person);
      }
    }
    return relationship;

    function findRelationshipToFocusPerson(relationships, focusPersona, gender) {
      var focusPersonId = "#" + focusPersona.id;
      var foundRelationship;
      for (var i = 0; i < relationships.length; i++) {
        var rel = relationships[i];
        var relPosition;
        if (rel.person1.resource === focusPersonId) {
          relPosition = 'p1';
        }
        else if (rel.person2.resource === focusPersonId) {
          relPosition = 'p2';
        }
        else {
          // relationship does not include focus person
          continue;
        }
        var newRel = getRelationship(rel, relPosition, gender);
        if (newRel) {
          foundRelationship = newRel;
          break;
        }
      }
      return foundRelationship;
    }

    function getRelationship(rel, relPosition, personGender) {
      var foundRelationship = null;
      var j;

      // For some relationships there is a specific ID that specifies a narrower type (like step child)
      // If this relationship has a specific ID we will also try to match it against the relationshipTypeMap
      var relTypeId = null;
      if (rel.fields) {
        for (j = 0; j < rel.fields.length; j++) {
          var relField = rel.fields[j];
          if (relField.type === "http://familysearch.org/RelativeType") {
            relTypeId = relField.values[0].resource;
            break;
          }
        }
      }

      for (j = 0; j < relationshipTypeMap.length; j++) {
        var newRel = getRelationshipForMap(relationshipTypeMap[j], relTypeId, rel, relPosition, personGender);
        if (newRel) {
          foundRelationship = newRel;
          break;
        }
      }

      if (!foundRelationship) {
        // console.log("Warning: unhandled relationship type encountered:" + ((rel && rel.type) ? rel.type : "undefined"));
        foundRelationship = getRelationshipTypeFromMap(unknownRelationship, "p1", personGender);
      }
      return foundRelationship;
    }

    function getRelationshipForMap(map, relTypeId, rel, relPosition, personGender) {
      if (map.type === rel.type) {

        // the default map will have no id, so we only need to check when the map isn't the default
        if (map.id) {
          if (map.id === relTypeId) {
            return getRelationshipTypeFromMap(map, relPosition, personGender);
          }
        }
        else {
          return getRelationshipTypeFromMap(map, relPosition, personGender);
        }
      }
      return null;
    }

    /**
     * Using the parents of both person objects, determine if a sibling relationship exists.
     *
     * @param {object} personaRecord The record
     * @param {object} focusPerson The focus person object
     * @param {object} person The person object
     * @returns {*} - null if not found.
     *    category: {"spouseChildren"|"parentsSiblings"|"extendedFamily"}
     *    gedcomxType: gedcomx type string (e.g. http://gedcomx.org/Couple, http://familysearch.org/types/relationships/Sibling, etc.)
     *    labelKey: label key (e.g. GrandParent.p1.M = Grandson, Grandparent.p2.M = Grandfather, etc.)
     *    label: I18N label for the relationship (e.g. "Grandson", "Grandfather", etc.)
     */
    function getSiblingTypeFromParents(personaRecord, focusPerson, person) {
      var relationship = null;
      var genderType = GedxPersonaPOJO.prototype.getGenderString(person).charAt(0);

      // Check to see if these person objects share a parent
      var focusParents = getParents(personaRecord, focusPerson);
      var parents = getParents(personaRecord, person);
      var found = false;
      for (var i = 0; i < focusParents.length; i++) {
        for (var j = 0; j < parents.length; j++) {
          if (focusParents[i].id === parents[j].id) {
            // Sibling relation doesn't differentiate on relPosition so we just hardcode it to 'p1'.
            relationship = getRelationshipTypeFromMap(siblingRelationship, 'p1', genderType);
            found = true;
            break;
          }
        }
        if (found) {
          break;
        }
      }
      return relationship;
    } // getSiblingTypeFromParents()

    /**
     * Construct the relationshipType object from the map as appropriate for the person's gender.
     *
     * @param {object} map The relationship map entry.
     * @param {string} relPosition The relative position in the map (e.g. 'p1' or 'p2')
     * @param {string} genderType The gender type (e.g. 'M', 'F', or 'U')
     * @returns {{category: string, gedcomxType: string, labelKey: string, label: string}} relationship type object
     */
    function getRelationshipTypeFromMap(map, relPosition, genderType) {
      var category = map.category ? map.category : map[relPosition].category;
      var labelKey = map[relPosition][genderType];

      return {
        category: category,
        gedcomxType: map.type,
        labelKey: labelKey,
        label: labelKey
      };
    }

  }; // getRelationshipType()

  /**
   * Return the person's role in the record. Ported from backend getRoleInRecord function, except it gives
   * priority to the characteristic RelationshipToHead.
   *
   * @param {object} personaRecord The persona or record object
   * @param {object} person The person object
   * @param {object} focusPerson The focus person object
   * @return {string} The role in record or null.
   */
  GedxPersonaPOJO.prototype.getRoleInRecord = function getRoleInRecord(personaRecord, person, focusPerson) {
    var role = getRelationshipToHead(personaRecord, person, focusPerson);
    var isMarriage = this.isMarriage(personaRecord);
    var principal = null;
    var spouse = null;
    var parents = null;
    var spouseParents = null;
    var children = null;

    var that = this;
    if (!role && personaRecord.persons && personaRecord.persons.length) {
      for (var i = 0; i < personaRecord.persons.length; ++i) {
        // Find a principal person on the record
        var result = getPrincipalPerson(i);
        if (result) {
          return result;
        }
      }

      if (principal == null) {
        return "other"; // couldn't find a principal. Odd.
      }

      if (isPersonMatch(person, principal.id)) {
        return isMarriage ? "groom" : "principal";
      }
      spouse = getSpouses(personaRecord, principal);
      if (spouse.length > 0) {
        spouse = spouse[0];
      }

      if (isPersonMatch(person, spouse.id)) {
        return isMarriage ? "bride" : "spouse";
      }

      parents = getParents(personaRecord, principal);

      for (i = 0; i < parents.length; ++i) {
        var parentRole = getParentRole(i);
        if (parentRole) {
          return parentRole;
        }
      }

      spouseParents = getParents(personaRecord, spouse);
      for (i = 0; i < spouseParents.length; ++i) {
        var inlawRole = getInlawRole(i);
        if (inlawRole) {
          return inlawRole;
        }
      }

      children = getChildren(personaRecord, spouse);
      for (i = 0; i < children.length; ++i) {
        if (isPersonMatch(person, children[i].id)) {
          return "child";
        }
      }

      return "other";
    }

    return role;

    function getParentRole(i) {
      if (isPersonMatch(person, parents[i].id)) {
        // focus person is a parent of the principal person
        if (parents[i].gender === "M") {
          return isMarriage ? "father-of-groom" : "father";
        }
        else if (parents[i].gender === "F") {
          return isMarriage ? "mother-of-groom" : "mother";
        }
      }
    }
    function getInlawRole(i) {
      if (isPersonMatch(person, spouseParents[i].id)) {
        // focus person is a parent of the principal person
        if (spouseParents[i].gender === "M") {
          return isMarriage ? "father-of-bride" : "father-in-law";
        }
        else if (spouseParents[i].gender === "F") {
          return isMarriage ? "mother-of-bride" : "mother-in-law";
        }
      }
    }
    function getPrincipalPerson(i) {
      if (personaRecord.persons[i].principal === true
          && (that.getGenderString(personaRecord.persons[i]) === "Male" || !isMarriage)) {
        if (that.isCensus(personaRecord) && isPersonMatch(person, personaRecord.persons[i].id)) {
          return "principal";
        }
        if (principal == null
            || (that.getGenderString(principal) === "Female"
                && that.getGenderString(personaRecord.persons[i].id) === "Male")) {
          principal = personaRecord.persons[i];
        }
      }
    }
  };

  /**
   * Return the source description.
   *
   * @param {object} personaOrRecord The gedx response data.
   * @param {string} sourceIdOrUrl The source ID or URL.
   * @returns {*} The source description.
   */
  GedxPersonaPOJO.prototype.getSourceDescription = function getSourceDescription(personaOrRecord, sourceIdOrUrl) {
    var source = null;

    if (personaOrRecord && sourceIdOrUrl) {
      if (sourceIdOrUrl.charAt(0) === '#') {
        sourceIdOrUrl = sourceIdOrUrl.substring(1);
      }

      if (personaOrRecord.sourceDescriptions) {
        parseSourceDesc();
      }
    }
    return source;

    function parseSourceDesc() {
      for (var i = 0; i < personaOrRecord.sourceDescriptions.length; i++) {
        var srcDesc = personaOrRecord.sourceDescriptions[i];
        if (srcDesc.about === sourceIdOrUrl || srcDesc.id === sourceIdOrUrl) {
          source = srcDesc;
          break;
        }
      }
    }
  }; // getSourceDescription()

  /**
   * Returns spouses and children in organized objects
   * Note: Only puts spouses and children together if there is an explicit relationship for them
   *
   * @param {object} personaRecord - gedx persona or record
   * @param {object} focusPerson - person to get spouses & children for
   * @returns {Array} [{ spouse: person, children: [person] }]
   */
  GedxPersonaPOJO.prototype.getSpousesAndChildren = function getSpousesAndChildren(personaRecord, focusPerson) {
    var i, spousesAndChildren = [];
    var focusRelationships = getRelationships(personaRecord, focusPerson);
    var spouses = getSpouses(personaRecord, focusPerson, focusRelationships);
    var allChildren = getChildren(personaRecord, focusPerson, focusRelationships);
    var foundChildren = [];

    for (i = 0; i < spouses.length; i++) {
      var spouseObject = {
        spouse: spouses[i]
      };
      spouseObject.children = getChildrenWithSpouse(personaRecord, focusPerson, spouses[i], focusRelationships);
      spousesAndChildren.push(spouseObject);
      foundChildren = foundChildren.concat(spouseObject.children);
    }

    var extraChildren = allChildren.filter(filterPersonArray, { persons: foundChildren });
    if (extraChildren && extraChildren.length) {
      spousesAndChildren.push({
        spouse: null,
        children: extraChildren
      });
    }

    return spousesAndChildren;
  };

  /**
   * @param {object} person The person object (see getPerson).
   * @returns {String} The name for the primary person.
   */
  GedxPersonaPOJO.prototype.getSurname = function getSurname(person) {
    if (!person) {
      return safeName(null);
    }

    if (!person.names || !person.names.length) {
      return safeName(null);
    }
    var name = person.names[0];
    if (!name.nameForms || !name.nameForms.length) {
      return safeName(null);
    }
    var nameForm = name.nameForms[0];
    if (nameForm.parts && nameForm.parts.length > 0) {
      var i;
      for (i = 0; i < nameForm.parts.length; i++) {
        if (nameForm.parts[i].type === "http://gedcomx.org/Surname") {
          return safeName(nameForm.parts[i].value);
        }
      }
    }

    return safeName(null);
  };

  /**
   * Determines if the record is a census record or not.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @returns {boolean} True if the record is a census, otherwise false.
   */
  GedxPersonaPOJO.prototype.isCensus = function isCensus(personaOrRecord) {
    return this.getRecordType(personaOrRecord) === "http://gedcomx.org/Census";
  };

  /**
   * Determines if the date is in ISO format or not.
   *
   * @param {string} date The date.
   * @returns {boolean} True if the record in ISO format, otherwise false.
   */
  GedxPersonaPOJO.prototype.isISODate = function isISODate(date) {
    return (/^\d+$/.test(date) && date.length === 8);
  };

  /**
   * Determines if the record is a marriage record or not.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @returns {boolean} True if the record is a marriage, otherwise false.
   */
  GedxPersonaPOJO.prototype.isMarriage = function isMarriage(personaOrRecord) {
    return this.getRecordType(personaOrRecord) === "http://gedcomx.org/Marriage";
  };

  /**
   * Determines if the record is a obituary record or not.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @returns {boolean} True if the record is a obituary, otherwise false.
   */
  GedxPersonaPOJO.prototype.isObituary = function isObituary(personaOrRecord) {
    var recordType = this.getRecordType(personaOrRecord);
    return ((recordType === "http://familysearch.org/types/records/Obituary") || (recordType === "http://gedcomx.org/Obituary"));
  };

  /**
   * Determines if the record was indexed by a computer (e.g. 'robokeyed').
   *
   * @param personaOrRecord The persona or record object.
   * @returns {boolean} True if the record was indexed by a computer, otherwise false.
   */
  GedxPersonaPOJO.prototype.isRobokey = function isRobokey(personaOrRecord) {
    var fields = personaOrRecord.fields;
    if (fields && fields.length) {
      for (var i = 0; i < fields.length; ++i) {
        if (fields[i].type &&
            fields[i].type.match("RecordGroup") &&
            fields[i].values &&
            fields[i].values[0] &&
            fields[i].values[0].text === "OutputDeliveryAllRobo") {
          return true;
        }
      } // for (...fields.length...)
    } // if (...fields...)
    return false;
  };

  /**
   * Get the map of the immediate family for the given person.
   *
   * @param {object} personaRecord The persona record object.
   * @param {object} person The person object.
   * @returns {Object} family map
   * {
   *    father: {relative},
   *    mother: {relative},
   *    parent: {relative},
   *    husband: {relative},
   *    wife: {relative},
   *    child: [{relative}]
   *  }
   */
  GedxPersonaPOJO.prototype.mapImmediateFamily = function mapImmediateFamily(personaRecord, person) {
    var i;

    // TODO - there is a bug here that is not getting the spouse of a non-primary person
    var family = {
      child: []
    };

    if (!personaRecord || !person || !person.id || !personaRecord.persons || personaRecord.persons.length < 2) {
      return family;
    }

    var relationships = getRelationships(personaRecord, person);
    family.child = getChildren(personaRecord, person, relationships);
    var spouses = getSpouses(personaRecord, person, relationships);
    var genderType = GedxPersonaPOJO.prototype.getGenderString(person).charAt(0);
    for (i = 0; i < spouses.length; i++) {
      if (spouses[i].gender === "M" || genderType === "M") {
        family.husband = spouses[i];
      }
      else if (spouses[i].gender === "F" || genderType === "F") {
        family.wife = spouses[i];
      }
      else {
        family.spouse = spouses[i];
      }
    }

    var parents = getParents(personaRecord, person, relationships);
    for (i = 0; i < parents.length; i++) {
      if (parents[i].gender === "M") {
        family.father = parents[i];
      }
      else if (parents[i].gender === "F") {
        family.mother = parents[i];
      }
      else {
        family.parent = parents[i];
      }
    }

    family.siblings = getSiblings(personaRecord, person, relationships);
    return family;
  };

  /**
   * This is for a CENSUS record only.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @param {object} person The person object.
   * @returns {Array|null} relative map
   */
  GedxPersonaPOJO.prototype.mapRelatives = function mapRelatives(personaOrRecord, person) {
    var relatives = null;

    if (personaOrRecord && person && person.id && personaOrRecord.persons && personaOrRecord.persons.length >= 2) {
      relatives = [];

      for (var i = 0; i < personaOrRecord.persons.length; i++) {
        var recordPerson = personaOrRecord.persons[i];
        var relative = newRelativeFromPerson(personaOrRecord, recordPerson, person, true);
        relatives.push(relative);
      }
    }
    return relatives;
  };

  /**
   * Get the fields populated for the focus person using the fields from the collection.
   *
   * GedcomX FieldMap code, used for dealing with 'labelId' in field values, and finding corresponding display labels
   * in record descriptors in the record's collection.
   * -  Records have fields with field values with label IDs and text values.
   * -  Records also have a source description with a record descriptor reference.
   * -  Collections have record descriptors with field descriptors with field value descriptors, which have labelId
   *    and optional localized display labels.
   * -  The "#" part of the record descriptor reference matches the local id of the record descriptor.
   * @param {object} collection The collection object with the field descriptor (display names)
   * @param {object} personaRecord The persona record object.
   * @param {string|null} [personId] The ID of the person to process. May be NULL for the main person.
   * @returns {Array} [{*}] the list of fields for the focus person
   */
  GedxPersonaPOJO.prototype.populateFocusPersonFields = function populateFocusPersonFields(collection, personaRecord, personId) {
    var i, fields = [];
    var that = this;
    if (collection && personaRecord) {
      var collectionDesc = getRecordDescriptor(collection, personaRecord);
      if (collectionDesc && collectionDesc.fields) {
        for (i = 0; i < collectionDesc.fields.length; i++) {
          getDescriptionFields(i);
        }
      }

      // Get the record-wide fields first
      addFields(null, personaRecord.fields, fields, false);

      // Get the relationship fields next
      if (personaRecord.relationships) {
        for (i = 0; i < personaRecord.relationships.length; i++) {
          addRelationshipFactsToFields(personaRecord.relationships[i], fields, false);
        }
      }

      var updatePerson;
      if (!personId) {
        updatePerson = this.getPerson(personaRecord); // Get the main person
      }
      else {
        updatePerson = this.getPerson(personaRecord, personId);
      }

      // Now for each person on the record go get the values from their person objects
      // Note: For census and obits we have a duplicate of the fields so we don't need to process the other persons
      var ignoreOthers = this.isCensus(personaRecord) || this.isObituary(personaRecord);
      if (!ignoreOthers) {
        for (i = 0; i < personaRecord.persons.length; i++) {
          getPersonaRecordPersons(i);
        }
      }

      if (updatePerson) {
        // Get the focus person last to make sure it wins any conflicts
        getPersonFields(updatePerson, fields, false);
        backfillFieldsWithOrig(updatePerson, fields);

        for (i = 0; i < fields.length; i++) {
          addFieldURLs(personaRecord, fields[i], updatePerson.id);
        }
      }

    }
    return fields;

    function getDescriptionFields(i) {
      var collField = collectionDesc.fields[i];
      if (collField.values) {
        for (var j = 0; j < collField.values.length; j++) {
          var aField = collField.values[j];
          if (aField.labels && aField.labels[0] && aField.labels[0].value) {
            var field = {
              labelId: aField.labelId,
              displayName: [{value: aField.labels[0].value}]
            };
            // Add it to the array and make it available via 'map'
            fields.push(field);
            fields[aField.labelId] = field;
          }
        }
      }
    }
    function getPersonaRecordPersons(i) {
      var person = that.getPerson(personaRecord, personaRecord.persons[i].id);
      if (person && updatePerson && (person.id !== updatePerson.id)) {
        getPersonFields(person, fields, false);
        backfillFieldsWithOrig(person, fields);
      }
    }
  }; // populateFocusPersonFields()

  /**
   * Iterate through the field list/map and populate the values for standardized fields from the _ORIG fields.
   *
   * @param {Array} fields The field list/map like the list returned from populateFocusPersonFields. The list is altered
   *                       by having values populated for the qualifying fields.
   * @returns {undefined}
   */
  GedxPersonaPOJO.prototype.populateStandardFieldsFromOrig = function populateStandardFieldsFromOrig(fields) {
    if (fields) {
      for (var i = 0; i < fields.length; i++) {
        updateFieldValues(i);
      }
    }
    function updateFieldValues(i) {
      var srcField = fields[i];
      if (srcField && srcField.labelId && (/_ORIG$/.test(srcField.labelId))) {
        var targetFieldName = srcField.labelId.split("_ORIG")[0];
        var targetField = fields[targetFieldName];
        if (targetField && !targetField.values && srcField.values) {
          // console.log("Updating standard field for:" + targetFieldName);
          targetField.values = srcField.values;
        }
      }
    }
  };

  /**
   * Set flag that determines whether special characters in names are html encoded when returned by GedxPersona library functions.
   *
   * @param {boolean} value the value to which to set useHtmlEncode.
   * @returns {undefined}
   */
  GedxPersonaPOJO.prototype.setUseHtmlEncode = function setUseHtmlEncode(value) {
    useHtmlEncode = value;
  }; // setUseHtmlEncode()

  // ===========================================================================
  // Internal Functions
  // ===========================================================================

  /**
   * Collect all the fields/values from sourceFields and add them to targetFields
   *
   * @param {object} person The person object
   * @param {Array} sourceFields The fields to be added
   * @param {Array} targetFields The target list of fields
   * @param {boolean} allowInsert False if the fields should NOT be added if not already found.
   * @returns {undefined} Adds or populates fields in the targetFields array with field objects:
   *  { labelId,
   *    fieldType,
   *    valueType,
   *    value,
   *    values,   // The array of values for this field (may only a single entry) - only for @allowInsert=false
   *    personId  // The ID of the person where the value originated from
   *  }
   */
  function addFields(person, sourceFields, targetFields, allowInsert) {
    // We are going to have a hash of fields added so we can determine if we are adding multiple values
    var labelIdsAdded = [];
    var personId = (person && person.id) ? person.id : null;

    if (sourceFields && sourceFields.length) {
      for (var i = 0; i < sourceFields.length; i++) {
        extractSourceField(i);
      }
    }
    function extractSourceField(i) {
      var sourceField = sourceFields[i];
      if (sourceField.values) {
        for (var j = 0; j < sourceField.values.length; j++) {
          parseValues(sourceField, j);
        }
      }
    }
    function parseValues(sourceField, j) {
      var value = sourceField.values[j];
      var field = targetFields[value.labelId];
      if (field) {
        if (labelIdsAdded[value.labelId]) {
          // We have already seen this field so this is a duplicate
          field.values.push(value.text);
        }
        else {
          // We will add the value to the 'values' entry, even though this may be the only value
          field.values = [];
          // Check if there are multiple film links
          (value.labelId === 'FILM_NUMBER' && value.text.includes(',')) ?
              changeFieldValueToArray(value.text, field) : field.values.push(value.text);
        }

        field.labelId = value.labelId;
        field.fieldType = sourceField.type;
        field.valueType = value.type;
        field.value = value.text;
        field.personId = personId;

        labelIdsAdded[value.labelId] = value.labelId;
      }
      else if (allowInsert) {
        var newField = {
          labelId: value.labelId,
          fieldType: sourceField.type,
          valueType: value.type,
          value: value.text,
          values: [value.text],
          personId: personId
        };
        targetFields[value.labelId] = newField;
        targetFields[sourceField.type] = newField;
        targetFields.push(newField);
      }
    }
  } // addFields()

  /**
   * Takes a value with multiple elements and turns it into an array.
   *
   * @param {String} fieldValue The list of values joined with a comma
   * @param {Object} field The specific field we are changing
   */
  function changeFieldValueToArray(fieldValue, field){
    var toArray = [];
    fieldValue = fieldValue.replace(/ /g,'');
    toArray = fieldValue.split(',');
    for (var sValue in toArray) {
      field.values.push(toArray[sValue]);
    }
  }

  /**
   * Add URLs for name, batch and film fields that can link to other searches and records.
   *
   * @param {object} personaRecord The persona record object.
   * @param {object} field The field.
   * @param {object} focusPersonId The person ID of the focus person.
   * @returns {Array} array of strings
   */
  function addFieldURLs(personaRecord, field, focusPersonId) {
    field.bold = false;
    if ((field.labelId.indexOf('NAME') !== -1) &&
        (field.fieldType && field.fieldType.indexOf("http://gedcomx.org/") !== -1) &&
        (field.labelId.indexOf("TITLES") === -1) &&
        (field.labelId.indexOf("NOTE") === -1) &&
        (field.personId)) {
      if (field.personId !== focusPersonId) {
        field.personURL = GedxPersonaPOJO.prototype.getPersonUrl(personaRecord, field.personId);
      }
      else {
        field.bold = true;
      }
    }
    else if (field.labelId.indexOf('UDE_BATCH_NUMBER') !== -1 || field.labelId.indexOf('FS_UDE_BATCH_NBR') !== -1) {
      field.batchURLs = getFieldValueStrings("/search/record/results?count=20&query=+batch_number:{0}", field.values);
    }
    else if ((field.labelId.indexOf('FILM_NUMBER') !== -1) ||
        (field.labelId.indexOf('DIGITAL_GS_NUMBER') !== -1) ||
        (field.labelId.indexOf('MICROFILMNUMBER') !== -1) ||
        (field.labelId.indexOf('FS_FILM_NBR') !== -1)) {
      field.filmURLs = getFieldValueStrings("/search/record/results?count=20&query=%2Bfilm_number%3A{0}", field.values);
    }

    function getFieldValueStrings(formatStr, values) {
      if (!values) {
        return null;
      }
      var valueStrings = [];
      for (var i = 0; i < values.length; i++) {
        var str = searchUtilsPOJO.stringFormat(formatStr, values[i]);
        valueStrings.push(str);
      }
      return valueStrings;
    }
  }

  /**
   * Processes the relationship object and retrieves any facts it may have, adding it to the targetFields.
   *
   * @param {object} relationship The relationship object
   * @param {Array} targetFields The target list of fields
   * @param {boolean} allowInsert False if the fields should NOT be added if not already found.
   * @returns {undefined}
   */
  function addRelationshipFactsToFields(relationship, targetFields, allowInsert) {
    if (relationship && relationship.facts) {
      for (var i = 0; i < relationship.facts.length; i++) {
        var facts = relationship.facts[i];
        if (facts.date && facts.date.fields) {
          addFields(null, facts.date.fields, targetFields, allowInsert);
        }
        if (facts.place && facts.place.fields) {
          addFields(null, facts.place.fields, targetFields, allowInsert);
        }
      }
    }
  }

  /**
   * Fill any empty fields with the data from the _ORIG field if it is found.
   *
   * @param {object} person The person the fields belong to.
   * @param {Array} fields The fields to work with.
   * @returns {undefined}
   */
  function backfillFieldsWithOrig(person, fields) {
    // Get the _ORIG values into the normalized values where they are missing
    var allFields = getPersonFields(person, [], true);
    for (var j = 0; j < fields.length; j++) {
      updateFieldWithOrig(j);
    }
    function updateFieldWithOrig(j) {
      var field = fields[j];
      if (!field.values) {
        if (field.labelId.indexOf("_ORIG") === -1) {
          var origFieldName = field.labelId + "_ORIG";
          if (allFields[origFieldName]) {
            var origField = allFields[origFieldName];
            field.fieldType = origField.fieldType;
            field.valueType = origField.valueType;
            field.value = origField.value;
            field.values = origField.values;
            field.personId = origField.personId;
          }
        }
      }
    }
  }

  /**
   * An array filter method used to remove people objects that already exist in a "this.persons" array.
   * Used in getParentsAndSiblings() and getSpousesAndChildren()
   *
   * @param {object} element - person object to search for
   * @returns {boolean} - true if element exists in a "this.persons" array
   */
  function filterPersonArray(element) {
    // "this" should be an object with a persons array
    if ((typeof this.persons === 'object') && this.persons.length) {
      return !this.persons.find(findPerson, element);
    }
    return true;
  }

  /**
   * An array find method used to see if a person object equals "this"
   * Used in filterPersonArray()
   *
   * @param {object} element - person object to search for
   * @returns {boolean} - true if element's id is equal to "this.id"
   */
  function findPerson(element) {
    return (element.id === this.id); // "this" is a person to find
  }

  /**
   * Return all source descriptor objects matching the type specified.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @param {string} sourceType The type for the source (e.g. http://gedcomx.org/DigitalArtifact)
   * @returns {*} The array containing sources matching descriptor, empty if not found.
   */
  function getAllSourceDescriptionsOfType(personaOrRecord, sourceType) {
    var sources = [];

    if (personaOrRecord && sourceType && personaOrRecord.sourceDescriptions) {
      for (var i = 0; i < personaOrRecord.sourceDescriptions.length; i++) {
        if (personaOrRecord.sourceDescriptions[i].resourceType === sourceType) {
          sources.push(personaOrRecord.sourceDescriptions[i]);
        }
      }
    }
    return sources;
  }

  /**
   * Return the children of the person in the record.
   *
   * @param {object} personaRecord The persona record object.
   * @param {object} person The person object.
   * @param {Array} [relationships] The list of relationships (optional).
   * @returns {Array} [{person}] The person list of children.
   */
  function getChildren(personaRecord, person, relationships) {
    var children = [];
    var rels;
    if (relationships) {
      rels = relationships;
    }
    else {
      rels = getRelationships(personaRecord, person);
    }

    if (rels) {
      for (var i = 0; i < rels.length; i++) {
        parseParent(i);
      }
    }
    return children;

    function parseParent(i) {
      var rel = rels[i];
      if (rel.type !== 'http://gedcomx.org/ParentChild') {
        return;
      }
      var relParent = GedxPersonaPOJO.prototype.getPerson(personaRecord, rel.person1.resource);
      if (relParent && relParent.id === person.id) {
        var child = GedxPersonaPOJO.prototype.getPerson(personaRecord, rel.person2.resource);
        if (child) {
          children.push(newRelativeFromPerson(personaRecord, child, person));
        }
      }
    }
  }

  /**
   * Return the children of the person in the record.
   *
   * @param {object} personaRecord The persona record object.
   * @param {object} person The person object.
   * @param {Array} spouse The spouse object.
   * @param {object} [personRelationships] (optional) the person's relationships
   * @param {Array} [spouseRelationships] (optional) the spouse's relationships
   * @returns {Array} [{person}] The person list of children.
   */
  function getChildrenWithSpouse(personaRecord, person, spouse, personRelationships, spouseRelationships) {
    var children = [];
    var rels, spouseRels;

    if (personRelationships) {
      rels = personRelationships;
    }
    else {
      rels = getRelationships(personaRecord, person);
    }

    if (spouseRelationships) {
      spouseRels = spouseRelationships;
    }
    else {
      spouseRels = getRelationships(personaRecord, spouse);
    }

    if (rels && spouseRels) {
      for (var i = 0; i < rels.length; i++) {
        parseRels(i);
      }
    }
    return children;

    function getResource(relPerson) {
      return (relPerson.resource.match(/^#/) && relPerson.resourceId) ? relPerson.resourceId : relPerson.resource;
    }
    function findChild(element) {
      var id = this.id || '';
      return (id === element.id);
    }
    function parseRels(i) {
      var rel = rels[i];

      var p2Resource = getResource(rel.person2);
      var parentChild = GedxPersonaPOJO.prototype.getPerson(personaRecord, p2Resource);
      if (!parentChild) {
        return;
      }
      var relType = GedxPersonaPOJO.prototype.getRelationshipType(personaRecord, person, parentChild);
      if (relType && relType.gedcomxType !== 'http://gedcomx.org/ParentChild') {
        return;
      }

      // if this is a child of person, see if this is a child of spouse too
      var parentResource = getResource(rel.person1);
      var relParent = GedxPersonaPOJO.prototype.getPerson(personaRecord, parentResource);
      if (relParent && relParent.id === person.id) {

        for (var j = 0; j < spouseRels.length; j++) {
          parseSpouseRels(parentChild, j);
        }
      }
    }
    function parseSpouseRels(parentChild, j) {
      var spouseRel = spouseRels[j];
      var spouseP2Resource = getResource(spouseRel.person2);
      var spouseChild = GedxPersonaPOJO.prototype.getPerson(personaRecord, spouseP2Resource);
      if (!spouseChild) {
        return;
      }
      var spouseRelType = GedxPersonaPOJO.prototype.getRelationshipType(personaRecord, spouse, spouseChild);
      if (spouseRelType && spouseRelType.gedcomxType !== 'http://gedcomx.org/ParentChild') {
        return;
      }

      var spouseP1Resource = getResource(spouseRel.person1);
      var relSecondParent = GedxPersonaPOJO.prototype.getPerson(personaRecord, spouseP1Resource);
      if (relSecondParent && (relSecondParent.id === spouse.id) && (parentChild.id === spouseChild.id)) {
        var child = newRelativeFromPerson(personaRecord, spouseChild, person);
        if (!children.find(findChild, child)) {
          children.push(child);
        }
      }
    }
  }

  /**
   * Using the descriptor ID from the record, find the matching descriptor in the collection.
   *
   * @param {object} collection The collection.
   * @param {string} descId The descriptor ID from the record.
   * @returns {*} The matching record descriptor. May be NULL if not found.
   */
  function getCollectionRecordDescriptor(collection, descId) {
    var descriptor = null;

    if (collection && collection.recordDescriptors && descId) {
      for (var i = 0; i < collection.recordDescriptors.length; i++) {
        if (collection.recordDescriptors[i].id === descId) {
          descriptor = collection.recordDescriptors[i];
          break;
        }
      }
    }
    return descriptor;
  }

  /**
   * Retrieve the source description for the collection.
   *
   * @param {object} personaOrRecord The persona record object.
   * @returns {*} source description
   */
  function getCollectionSourceDescription(personaOrRecord) {
    var collectionDesc = null;
    var srcDesc = getMainSourceDescription(personaOrRecord);
    while (srcDesc) {
      if (srcDesc.resourceType && srcDesc.resourceType === "http://gedcomx.org/Collection") {
        collectionDesc = srcDesc;
        break;
      }
      else {
        srcDesc = GedxPersonaPOJO.prototype.getSourceDescription(personaOrRecord, srcDesc.componentOf.description);
      }
    }
    return collectionDesc;
  }

  /**
   * Find a field given its labelId.
   *
   * @param {Array} fields The list of fields to search.
   * @param {string} labelId The labelId to search for.
   * @returns {*} the field if found, otherwise NULL.
   */
  function getFieldByLabelId(fields, labelId) {
    var field = null;

    for (var i = 0; i < fields.length; i++) {
      if (fields[i].labelId === labelId) {
        field = fields[i];
        break;
      }
    }

    return field;
  }

  /**
   * Return the first element of the given array or NULL if its undefined or empty.
   *
   * @param {Array} array the array to check
   * @returns {*} the first element of the given array or NULL if its undefined or empty.
   */
  function getFirst(array) {
    // Array.isArray works in IE9+
    if (Array.isArray(array)) {
      return array[0];
    }
    return null;
  }

  /**
   * Return the source description for the main persona.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @returns {*} The source description for the main persona.
   */
  function getMainSourceDescription(personaOrRecord) {
    var srcDesc = null;
    if (personaOrRecord.description) {
      srcDesc = GedxPersonaPOJO.prototype.getSourceDescription(personaOrRecord, personaOrRecord.description);
    }
    return srcDesc;
  }

  /**
   * Return the parents of the person in the record.
   *
   * @param {object} personaRecord The persona record object.
   * @param {object} person The person object.
   * @param {Array} [relationships] The list of relationships (optional).
   * @returns {Array} [{person}] The person list of parents.
   */
  function getParents(personaRecord, person, relationships) {
    var parents = [];
    var rels;

    if (relationships) {
      rels = relationships;
    }
    else {
      rels = getRelationships(personaRecord, person);
    }

    if (rels) {
      for (var i = 0; i < rels.length; i++) {
        parseRels(i);
      }
    }
    return parents;

    function parseRels(i) {
      var rel = rels[i];
      if (rel.type !== 'http://gedcomx.org/ParentChild') {
        return;
      }
      var relChild = GedxPersonaPOJO.prototype.getPerson(personaRecord, rel.person2.resource);
      if (relChild && relChild.id === person.id) {
        var p1 = GedxPersonaPOJO.prototype.getPerson(personaRecord, rel.person1.resource);
        if (p1) {
          var parent = newRelativeFromPerson(
              personaRecord,
              p1,
              person,
              false,
              true);  // partialPerson = true to prevent too much recursion
          switch (parent.gender) {
            case 'F':
              parent.type = "mother";
              break;
            case 'M':
              parent.type = "father";
              break;
            default:
              parent.type = "parent";
              break;
          }
          parents.push(parent);
        }
      }
    }
  }

  /**
   * Process the person and retrieve all the fields for the person.
   *
   * @param {object} person The person
   * @param {Array} targetFields The target field list
   * @param {boolean} allowInsert False if the fields should NOT be added if not already found.
   * @returns {*} all fields for person
   */
  function getPersonFields(person, targetFields, allowInsert) {
    var i;

    if (person) {
      addFields(person, person.fields, targetFields, allowInsert);
      if (person.gender) {
        addFields(person, person.gender.fields, targetFields, allowInsert);
      }
      if (person.names) {
        for (i = 0; i < person.names.length; i++) {
          parseName(i);
        }
      }
      if (person.facts) {
        for (i = 0; i < person.facts.length; i++) {
          parsePersonFacts(i);
        }
      }
    }
    return targetFields;

    function parseName(i) {
      var name = person.names[i];
      if (person.names[i].nameForms) {
        for (var j = 0; j < name.nameForms.length; j++) {
          parseNameForms(j, name);
        }
      }
    }
    function parseNameForms(j, name) {
      var nameForms = name.nameForms[j];
      addFields(person, nameForms.fields, targetFields, allowInsert);
      if (nameForms.parts) {
        for (var k = 0; k < nameForms.parts.length; k++) {
          var namePart = nameForms.parts[k];
          addFields(person, namePart.fields, targetFields, allowInsert);
        }
      }
    }
    function parsePersonFacts(i) {
      var fact = person.facts[i];
      addFields(person, fact.fields, targetFields, allowInsert);
      if (fact.date) {
        addFields(person, fact.date.fields, targetFields, allowInsert);
      }
      if (fact.place) {
        addFields(person, fact.place.fields, targetFields, allowInsert);
      }
    }
  } // getPersonFields()

  /**
   * Find the record descriptor in the collection for the main person in the gedx response data
   *
   * @param {object} collection The collection. Not NULL.
   * @param {object} personaRecord The persona record object. Not NULL.
   * @returns {*} The record descriptor or NULL if not found.
   */
  function getRecordDescriptor(collection, personaRecord) {
    var descriptor = null;
    var srcDesc = getMainSourceDescription(personaRecord);

    while (srcDesc && !srcDesc.descriptor && srcDesc.componentOf) {
      srcDesc = GedxPersonaPOJO.prototype.getSourceDescription(personaRecord, srcDesc.componentOf.description);
    }

    var ref = srcDesc.descriptor.resource;
    var pos = ref.indexOf('#');
    if (pos > 0) {
      descriptor = getCollectionRecordDescriptor(collection, ref.substring(pos + 1));
    }

    return descriptor;
  } // getRecordDescriptor()

  /**
   * Return the relationships for the person in the record.
   *
   * @param {object} personaRecord The persona record object.
   * @param {object} person The person object.
   * @returns {Array} relationships
   * [{
   *    id,
   *    type,   (i.e. http://gedcomx.org/Couple or http://gedcomx.org/ParentChild, etc.)
   *    person1,
   *    person2
   * }] The relationships the person is a part of.
   */
  function getRelationships(personaRecord, person) {
    var rels = [];
    if (personaRecord && personaRecord.relationships && person && person.id) {
      rels = JSON.parse(JSON.stringify(personaRecord.relationships)); // Clone the list since we will be editing it
    }
    for (var i = rels.length - 1; i >= 0; i--) {
      var rel = rels[i];
      var pid = "#" + person.id;  // Convert the person ID to a resource form
      // Check if it is a tree person
      var treeIdRegex = /.{4}-.{3,4}/i;
      if (treeIdRegex.test(person.id)) {
        // Create the tree pids from the person resources
        var treeUrlRegex = /.*(.{4}-.{3,4}).*/i;
        var treePerson1 = treeUrlRegex.exec(rel.person1.resource);
        treePerson1 = treePerson1 ? '#' + treePerson1[1] : null;
        var treePerson2 = treeUrlRegex.exec(rel.person2.resource);
        treePerson2 = treePerson2 ? '#' + treePerson2[1] : null;
        // Gotta check two PIDs
        if ((rel.person1.resource !== pid && rel.person2.resource !== pid) &&
            (treePerson1 !== pid && treePerson2 !== pid)) {
          // This is a relationship that this person doesn't belong to so ignore it
          rels.splice(i, 1);
        }
      }
      else if (rel.person1.resource !== pid && rel.person2.resource !== pid) {
        // This is a relationship that this person doesn't belong to so ignore it
        rels.splice(i, 1);
      }
    }
    return rels;
  }

  /**
   * Determines the relationship of the person to the deceased person.
   *
   * @param {object} personaRecord The person record object.
   * @param {object} focusPerson The focus person object.
   * @param {object} person The person object.
   * @returns {string} That describes the relationship (e.g. "Father", "Son", etc.). May be "Unknown".
   */
  function getRelationshipToDeceased(personaRecord, focusPerson, person) {
    var relationship;
    var relType = GedxPersonaPOJO.prototype.getRelationshipType(personaRecord, focusPerson, person);
    if (relType) {
      relationship = relType.label;
    }

    if (!relationship) {
      relationship = getRelationshipToFocusPerson(personaRecord, focusPerson, person);
    }
    if (!relationship && focusPerson.principal) {
      relationship = getRelationshipToDeceasedChar(person);
    }

    return relationship ? relationship : "Unknown";

    /**
     * Use the *RELATIONSHIP_TO_DEC* field to determine what the relationship is.
     *
     * @param {object} person The person object.
     * @returns {string} that describes the relationship. May be null.
     */
    function getRelationshipToDeceasedChar(person) {
      var value = GedxPersonaPOJO.prototype.getCharacteristicValue(person, "RELATIONSHIP_TO_DEC");
      if (isEmpty(value)) {
        value = GedxPersonaPOJO.prototype.getCharacteristicValue(person, "PR_RELATIONSHIP_TO_DEC");
      }
      if (isEmpty(value)) {
        value = GedxPersonaPOJO.prototype.getCharacteristicValue(person, "RELATIONSHIP_TO_HEAD");
      }
      if (isEmpty(value)) {
        value = GedxPersonaPOJO.prototype.getCharacteristicValue(person, "PR_RELATIONSHIP_TO_HEAD");
      }
      if (isEmpty(value)) {
        value = GedxPersonaPOJO.prototype.getCharacteristicValue(person, "RELATIONSHIP_CODE");
      }

      return value;
    }
  }

  /**
   * @deprecated - use getRelationshipType instead.
   * Determines the relationship of the person to the focusPerson.
   *
   * Note: this only handles spouse, children, parent and sibling relationships. No step relations or anything else.
   * For a more powerful function try using getRelationshipType.
   *
   * @param {object} personaRecord The person record object.
   * @param {object} focusPerson The focus person object.
   * @param {object} person The person object.
   * @returns {string} That describes the relationship (e.g. "Father", "Son", etc.). May be null.
   */
  function getRelationshipToFocusPerson(personaRecord, focusPerson, person) {
    var relationship = getRegularRelationship(personaRecord, focusPerson, person);
    if (!relationship) {
      relationship = getSiblingRelationship(personaRecord, focusPerson, person);
    }

    return relationship;

    /**
     * Check the relationship elements of the record for a relationship between the two persons.
     *
     * @param {object} personaRecord The record
     * @param {object} focusPerson The focus person object
     * @param {object} person The person object
     * @returns {string} That describes the relationship (e.g. "Father", "Son", etc.). May be null.
     */
    function getRegularRelationship(personaRecord, focusPerson, person) {
      var relationship = null;

      if (focusPerson.id !== person.id) {
        var genderType = GedxPersonaPOJO.prototype.getGenderString(person).charAt(0);

        var rels = getRelationships(personaRecord, person);
        var pid = "#" + focusPerson.id;
        if (rels) {
          for (var i = 0; i < rels.length; i++) {
            parseRels(i, pid);
          }
        }
      }
      return relationship;

      function parseRels(i, pid) {
        var rel = rels[i];
        var p1, p2;
        if (rel.person1.resource === pid) {
          p1 = focusPerson;
        }
        else if (rel.person2.resource === pid) {
          p2 = focusPerson;
        }
        else {
          return;
        }
        var found = false;
        for (var j = 0; j < relationshipMap.length; j++) {
          var map = relationshipMap[j];
          if (map.type === rel.type) {
            if (p1) {
              relationship = map.p1[genderType];
            }
            else {
              relationship = map.p2[genderType];
            }
            found = true;
            break;
          }
        }
        if (!found) {
          // console.log("Warning: unhandled relationship type encountered:" + rel.type);
        }
      }
    } // getRegularRelationship()

    /**
     * Using the parents of both person objects, determine if a sibling relationship exists.
     *
     * @param {object} personaRecord The record
     * @param {object} focusPerson The focus person object
     * @param {object} person The person object
     * @returns {string} That describes the relationship (e.g. "Brother", "Sister", "Sibling"). May be null.
     */
    function getSiblingRelationship(personaRecord, focusPerson, person) {
      var relationship = null;

      if (focusPerson.id !== person.id) {
        var genderType = GedxPersonaPOJO.prototype.getGenderString(person).charAt(0);

        // Check to see if these person objects share a parent
        var focusParents = getParents(personaRecord, focusPerson);
        var parents = getParents(personaRecord, person);
        var found = false;
        for (var i = 0; i < focusParents.length; i++) {
          for (var j = 0; j < parents.length; j++) {
            found = found || getRelationship(focusParents, parents, i, j, found);
          }
          if (found) {
            break;
          }
        }
      }
      return relationship;

      function getRelationship(focusParents, parents, i, j) {
        if (focusParents[i].id === parents[j].id) {
          switch (genderType) {
            case 'M':
              relationship = "Brother";
              break;
            case 'F':
              relationship = "Sister";
              break;
            default:
              relationship = "Sibling";
              break;
          }
          return true;
        }
      }
    } // getSiblingRelationship()
  }

  /**
   * Return the relationship to the head of house characteristic for the person.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @param {object} person The person
   * @param {object} focusPerson The focus person for the record view (not necessarily the principal or head). May be null.
   * @returns {string} The relationship to the head or empty if not found.
   */
  function getRelationshipToHead(personaOrRecord, person, focusPerson) {
    var value;

    if (focusPerson) {
      value = getRelationshipToFocusPerson(personaOrRecord, focusPerson, person);
    }
    if (isEmpty(value)) {
      value = GedxPersonaPOJO.prototype.getCharacteristicValue(person, "RELATIONSHIP_TO_HEAD");
    }
    if (isEmpty(value)) {
      value = GedxPersonaPOJO.prototype.getCharacteristicValue(person, "PR_RELATIONSHIP_TO_HEAD");
    }
    if (isEmpty(value)) {
      value = GedxPersonaPOJO.prototype.getCharacteristicValue(person, "PR_RELATIONSHIP_TO_HEAD_ORIG");
    }
    if (isEmpty(value)) {
      value = GedxPersonaPOJO.prototype.getCharacteristicValue(person, "RELATIONSHIP_CODE");
    }
    if (isEmpty(value)) {
      focusPerson = GedxPersonaPOJO.prototype.getPerson(personaOrRecord);
      if (focusPerson) {
        value = getRelationshipToFocusPerson(personaOrRecord, focusPerson, person);
      }
    }

    return value;
  }

  /**
   * Return the source descriptor object matching the type specified.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @param {string} sourceType The type for the source (e.g. http://gedcomx.org/DigitalArtifact)
   * @returns {*} The source matching descriptor or NULL if not found.
   */
  function getSourceDescriptionByType(personaOrRecord, sourceType) {
    var source = null;

    if (personaOrRecord && sourceType) {
      if (personaOrRecord.sourceDescriptions) {
        checkSourceDescription();
      }
    }
    return source;

    function checkSourceDescription() {
      for (var i = 0; i < personaOrRecord.sourceDescriptions.length; i++) {
        if (personaOrRecord.sourceDescriptions[i].resourceType === sourceType) {
          source = personaOrRecord.sourceDescriptions[i];
          break;
        }
      }
    }
  }

  /**
   * Return the source descriptor object matching the type specified.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @param {object} person The person in question.
   * @returns {*} The source matching descriptor or NULL if not found.
   */
  function getSourceDescriptionForPerson(personaOrRecord, person) {
    var source = null;
    if (person && person.identifiers && person.identifiers["http://gedcomx.org/Persistent"]) {
      var sourceDescUrl = person.identifiers["http://gedcomx.org/Persistent"][0];
      source = GedxPersonaPOJO.prototype.getSourceDescription(personaOrRecord, sourceDescUrl);
    }
    return source;
  }

  /**
   * Return the siblings of the person in the record.
   *
   * @param {object} personaRecord The persona record object.
   * @param {object} person The person object.
   * @param {Array} [relationships] The list of relationships (optional).
   * @returns {Array} [{person}] The person list of siblings.
   */
  function getSiblings(personaRecord, person, relationships) {
    var siblings = [];
    var rels;

    if (relationships) {
      rels = relationships;
    }
    else {
      rels = getRelationships(personaRecord, person);
    }

    if (rels) {
      for (var i = 0; i < rels.length; i++) {
        var rel = rels[i];
        if ((rel.type !== 'http://familysearch.org/Sibling') && (rel.type !== siblingRelationship.type)) {
          continue;
        }
        var p1 = GedxPersonaPOJO.prototype.getPerson(personaRecord, rel.person1.resource);
        var p2 = GedxPersonaPOJO.prototype.getPerson(personaRecord, rel.person2.resource);
        if (p1.id === person.id) {
          siblings.push(newRelativeFromPerson(personaRecord, p2, person));
        }
        else {
          siblings.push(newRelativeFromPerson(personaRecord, p1, person));
        }
      }
    }
    return siblings;
  }

  /**
   * Return the spouses of the person in the record.
   *
   * @param {object} personaRecord The persona record object.
   * @param {object} person The person object.
   * @param {Array} [relationships] The list of relationships (optional).
   * @returns {Array} [{person}] The person list of spouses.
   */
  function getSpouses(personaRecord, person, relationships) {
    var spouses = [];
    var rels;

    if (relationships) {
      rels = relationships;
    }
    else {
      rels = getRelationships(personaRecord, person);
    }

    if (rels) {
      for (var i = 0; i < rels.length; i++) {
        var rel = rels[i];
        if (rel.type !== 'http://gedcomx.org/Couple') {
          continue;
        }
        var p1 = GedxPersonaPOJO.prototype.getPerson(personaRecord, rel.person1.resource);
        var p2 = GedxPersonaPOJO.prototype.getPerson(personaRecord, rel.person2.resource);
        // Because we could have multiple couple relationships we need to find those that belong to this person
        if (p1 && p2 && (p1.id === person.id)) {
          spouses.push(newRelativeFromPerson(personaRecord, p2, person));
        }
        else if (p1 && p2 && (p2.id === person.id)) {
          spouses.push(newRelativeFromPerson(personaRecord, p1, person));
        }
      }
    }
    return spouses;
  }

  /** TODO - check to see if we already have something that handles this functionality
   * HTML encode the string
   * @param {string} str The string to be encoded
   * @returns {XML|string} The encoded version of the string.
   */
  function htmlEncode(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
  }

  /**
   * Returns true if the person is a match for the ID or URL specified.
   *
   * @param {object} person The person in question.
   * @param {string} idOrUrl The identifier or URL to check. (IDs may start with '#' from internal links)
   * @returns {boolean} True if the person is a match, otherwise false.
   */
  function isPersonMatch(person, idOrUrl) {
    var id = idOrUrl;
    if (id && id.charAt(0) === "#") {
      id = id.substring(1);
    }
    // Also remove the tree platform URL
    var treeUrlRegex = /.*(.{4}-.{3,4}).*/i;
    if (treeUrlRegex.test(id)) {
      id = treeUrlRegex.exec(id)[1];
    }
    if (person.id === id) {
      return true;
    }
    if (person.identifiers && person.identifiers["http://gedcomx.org/Persistent"]) {
      for (var i = 0; i < person.identifiers["http://gedcomx.org/Persistent"].length; i++) {

        // look for an exact match, then normalize the URLs to see if they match
        if ((person.identifiers["http://gedcomx.org/Persistent"][i] === idOrUrl)
            || (searchUtilsPOJO.normalizeUrl(person.identifiers["http://gedcomx.org/Persistent"][i]) === searchUtilsPOJO.normalizeUrl(idOrUrl))) {
          return true;
        }
      }
    }

    return false;
  } // isPersonMatch()

  /**
   * Create a relative object for the specified person.
   *
   * @param {object} personaOrRecord The persona or record object.
   * @param {object} person The person object.
   * @param {object} focusPerson The person who is the focus of the search result (not necessarily the principal).
   * @param {boolean} [isCensus] True if this is a census (the relationships are calculated based on the head).
   * @param {boolean} [partialPerson] True if this person does not need to be fully qualified (e.g. no relationship to head).
   * @returns {*} The relative object (see newRelative).
   */
  function newRelativeFromPerson(personaOrRecord, person, focusPerson, isCensus, partialPerson) {
    return {
      id: person.id,
      type: partialPerson ? "" : getRelationshipToHead(personaOrRecord, person, isCensus ? null : focusPerson),
      link: getPersonLink(),
      name: GedxPersonaPOJO.prototype.getBestNameValue(person),
      gender: GedxPersonaPOJO.prototype.getGenderString(person).charAt(0),
      age: GedxPersonaPOJO.prototype.getBestAgeValue(person),
      birthPlace: GedxPersonaPOJO.prototype.getBirthplace(person),
      roleInEvent: [], // recordPerson.roleInEvent,
      principal: person.principal ? person.principal : false
    };
    function getPersonLink() {
      if (focusPerson.id !== person.id) {
        return GedxPersonaPOJO.prototype.getPersonUrl(personaOrRecord, person);
      }
    }
  }

  /**
   * Orders the facts in this order: (Name, Sex, Birth, Christening, Death, Burial)
   *
   * @param {Array} facts array of facts
   * @returns {Array} if facts is empty it returns empty array otherwise returns ordered array of facts
   */
  function orderFacts(facts) {
    var events = [
      'http://gedcomx.org/Name',
      'http://gedcomx.org/Sex',
      'http://gedcomx.org/Birth',
      'http://gedcomx.org/Christening',
      'http://gedcomx.org/Death',
      'http://gedcomx.org/Burial'];
    var tempFacts = searchUtilsPOJO.copy(facts);
    var orderedFacts = [];

    if (tempFacts) {
      for (var j = 0; j < events.length; j++) {
        for (var i = 0; i < tempFacts.length; i++) {
          checkFactType(j, i);
        }
      }
      orderedFacts.push.apply(orderedFacts, tempFacts);
    }
    return orderedFacts;

    function checkFactType(j, i) {
      if (tempFacts[i].type === events[j]) {
        orderedFacts.push(tempFacts[i]);
        tempFacts.splice(i, 1);
      }
    }
  }

  /**
   * Process the deceased person object.
   *
   * @param {object} collection The collection object.
   * @param {object} personaRecord The person record object.
   * @param {object} focusPerson The focus person object.
   * @param {object} person The person object.
   * @returns {{person: *, fields: *}} an object with the person and fields
   */
  function processDeceasedPerson(collection, personaRecord, focusPerson, person) {
    var fields = GedxPersonaPOJO.prototype.populateFocusPersonFields(collection, personaRecord, person.id);

    // remove fields with empty values
    // for (var i = fields.length - 1; i >= 0; i--) {
    //  if (!fields[i].value) {
    //    fields.splice(i, 1);
    //  }
    // }

    var field = getFieldByLabelId(fields, "PR_NAME");
    if (field) {
      if (focusPerson.id === person.id) {
        field.bold = true;
      }
      else {
        field.personURL = GedxPersonaPOJO.prototype.getPersonUrl(personaRecord, field.personId);
      }
    }

    return {person: person, fields: fields};
  }

  /**
   * Return an HTML safe (encoded) name or 'UNKNOWN' if empty.
   *
   * @param {string|null} value The name
   * @returns {string} The HTML safe name.
   */
  function safeName(value) {
    if (!value || value.length === 0) {
      return "UNKNOWN";
    }
    if (useHtmlEncode) {
      return htmlEncode(value);
    }
    return value;
  }

  /**
   * Methods from underscore library.
   *
   * Checks to see if something is an array
   *
   * @param {*} obj something to check
   * @returns {boolean} true if it's an array
   */
  var isArray = function isArray(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
  };

  /**
   * Checks to see if something is a string
   *
   * @param {*} obj something to check
   * @returns {boolean} true if it's a string
   */
  var isString = function isString(obj) {
    return Object.prototype.toString.call(obj) === '[object String]';
  };

  /**
   * checks to see if something is empty
   * @param {object} obj something to check
   * @returns {boolean} true if it's empty
   */
  var isEmpty = function isEmpty(obj) {
    if (obj == null) {
      return true;
    }
    if (isString(obj) || isArray(obj)) {
      return obj.length === 0;
    }
    throw new Error("Unsupported type passed to isEmpty:" + typeof obj);
  };

  /**
   * There are a few internal characteristic types that have been changed with GedcomX
   */
  var charTypeMap = [];
  function initCharTypeMap() {
    charTypeMap.IMAGE_PAL = "IMAGE_ARK";
  }
  initCharTypeMap();

  /**
   * polyfill for array.prototype.find() function if it doesn't exist (e.g., in IE or karma 0.13)
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
   *
   * @param {*} predicate something to find
   * @returns {*} found value
   */
  if (!Array.prototype.find) {
    Array.prototype.find = function find(predicate) {
      'use strict';
      if (this == null) {
        throw new TypeError('Array.prototype.find called on null or undefined');
      }
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }
      var list = Object(this);
      var length = list.length >>> 0;
      var thisArg = arguments[1];
      var value;

      for (var i = 0; i < length; i++) {
        value = list[i];
        if (predicate.call(thisArg, value, i, list)) {
          return value;
        }
      }
      return;
    };
  }

  function flattenArray(arr) {
    return arr.reduce(function reduceArray(flat, toFlatten) {
      return flat.concat(Array.isArray(toFlatten) ? flattenArray(toFlatten) : toFlatten);
    }, []);
  }

  /**
   * If we are in a system that uses CommonJS use it.  Otherwise
   * global Allows you to instantiate this service like var GedxPersona = new GedxPersona();
   */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = new GedxPersonaPOJO();
  }
  else {
    global.GedxPersonaPOJO = new GedxPersonaPOJO();
  }

}(this));
