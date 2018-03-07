(function(global){

  function removeParameters(theUrl) {
    if (!theUrl) {
      return theUrl;
    }
    var index = theUrl.indexOf("?");
    if (index === -1) {
      return theUrl;
    }
    return theUrl.substring(0, index);
  }

  // peel off the domain, if present
  function relativizeUrl(theUrl) {
    if (!theUrl) {
      return theUrl;
    }
    var index = theUrl.indexOf("://");
    if (index === -1) {
      return theUrl;
    }
    var slashIndex = theUrl.indexOf("/", index + "://".length);
    return theUrl.substring(slashIndex);
  }

  // relativize; convert to "pal identifier" (pal:...) or "ark identifier" (ark:...)if the url is a PAL or ARK.
  function normalizeUrl(url) {
    if (!url) {
      return url;
    }
    var index = url.indexOf("pal:/");
    if (index === -1) {
      index = url.indexOf('ark:/');
    }
    if (index === -1) {
      return relativizeUrl(url);
    }
    return removeParameters(url.slice(index));
  }

  function htmlEncode() {
    return String(this)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

  }

  // HTML encode a name, or, if it is empty, return '<unknown>' in italics.
  // (Note: this is not localized)
  function safeName(value) {
    if (!value || value.length === 0) {
      return "<i>&lt;unknown&gt;</i>";
    }
    return htmlEncode(value);
  }

  function parseYear(dateValue) {
    var parts = parseNumberParts(dateValue);
    if (!parts.length) {
      return "";
    }
    var rtn = parts[parts.length - 1];
    if (rtn.length < 3 && parts[0].length > 2) {
      rtn = parts[0];
    }
    return rtn;
  }

  function parseNumberParts(str) {
    var parts = [];
    var num = "";
    var ch;
    var i;
    if (!str) {
      return parts;
    }
    for (i = 0; i < str.length; i++) {
      ch = str.charAt(i);
      if (isDigit(ch)) {
        num += ch;
      }
      else {
        if (num.length > 0) {
          parts.push(num);
        }
        num = "";
      }
    }
    if (num.length > 0) {
      parts.push(num);
    }
    return parts;
  }

  function isDigit(aChar) {
    var myCharCode = aChar.charCodeAt(0);
    return myCharCode > 47 && myCharCode < 58;
  }

  // Get the first element in the given array, or return null if it is empty, undefined or null.
  function getFirst(array) {
    if (array != null && array !== undefined && array.length > 0) {
      return array[0];
    }
    return null;
  }

  // Builds a map of local id, "#" + local id, and all identifier URIs to each object in the list.
  function makeIdMap(list) {
    var map = {};
    if (list != null) {
      for (var i = 0; i < list.length; i++) {
        var object = list[i];
        if (object.hasOwnProperty('id')) {
          map[object.id] = object;
          map['#' + object.id] = object;
        }
        if (object.hasOwnProperty('about')) {
          map[normalizeUrl(object.about)] = object;
        }
        if (object.hasOwnProperty('identifiers')) {
          for (var idType in object.identifiers) {
            if (object.identifiers.hasOwnProperty(idType)) {
              var ids = object.identifiers[idType];
              for (var j = 0; j < ids.length; j++) {
                map[normalizeUrl(ids[j])] = object;
              }
            }
          }
        }
        object.getIdentifier = function() {
          var id = null;
          if (this.hasOwnProperty('identifiers')) {
            id = getFirst(this.identifiers["http://gedcomx.org/Persistent"]);
            if (id == null) {
              id = getFirst(this.identifiers["http://gedcomx.org/Primary"]);
              if (id == null) {
                for (idType in object.identifiers) {
                  if (object.identifiers.hasOwnProperty(idType)) {
                    id = getFirst(object.identifiers[idType]);
                    if (id != null) {
                      return id;
                    }
                  }
                }
              }
            }
          }
          return id;
        }
      }
    }
    return map;
  }

  // if they passed in a "reference", then get the description ref from it
  function deRef(parm) {
    return normalizeUrl(parm && parm.description ? parm.description : parm);
  }

  function getTitleFromSourceDescription(sd) {
    if (!sd || !sd.titles || sd.titles.length === 0) {
      return "";
    }
    return sd.titles[0].value;
  }

  var GedcomX = function GedcomX(data) {
    this.data = data;
    if (!data) {
      return;
    }
    this.personMap = makeIdMap(data.persons);
    this.sourceDescriptionMap = makeIdMap(data.sourceDescriptions);
    this.placeMap = makeIdMap(data.placeDescriptions);
    this.agentMap = makeIdMap(data.agents);
    this.recordDescriptorMap = makeIdMap(data.recordDescriptors);
    this.mainSourceDescription = this.getSourceDescription(data.description);
  };

  GedcomX.prototype.getDocument = function() {
    return this.data;
  };

  GedcomX.prototype.getMainSourceDescription = function() {
    return this.mainSourceDescription;
  };

  GedcomX.prototype.getMainPerson = function() {
    return this.mainSourceDescription ? this.getPerson(this.mainSourceDescription.about) : null;
  };

  GedcomX.prototype.getPerson = function(idOrUrl) {
    return this.personMap[deRef(idOrUrl)];
  };

  GedcomX.prototype.getSourceDescription = function(idOrUrl) {
    return this.sourceDescriptionMap[deRef(idOrUrl)];
  };

  GedcomX.prototype.getRecordDescriptor = function(idOrUrl) {
    return this.recordDescriptorMap[deRef(idOrUrl)];
  };

  GedcomX.prototype.getAgent = function(idOrUrl) {
    return this.agentMap[deRef(idOrUrl)];
  };

  GedcomX.prototype.getPlaceDescription = function(idOrUrl) {
    return this.placeMap[deRef(idOrUrl)];
  };

  GedcomX.prototype.isCensus = function() {
    var sd = this.getMainSourceDescription();
    if (!sd) {
      return false;
    }
    while (sd && !sd.coverage) {
      sd = sd.componentOf ? this.getSourceDescription(sd.componentOf.description) : null;
    }
    if (sd && sd.coverage.length > 0) {
      for (var i = 0; i < sd.coverage.length; i++) {
        var coverage = sd.coverage[i];
        if (coverage.recordType === "http://gedcomx.org/Census") {
          return true;
        }
      }
    }
    return false;
  };

  GedcomX.prototype.getPersonLabelValueMap = function() {
    var personFieldMap = this.getPersonFieldMap();
    var labelsMap = [];
    for (var personId in personFieldMap) {
      if (personFieldMap.hasOwnProperty(personId)) {
        labelsMap[personId] = getLabelValuesMap(personFieldMap[personId]);
      }
    }
    return labelsMap;
  };

  GedcomX.prototype.getPersonFieldMap = function() {

    function addFields(listToAdd, personId, personFieldMap) {
      if (!listToAdd || !listToAdd.length) {
        return;
      }
      var fields = personFieldMap[personId];
      if (!fields) {
        fields = [];
        personFieldMap[personId] = fields;
      }
      for (var i = 0; i < listToAdd.length; i++) {
        fields.push(listToAdd[i]);
      }
    }

    if (!this.data) {
      return [];
    }
    var personFieldsMap = {};
    addFields(this.data.fields, "RECORD_FIELDS", personFieldsMap);
    var persons = this.data.persons;
    if (persons) {
      for (var i = 0; i < persons.length; i++) {
        var person = persons[i];
        addFields(person.fields, person.id, personFieldsMap);
        if (person.gender) {
          addFields(person.gender.fields, person.id, personFieldsMap);
        }
        if (person.names) {
          for (var j = 0; j < person.names.length; j++) {
            var name = person.names[j];
            if (name.nameForms) {
              for (var k = 0; k < name.nameForms.length; k++) {
                var nameForm = name.nameForms[k];
                addFields(nameForm.fields, person.id, personFieldsMap);
                if (nameForm.parts) {
                  for (var l = 0; l < nameForm.parts.length; l++) {
                    addFields(nameForm.parts[l].fields, person.id, personFieldsMap);
                  }
                }
              }
            }
          }
        }
      }
    }
    return personFieldsMap;
  };

  GedcomX.prototype.getAllFields = function() {

    function addFields(listToAdd, allFields) {
      if (listToAdd) {
        for (var i = 0; i < listToAdd.length; i++) {
          allFields.push(listToAdd[i]);
        }
      }
    }

    if (!this.data) {
      return [];
    }
    var allFields = [];
    var personFieldMap = this.getPersonFieldMap();
    var persons = this.data.persons;
    if (persons) {
      for (var i = 0; i < persons.length; i++) {
        addFields(personFieldMap[persons[i].id], allFields);
      }
    }
    addFields(personFieldMap["RECORD_FIELDS"], allFields);
    return allFields;
  };

  GedcomX.prototype.clone = function() {
    if (!this.data) {
      return new GedcomX(null);
    }
    var newData = JSON.parse(JSON.stringify(this.data));
    return new GedcomX(newData);
  };

  GedcomX.prototype.newGxPerson = function(personData) {
    return new GxPerson(this, personData);
  };

  GedcomX.prototype.newFieldMap = function(gxCollection) {
    return new GxFieldMap(this, gxCollection);
  };

  //*********************************************************************************************
  // GedcomX FieldMap code, used for dealing with 'labelId' in field values,
  //   and finding corresponding display labels in record descriptors in the record's collection.
  //   Records have fields with field values with label IDs and text values.
  //   Records also have a source description with a record descriptor reference.
  //   Collections have record descriptors with field descriptors with field value descriptors,
  //     which have labelId and optional localized display labels.
  //   The "#" part of the record descriptor reference matches the local id of the record descriptor.
  //*********************************************************************************************
  function getRecordDescriptor(gxCollection, gxRecord) {
    var sd = gxRecord.getMainSourceDescription();
    while (sd && !sd.descriptor && sd.componentOf) {
      sd = gxRecord.getSourceDescription(sd.componentOf.description);
    }
    if (!sd || !sd.descriptor || !sd.descriptor.resource) {
      return null;
    }
    var ref = sd.descriptor.resource;
    var pos = ref.indexOf('#');
    if (pos > 0) {
      return gxCollection.getRecordDescriptor(ref.slice(pos));
    }
    return null;
  }

  function getLabelFieldValueDescriptorMap(recordDescriptor) {
    if (!recordDescriptor || !recordDescriptor.fields) {
      return null;
    }
    var map = [];
    for (var i = 0; i < recordDescriptor.fields.length; i++) {
      var field = recordDescriptor.fields[i];
      if (field.values) {
        for (j = 0; j < field.values.length; j++) {
          var value = field.values[j];
          if (map[value.labelId]) {
            throw("IllegalState: Multiple field value descriptors for label id: " + value.labelId);
          }
          map[value.labelId] = value;
        }
      }
    }
    return map;
  }

  function getLabelValuesMap(fields) {
    var labelValueMap = [];
    if (fields) {
      for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        if (field.values) {
          for (var j = 0; j < field.values.length; j++) {
            var value = field.values[j];
            var values = labelValueMap[value.labelId];
            if (!values) {
              values = [];
              labelValueMap[value.labelId] = values;
            }
            values.push(value.text);
          }
        }
      }
    }
    return labelValueMap;
  }

  function matchCount(lang1, lang2) {
    var value = 0;
    var parts1 = lang1.split("_");
    var parts2 = lang2.split("_");
    if (parts1[0] === parts2[0]) {
      value += 10;
      var c1 = parts1.length >= 2 ? parts1[1] : "";
      var c2 = parts2.length >= 2 ? parts2[1] : "";
      if (c1 === c2) {
        value += 10;
        var v1 = parts1.length >= 3 ? parts1[2] : "";
        var v2 = parts2.length >= 3 ? parts2[2] : "";
        if (v1 === v2) {
          value += 10;
        }
        else if (v1 === "" || v2 === "") {
          value++;
        }
      }
      else if (c1 === "" || c2 === "") {
        value++;
      }
    }
    return value;
  }

  function isBetterLanguageMatch(preferredLang, currentLang, bestLang, defaultLang) {
    if (!bestLang) {
      return true;
    }
    var currentMatch = matchCount(preferredLang, currentLang);
    var bestMatch = matchCount(preferredLang, bestLang);
    if (currentMatch > bestMatch) {
      return true;
    }
    return bestMatch === 0 && defaultLang !== preferredLang && matchCount(defaultLang, currentLang) > matchCount(defaultLang, bestLang);
  }

  function findClosestLocale(textValues, languageToMatch, defaultLanguage) {
    if (!textValues) {
      return null;
    }
    if (!defaultLanguage) {
      defaultLanguage = "en";
    }
    var bestTextValue = null;
    for (var i = 0; i < textValues.length; i++) {
      var textValue = textValues[i];
      if (!bestTextValue || isBetterLanguageMatch(languageToMatch, textValue.lang, bestTextValue.lang, defaultLanguage)) {
        bestTextValue = textValue;
      }
    }
    return bestTextValue;
  }

  var GxFieldMap = function GxFieldMap(gxRecord, gxCollection) {
    if (!gxRecord.hasOwnProperty('data')) {
      gxRecord = new GedcomX(gxRecord);
    }
    if (!gxCollection.hasOwnProperty('data')) {
      gxCollection = new GedcomX(gxCollection);
    }
    this.gxRecord = gxRecord;
    this.gxCollection = gxCollection;
    this.recordDescriptor = getRecordDescriptor(gxCollection, gxRecord);
    this.labelFieldValueDescriptorMap = getLabelFieldValueDescriptorMap(this.recordDescriptor);
    // Census records have the same labelId repeated once for each person. Other records only have one of each labelId.
    this.isCensus = gxRecord.isCensus();
    if (this.isCensus) {
      this.personLabelValueMap = gxRecord.getPersonLabelValueMap();
    }
    else {
      this.labelValueMap = getLabelValuesMap(gxRecord.getAllFields());
    }
  };

  GxFieldMap.prototype.getGxRecord = function() {
    return this.gxRecord;
  };

  GxFieldMap.prototype.getGxCollection = function() {
    return this.gxCollection;
  };

  GxFieldMap.prototype.getDisplayLabel = function(labelId, language) {
    var fieldValueDescriptor = this.labelFieldValueDescriptorMap[labelId];
    if (fieldValueDescriptor && fieldValueDescriptor.labels) {
      return findClosestLocale(fieldValueDescriptor.labels, language);
    }
    return null;
  };

  GxFieldMap.prototype.getValues = function(labelId, personId) {
    if (this.isCensus) {
      if (!personId) {
        throw "Must supply a person for census collection";
      }
      var labelValueMap = this.personLabelValueMap[personId];
      return labelValueMap ? labelValueMap[labelId] : null;
    }
    if (personId) {
      throw "Must NOT supply a person for non-census collection";
    }
    return this.labelValueMap[labelId];
  };


  //************************************************************************************
  // GedcomX Person Stuff
  //************************************************************************************

  var GxPerson = function GxPerson(gx, person) {
    if (!gx.hasOwnProperty('data')) {
      gx = new GedcomX(gx);
    }
    this.gx = gx;
    if (!person) {
      person = gx.getMainPerson();
    }
    // it's a string--might be URL or id to person
    if (person && !person.id) {
      person = gx.getPerson(person);
    }
    this.data = person;
  };

  GxPerson.prototype.getSourceDescription = function () {
    if (!this.gx || !this.data) {
      return null;
    }
    return this.gx.getSourceDescription(this.getUrl());
  };

  GxPerson.prototype.getUrl = function () {
    if (!this.data) {
      return null;
    }
    var ids = this.data.identifiers['http://gedcomx.org/Persistent'];
    return ids && ids.length > 0 ? ids[0] : null;
  };

  GxPerson.prototype.getNormalizedUrl = function () {
    return normalizeUrl(this.getUrl());
  };

  GxPerson.prototype.getTitle = function () {
    return getTitleFromSourceDescription(this.getSourceDescription());
  };

  GxPerson.prototype.getPartOf = function () {
    var sdPerson = this.getSourceDescription();
    if (!sdPerson) {
      return null;
    }
    return this.gx.getSourceDescription(sdPerson.componentOf);
  };

  GxPerson.prototype.getPartOfUrl = function () {
    var sdPartOf = this.getPartOf();
    if (!sdPartOf) {
      return null;
    }
    return relativizeUrl(sdPartOf.about);
  };

  GxPerson.prototype.getPartOfTitle = function () {
    return getTitleFromSourceDescription(this.getPartOf());
  };

  // Gets the best display name (HTML-encoded/escaped) for the person.
  GxPerson.prototype.getBestName = function () {
    if (!this.data) {
      return "&nbsp;";
    }
    if (this.data.display && this.data.display.name) {
      return safeName(this.data.display.name);
    }
    if (!this.data.names || !this.data.names.length) {
      return safeName(null);
    }
    var name = this.data.names[0];
    if (!name.nameForms || !name.nameForms.length) {
      return safeName(null);
    }
    var nameForm = name.nameForms[0];
    var nameText = nameForm.fullText;
    if (!nameText && nameForm.parts && nameForm.parts.length > 0) {
      var i;
      nameText = "";
      for (i = 0; i < nameForm.parts.length; i++) {
        if (i > 0) {
          nameText += " ";
        }
        nameText += nameForm.parts[i].value;
      }
    }
    return safeName(nameText);
  };

  GxPerson.prototype.getGender = function () {
    if (!this.data || !this.data.gender) {
      return "Unknown";
    }
    if (this.data.display && this.data.display.gender) {
      return this.data.display.gender;
    }
    var gender = this.data.gender.type;
    if (gender === "http://gedcomx.org/Female") {
      return "Female";
    }
    else if (gender === "http://gedcomx.org/Male") {
      return "Male";
    }
    return "Unknown";
  };

  GxPerson.prototype.getBestBirthYear = function() {
    var birthYear = this.getFactYear("http://gedcomx.org/Birth");
    if (birthYear === "") {
      birthYear = this.getFactYear("http://gedcomx.org/Christening");
    }
    return birthYear;
  };

  GxPerson.prototype.getBestDeathYear = function() {
    var deathYear = this.getFactYear("http://gedcomx.org/Death");
    if (deathYear === "") {
      deathYear = this.getFactYear("http://gedcomx.org/Burial");
    }
    return deathYear;
  };

  GxPerson.prototype.isLiving = function() {
    if (typeof this.data.living !== 'undefined') {
      return this.data.living;
    }
    if (this.hasDeathlikeEvent()) {
      return false;
    }
    var birthYear = this.getBestBirthYear();
    var result = parseInt(birthYear);
    if (isNaN(result)) {
      return false;
    }
    var currentYear = new Date().getFullYear();
    var age = currentYear - result;
    return age < 105;
  };

  GxPerson.prototype.getLifespan = function () {
    if (!this.data) {
      return "&nbsp;";
    }
    if (this.data && this.data.display && this.data.display.lifespan) {
      return this.data.display.lifespan;
    }
    var birthYear = this.getBestBirthYear();
    var deathYear = this.getBestDeathYear();
    if (this.isLiving()) {
      if (birthYear === '') {
        return 'Living';
      }
      deathYear = 'Living';
    }
    var separator = (birthYear.length === 0 && deathYear.length === 0 ? "&nbsp;" : " - ");
    return birthYear + separator + deathYear;
  };

  GxPerson.prototype.getFacts = function(factType) {
    if (!this.data || !this.data.facts) {
      return [];
    }
    if (!factType) {
      return this.data.facts;
    }
    var rtn = [];
    var fact;
    for (var i = 0; i < this.data.facts.length; i++) {
      fact = this.data.facts[i];
      if (fact.type === factType) {
        rtn.push(fact);
      }
    }
    return rtn;
  };

  GxPerson.prototype.addFact = function(type, date, place) {
    if (this.data) {
      if (!this.data.facts) {
        this.data.facts = [];
      }
      var fact = {type: type};
      if (date) {
        fact.date = {original: date};
      }
      if (place) {
        fact.place = {original: place};
      }
      this.data.facts.push(fact);
    }
  };

  GxPerson.prototype.hasDeathlikeEvent = function() {
    return this.getFact("http://gedcomx.org/Death") || this.getFact("http://gedcomx.org/Death");
  };

  GxPerson.prototype.getFact = function (factType) {
    if (!this.data || !this.data.facts) {
      return null;
    }
    var i;
    for (i = 0; i < this.data.facts.length; i++) {
      var fact = this.data.facts[i];
      if (factType === fact.type) {
        return fact;
      }
    }
    return null;
  };

  GxPerson.prototype.getFactDate = function (fact) {
    if (!fact || !fact.date || !fact.date.original) {
      return "";
    }
    return fact.date.original;
  };

  GxPerson.prototype.getFactPlace = function (fact) {
    if (!fact || !fact.place || !fact.place.original) {
      return "";
    }
    return fact.place.original;
  };

  GxPerson.prototype.getFactYear = function (factType) {
    var fact = this.getFact(factType);
    if (!fact) {
      return "";
    }
    return parseYear(this.getFactDate(fact));
  };

  GxPerson.prototype.hasChild = function (child) {
    if (!child || !child.id) {
      return false;
    }
    var children = this.getChildren();
    for (var i = 0; i < children.length; i++) {
      if (children[i].id === child.id) {
        return true;
      }
    }
    return false;
  };

  GxPerson.prototype.getChildren = function () {
    if (!this.children) {
      this.children = [];
      if (this.gx && this.gx.data && this.gx.data.relationships) {
        var rels = this.gx.data.relationships;
        for (var i = 0; i < rels.length; i++) {
          var rel = rels[i];
          if (rel.type !== 'http://gedcomx.org/ParentChild') {
            continue;
          }
          var relParent = this.gx.getPerson(rel.person1.resource);
          if (relParent && relParent.id === this.data.id) {
            this.children.push(this.gx.getPerson(rel.person2.resource));
          }
        }
      }
    }
    return this.children;
  };

  GxPerson.prototype.getSpouses = function () {
    if (!this.spouses) {
      this.spouses = [];
      if (this.gx && this.gx.data && this.gx.data.relationships) {
        var rels = this.gx.data.relationships;
        for (var i = 0; i < rels.length; i++) {
          var rel = rels[i];
          if (rel.type !== 'http://gedcomx.org/Couple') {
            continue;
          }
          var p1 = this.gx.getPerson(rel.person1.resource);
          var p2 = this.gx.getPerson(rel.person2.resource);
          this.spouses.push(p1.id === this.data.id ? p2 : p1);
        }
      }
    }
    return this.spouses;
  };

  GxPerson.prototype.getParents = function () {
    if (!this.parents) {
      this.parents = [];
      if (this.gx && this.gx.data && this.gx.data.relationships) {
        var rels = this.gx.data.relationships;
        for (var i = 0; i < rels.length; i++) {
          var rel = rels[i];
          if (rel.type !== 'http://gedcomx.org/ParentChild') {
            continue;
          }
          var relChild = this.gx.getPerson(rel.person2.resource);
          if (relChild && relChild.id === this.data.id) {
            this.parents.push(this.gx.getPerson(rel.person1.resource));
          }
        }
      }
    }
    return this.parents;
  };

  GxPerson.prototype.getSiblings = function () {
    if (!this.siblings) {
      this.siblings = [];
      if (this.gx && this.gx.data && this.gx.data.relationships) {
        var rels = this.gx.data.relationships;
        for (var i = 0; i < rels.length; i++) {
          var rel = rels[i];
          if (rel.type !== 'http://familysearch.org/Sibling') {
            continue;
          }
          var p1 = this.gx.getPerson(rel.person1.resource);
          var p2 = this.gx.getPerson(rel.person2.resource);
          this.siblings.push(p1.id === this.data.id ? p2 : p1);
        }
      }
    }
    return this.siblings;
  };

  GxPerson.prototype.hasParent = function (parentUrl) {
    if (!this.gx || !parentUrl) {
      return false;
    }
    var parents = this.getParents();
    var parent = this.gx.getPerson(parentUrl);
    for (var i = 0; i < parents.length; i++) {
      if (parent.id === parents[i].id) {
        return true;
      }
    }
    return false;
  };

  GxPerson.prototype.getSources = function() {
    var sd = this.getSourceDescription();
    if (!sd || !sd.sources) {
      return [];
    }
    return sd.sources;
  };

  GxPerson.prototype.getSource = function(url) {
    var sources = this.getSources();
    if (!url || !sources) {
      return null;
    }
    var normUrl = normalizeUrl(url);
    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      if (normalizeUrl(source.about) === normUrl) {
        return source;
      }
    }
    return null;
  };

  GxPerson.prototype.hasSource = function (url) {
    return this.getSource(url);
  };

  GxPerson.prototype.clone = function() {
    if (!this.gx || !this.data) {
      return new GxPerson(null);
    }
    var newGx = this.gx.clone();
    return new GxPerson(newGx, newGx.getPerson(this.data.id));
  };

  /**
   * If we are in a system that uses CommonJS use it.  Otherwise
   * global Allows you to instantiate this service like var gx = new GedcomX(data);
   */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = new GedcomX;
  }
  else {
    global.GedcomX = GedcomX;
  }

}(this));
