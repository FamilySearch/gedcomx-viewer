const summaryFactTypeToGx = {
  // Events...
  "ADOPTION"                         : "http://gedcomx.org/Adoption",
  "ADULTCHRISTENING"                 : "http://gedcomx.org/AdultChristening",
  "ADULT_CHRISTENING"                : "http://gedcomx.org/AdultChristening",
  "AMNESTY"                          : "http://gedcomx.org/Amnesty",
  "ANCESTRALHOME"                    : "http://familysearch.org/types/facts/AncestralHome",
  "ANCESTRAL_HOME"                   : "http://familysearch.org/types/facts/AncestralHome",
  "ANNULMENT"                        : "http://gedcomx.org/Annulment",
  "APPRENTICESHIP"                   : "http://gedcomx.org/Apprenticeship",
  "BAPTISM"                          : "http://gedcomx.org/Baptism",
  "BARMITZVAH"                       : "http://gedcomx.org/BarMitzvah",
  "BAR_MITZVAH"                      : "http://gedcomx.org/BarMitzvah",
  "BATMITZVAH"                       : "http://gedcomx.org/BatMitzvah",
  "BAT_MITZVAH"                      : "http://gedcomx.org/BatMitzvah",
  "BIOGRAPHY"                        : "http://familysearch.org/types/facts/Biography",
  "BIRTH"                            : "http://gedcomx.org/Birth",
  "BIRTHNOTICE"                      : "http://gedcomx.org/BirthNotice",
  "BIRTHREGISTRATION"                : "http://familysearch.org/types/facts/BirthRegistration",
  "BIRTH_NOTICE"                     : "http://gedcomx.org/BirthNotice",
  "BIRTH_REGISTRATION"               : "http://familysearch.org/types/facts/BirthRegistration",
  "BLESSING"                         : "http://gedcomx.org/Blessing",
  "BURIAL"                           : "http://gedcomx.org/Burial",
  "CENSUS"                           : "http://gedcomx.org/Census",
  "CHRISTENING"                      : "http://gedcomx.org/Christening",
  "CIRCUMCISION"                     : "http://gedcomx.org/Circumcision",
  "CITIZENSHIP"                      : "http://familysearch.org/types/facts/Citizenship",
  "COMINGOFAGE"                      : "http://familysearch.org/types/facts/ComingOfAge",
  "COMING_OF_AGE"                    : "http://familysearch.org/types/facts/ComingOfAge",
  "CONFIRMATION"                     : "http://gedcomx.org/Confirmation",
  "COURT"                            : "http://gedcomx.org/Court",
  "CREMATION"                        : "http://gedcomx.org/Cremation",
  "DEATH"                            : "http://gedcomx.org/Death",
  "DEATHNOTICE"                      : "http://familysearch.org/types/facts/DeathNotice",
  "DEATHREGISTRATION"                : "http://familysearch.org/types/facts/DeathRegistration",
  "DEATH_NOTICE"                     : "http://familysearch.org/types/facts/DeathNotice",
  "DEATH_REGISTRATION"               : "http://familysearch.org/types/facts/DeathRegistration",
  "DIVORCE"                          : "http://gedcomx.org/Divorce",
  "DIVORCEFILING"                    : "http://gedcomx.org/DivorceFiling",
  "DIVORCE_FILING"                   : "http://gedcomx.org/DivorceFiling",
  "DOMESTICPARTNERSHIP"              : "http://gedcomx.org/DomesticPartnership",
  "DOMESTIC_PARTNERSHIP"             : "http://gedcomx.org/DomesticPartnership",
  "ELDERORDINATION"                  : "http://familysearch.org/types/facts/ElderOrdination",
  "ELDER_ORDINATION"                 : "http://familysearch.org/types/facts/ElderOrdination",
  "ELECTION"                         : "http://familysearch.org/types/facts/Election",
  "EMIGRATION"                       : "http://gedcomx.org/Emigration",
  "ENGAGEMENT"                       : "http://gedcomx.org/Engagement",
  "ENSLAVEMENT"                      : "http://gedcomx.org/Enslavement",
  "EXCOMMUNICATION"                  : "http://gedcomx.org/Excommunication",
  "FINANCIALTRANSACTION"             : "http://familysearch.org/types/facts/Financial",
  "FINANCIAL_TRANSACTION"            : "http://familysearch.org/types/facts/Financial",
  "FIRSTCOMMUNION"                   : "http://gedcomx.org/FirstCommunion",
  "FIRST_COMMUNION"                  : "http://gedcomx.org/FirstCommunion",
  "FLOURISH"                         : "http://gedcomx.org/Living",
  "FUNERAL"                          : "http://gedcomx.org/Funeral",
  "GRADUATION"                       : "http://gedcomx.org/Graduation",
  "HIGHPRIESTORDINATION"             : "http://familysearch.org/types/facts/HighPriestOrdination",
  "HIGH_PRIEST_ORDINATION"           : "http://familysearch.org/types/facts/HighPriestOrdination",
  "ILLNESS"                          : "http://familysearch.org/types/facts/Illness",
  "IMMIGRATION"                      : "http://gedcomx.org/Immigration",
  "IMPRISONMENT"                     : "http://gedcomx.org/Imprisonment",
  "INQUEST"                          : "http://gedcomx.org/Inquest",
  "LANDASSESSMENT"                   : "http://familysearch.org/types/facts/LandAssessment",
  "LANDTRANSACTION"                  : "http://gedcomx.org/LandTransaction",
  "LAND_ASSESSMENT"                  : "http://familysearch.org/types/facts/LandAssessment",
  "LAND_TRANSACTION"                 : "http://gedcomx.org/LandTransaction",
  "LASTRITE"                         : "http://familysearch.org/types/facts/LastRites",
  "LAST_RITE"                        : "http://familysearch.org/types/facts/LastRites",
  "LEGAL"                            : "http://familysearch.org/types/facts/Legal",
  "LEGITIMATION"                     : "http://familysearch.org/types/facts/Legitimation",
  "MANUMISSION"                      : "http://familysearch.org/types/facts/Manumission",
  "MARRIAGE"                         : "http://gedcomx.org/Marriage",
  "MARRIAGEBANNS"                    : "http://gedcomx.org/MarriageBanns",
  "MARRIAGECONTRACT"                 : "http://gedcomx.org/MarriageContract",
  "MARRIAGEINTENT"                   : "http://familysearch.org/types/facts/IntendedMarriage",
  "MARRIAGELICENSE"                  : "http://gedcomx.org/MarriageLicense",
  "MARRIAGENOTICE"                   : "http://gedcomx.org/MarriageNotice",
  "MARRIAGEREGISTRATION"             : "http://familysearch.org/types/facts/MarriageRegistration",
  "MARRIAGESETTLEMENT"               : "http://familysearch.org/types/facts/MarriageSettlement",
  "MARRIAGE_BANNS"                   : "http://gedcomx.org/MarriageBanns",
  "MARRIAGE_CONTRACT"                : "http://gedcomx.org/MarriageContract",
  "MARRIAGE_INTENT"                  : "http://familysearch.org/types/facts/IntendedMarriage",
  "MARRIAGE_LICENSE"                 : "http://gedcomx.org/MarriageLicense",
  "MARRIAGE_NOTICE"                  : "http://gedcomx.org/MarriageNotice",
  "MARRIAGE_REGISTRATION"            : "http://familysearch.org/types/facts/MarriageRegistration",
  "MARRIAGE_SETTLEMENT"              : "http://familysearch.org/types/facts/MarriageSettlement",
  "MEDICAL"                          : "http://gedcomx.org/Medical",
  "MELCHIZEDEKPRIESTHOODCONFERRAL"   : "http://familysearch.org/types/facts/MelchizedekPriesthoodConferral",
  "MELCHIZEDEK_PRIESTHOOD_CONFERRAL" : "http://familysearch.org/types/facts/MelchizedekPriesthoodConferral",
  "MEMBERSHIP"                       : "http://familysearch.org/types/facts/Membership",
  "MIGRATION"                        : "http://familysearch.org/types/facts/Migration",
  "MILITARYAWARD"                    : "http://gedcomx.org/MilitaryAward",
  "MILITARYCASUALTY"                 : "http://familysearch.org/types/facts/MilitaryCasualty",
  "MILITARYCORRESPONDENCE"           : "http://familysearch.org/types/facts/MilitaryCorrespondence",
  "MILITARYDISCHARGE"                : "http://gedcomx.org/MilitaryDischarge",
  "MILITARYDISPOSITION"              : "http://familysearch.org/types/facts/MilitaryDisposition",
  "MILITARYDRAFTREGISTRATION"        : "http://gedcomx.org/MilitaryDraftRegistration",
  "MILITARYENLISTMENT"               : "http://gedcomx.org/MilitaryInduction",
  "MILITARYPENSION"                  : "http://familysearch.org/types/facts/MilitaryPension",
  "MILITARYSERVICE"                  : "http://gedcomx.org/MilitaryService",
  "MILITARYTOUR"                     : "http://familysearch.org/types/facts/MilitaryTour",
  "MILITARY_AWARD"                   : "http://gedcomx.org/MilitaryAward",
  "MILITARY_CASUALTY"                : "http://familysearch.org/types/facts/MilitaryCasualty",
  "MILITARY_CORRESPONDENCE"          : "http://familysearch.org/types/facts/MilitaryCorrespondence",
  "MILITARY_DISCHARGE"               : "http://gedcomx.org/MilitaryDischarge",
  "MILITARY_DISPOSITION"             : "http://familysearch.org/types/facts/MilitaryDisposition",
  "MILITARY_DRAFT_REGISTRATION"      : "http://gedcomx.org/MilitaryDraftRegistration",
  "MILITARY_ENLISTMENT"              : "http://gedcomx.org/MilitaryInduction",
  "MILITARY_PENSION"                 : "http://familysearch.org/types/facts/MilitaryPension",
  "MILITARY_SERVICE"                 : "http://gedcomx.org/MilitaryService",
  "MILITARY_TOUR"                    : "http://familysearch.org/types/facts/MilitaryTour",
  "MISSION"                          : "http://gedcomx.org/Mission",
  "MOVE"                             : "http://familysearch.org/types/facts/Move",
  "MOVEFROM"                         : "http://gedcomx.org/MoveFrom",
  "MOVETO"                           : "http://gedcomx.org/MoveTo",
  "MOVE_FROM"                        : "http://gedcomx.org/MoveFrom",
  "MOVE_TO"                          : "http://gedcomx.org/MoveTo",
  "MUNICIPALCENSUS"                  : "http://familysearch.org/types/facts/MunicipalCensus",
  "MUNICIPAL_CENSUS"                 : "http://familysearch.org/types/facts/MunicipalCensus",
  "NATIONALIDENTIFICATIONISSUANCE"   : "http://familysearch.org/types/facts/NationalIdentificationIssuance",
  "NATIONAL_IDENTIFICATION_ISSUANCE" : "http://familysearch.org/types/facts/NationalIdentificationIssuance",
  "NATURALIZATION"                   : "http://gedcomx.org/Naturalization",
  "OBITUARY"                         : "http://gedcomx.org/Obituary",
  "ORDINANCE"                        : "http://familysearch.org/types/facts/Ordinance",
  "ORDINATION"                       : "http://gedcomx.org/Ordination",
  "PASSPORT"                         : "http://familysearch.org/types/facts/Passport",
  "PASSPORTAPPLICATION"              : "http://familysearch.org/types/facts/PassportApplication",
  "PASSPORT_APPLICATION"             : "http://familysearch.org/types/facts/PassportApplication",
  "PENSION"                          : "http://familysearch.org/types/facts/Pension",
  "PHOTOGRAPH"                       : "http://familysearch.org/types/facts/Photograph",
  "PROBATE"                          : "http://gedcomx.org/Probate",
  "PROPERTY"                         : "http://gedcomx.org/Property",
  "RECOGNITION"                      : "http://familysearch.org/types/facts/Recognition",
  "RESIDENCE"                        : "http://gedcomx.org/Residence",
  "RETIREMENT"                       : "http://gedcomx.org/Retirement",
  "SCHOOLENROLLMENT"                 : "http://gedcomx.org/EducationEnrollment",
  "SCHOOL_ENROLLMENT"                : "http://gedcomx.org/EducationEnrollment",
  "SEPARATION"                       : "http://gedcomx.org/Separation",
  "SETAPART"                         : "http://familysearch.org/types/facts/SetApart",
  "SET_APART"                        : "http://familysearch.org/types/facts/SetApart",
  "SEVENTYORDINATION"                : "http://familysearch.org/types/facts/SeventyOrdination",
  "SEVENTY_ORDINATION"               : "http://familysearch.org/types/facts/SeventyOrdination",
  "STILLBIRTH"                       : "http://gedcomx.org/Stillbirth",
  "STILL_BIRTH"                      : "http://gedcomx.org/Stillbirth",
  "TAXASSESSMENT"                    : "http://gedcomx.org/TaxAssessment",
  "TAX_ASSESSMENT"                   : "http://gedcomx.org/TaxAssessment",
  "TRAVEL"                           : "http://familysearch.org/types/facts/Travel",
  "UNKNOWN"                          : "http://familysearch.org/types/facts/Unknown",
  "UPHEAVAL"                         : "http://familysearch.org/types/facts/Upheaval",
  "VOTERREGISTRATION"                : "http://familysearch.org/types/facts/VoterRegistration",
  "VOTER_REGISTRATION"               : "http://familysearch.org/types/facts/VoterRegistration",
  "WILL"                             : "http://gedcomx.org/Will",
  "WORKHOUSEADMISSION"               : "http://familysearch.org/types/facts/WorkhouseAdmission",
  "WORKHOUSE_ADMISSION"              : "http://familysearch.org/types/facts/WorkhouseAdmission",
  // Characteristics...
  "BRANCHNAME"        : "http://familysearch.org/types/facts/BranchName",
  "BRANCH_NAME"       : "http://familysearch.org/types/facts/BranchName",
  "CHILDORDER"        : "http://familysearch.org/types/facts/ChildOrder",
  "CHILD_ORDER"       : "http://familysearch.org/types/facts/ChildOrder",
  "CONCURRENTHEIR"    : "http://familysearch.org/types/facts/ConcurrentHeir",
  "CONCURRENT_HEIR"   : "http://familysearch.org/types/facts/ConcurrentHeir",
  "DISTINCTION"       : "http://familysearch.org/types/facts/Distinction",
  "EDUCATION"         : "http://gedcomx.org/Education",
  "ENTERINGHEIR"      : "http://familysearch.org/types/facts/EnteringHeir",
  "ENTERING_HEIR"     : "http://familysearch.org/types/facts/EnteringHeir",
  "ETHNICITY"         : "http://gedcomx.org/Ethnicity",
  "EXITINGHEIR"       : "http://familysearch.org/types/facts/ExitingHeir",
  "EXITING_HEIR"      : "http://familysearch.org/types/facts/ExitingHeir",
  "GENERATIONNUMBER"  : "http://familysearch.org/types/facts/GenerationNumber",
  "GENERATION_NUMBER" : "http://familysearch.org/types/facts/GenerationNumber",
  "LIFESKETCH"        : "http://familysearch.org/types/facts/LifeSketch",
  "LIFE_SKETCH"       : "http://familysearch.org/types/facts/LifeSketch",
  "MARITALSTATUS"     : "http://gedcomx.org/MaritalStatus",
  "MARITAL_STATUS"    : "http://gedcomx.org/MaritalStatus",
  "NATIONALITY"       : "http://gedcomx.org/Nationality",
  "OCCUPATION"        : "http://gedcomx.org/Occupation",
  "PARENTTYPE"        : "http://familysearch.org/types/facts/ParentType",
  "PARENT_TYPE"       : "http://familysearch.org/types/facts/ParentType",
  "RACE"              : "http://gedcomx.org/Race",
  "RELIGION"          : "http://gedcomx.org/Religion"
}

const summaryRelationshipTypeToGx = {
  "ADOPTIVEPARENT"       : "http://gedcomx.org/AdoptiveParent",
  "ADOPTIVE_PARENT"      : "http://gedcomx.org/AdoptiveParent",
  "ANCESTORDESCENDANT"   : "http://gedcomx.org/AncestorDescendant",
  "ANCESTOR_DESCENDANT"  : "http://gedcomx.org/AncestorDescendant",
  "AUNTORUNCLE"          : "http://familysearch.org/types/relationships/AuntOrUncle",
  "AUNT_OR_UNCLE"        : "http://familysearch.org/types/relationships/AuntOrUncle",
  "COUPLE"               : "http://gedcomx.org/Couple",
  "COUSIN"               : "http://familysearch.org/types/relationships/Cousin",
  "DIVORCEDCOUPLE"       : "http://gedcomx.org/Divorce",
  "DIVORCED_COUPLE"      : "http://gedcomx.org/Divorce",
  "DOMESTICPARTNERSHIP"  : "http://gedcomx.org/DomesticPartnership",
  "DOMESTIC_PARTNERSHIP" : "http://gedcomx.org/DomesticPartnership",
  "ENSLAVEDBY"           : "http://gedcomx.org/EnslavedBy",
  "ENSLAVED_BY"          : "http://gedcomx.org/EnslavedBy",
  "FIANCE"               : "http://familysearch.org/types/relationships/Fiance",
  "FOSTERPARENT"         : "http://gedcomx.org/FosterParent",
  "FOSTER_PARENT"        : "http://gedcomx.org/FosterParent",
  "GODPARENT"            : "http://gedcomx.org/Godparent",
  "GOD_PARENT"           : "http://gedcomx.org/Godparent",
  "GRANDPARENT"          : "http://familysearch.org/types/relationships/Grandparent",
  "GRAND_PARENT"         : "http://familysearch.org/types/relationships/Grandparent",
  "GUARDIANPARENT"       : "http://gedcomx.org/GuardianParent",
  "GUARDIAN_PARENT"      : "http://gedcomx.org/GuardianParent",
  "PARENTCHILD"          : "http://gedcomx.org/ParentChild",
  "PARENTCHILDINLAW"     : "http://familysearch.org/types/relationships/ParentChildInLaw",
  "PARENT_CHILD"         : "http://gedcomx.org/ParentChild",
  "PARENT_CHILD_IN_LAW"  : "http://familysearch.org/types/relationships/ParentChildInLaw",
  "RELATIVE"             : "http://familysearch.org/types/relationships/Relative",
  "SIBLING"              : "http://familysearch.org/types/relationships/Sibling",
  "SIBLINGINLAW"         : "http://familysearch.org/types/relationships/SiblingInLaw",
  "SIBLING_IN_LAW"       : "http://familysearch.org/types/relationships/SiblingInLaw",
  "STEPPARENT"           : "http://gedcomx.org/StepParent",
  "STEPSIBLING"          : "http://familysearch.org/types/relationships/StepSibling",
  "STEP_PARENT"          : "http://gedcomx.org/StepParent",
  "STEP_SIBLING"         : "http://familysearch.org/types/relationships/StepSibling",
  "SURROGATEPARENT"      : "http://gedcomx.org/SurrogateParent",
  "SURROGATE_PARENT"     : "http://gedcomx.org/SurrogateParent"
}

function convertSummaryArrayToGx(summaryArray, converterFunction) {
  if (summaryArray) {
    let gxArray = [];
    for (let summaryElement of summaryArray) {
      let gxElement = converterFunction(summaryElement);
      if (gxElement) {
        gxArray.push(gxElement);
      }
    }
    return gxArray;
  }
  else {
    return null;
  }
}

/**
 * Add a Field with bounding boxes to the given GedcomX object.
 * @param gxObject - GedcomX Field object to add bounding boxes to.
 * @param summaryObject - Summary object to get bounding boxes from. Has a "bbox" object with an array of bounding boxes.
 *   Each bounding box consists of an array of four integers (x1, y1, x2, y2) plus an optional page specifier (e.g., "p1")
 *   if it isn't the default "p0".  For example object.bbox = [[10,30,432,43],[100,140,120,190,"p1"]]
 * @param text - Text to put in the FieldValue of the new Field.
 * @param fieldType - FieldType to use for the new Field (e.g., "http://gedcomx.org/Date")
 * @param isInterpreted - Optional boolean flag for whether the given text should be considered "interpreted" rather than "original" text from the image.
 */
function addBBox(gxObject, summaryObject, text, fieldType, isInterpreted) {
  if (summaryObject && summaryObject.bbox) {
    let qualifierMap = new Map(); // map of pageId (default: p0) => list of qualifiers for that page id.
    for (let bbox of summaryObject.bbox) {
      let pageId = bbox.length > 4 ? bbox[4] : "p0";
      let qualifier = {
        "name" : "http://gedcomx.org/RectangleRegion",
        "value" : bbox.slice(0, 4).join(",")
      }
      let qualifiers = qualifierMap.get(pageId);
      if (!qualifiers) {
        qualifiers = [];
        qualifierMap.set(pageId, qualifiers);
      }
      qualifiers.push(qualifier);
    }

    let sources = [];
    for (let [pageId, qualifiers] of qualifierMap) {
      let source = {
        "resource" : "#sd_" + pageId,
        "qualifiers" : qualifiers
      };
      sources.push(source);
    }

    let field = {
      "type" : fieldType,
      "values" : [{
        "type" : "http://gedcomx.org/" + (isInterpreted ? "Interpreted" : "Original"),
        "value" : text
      }],
      "sources" : sources
    }
    gxObject.fields = [field];
  }
}

function summaryNameToGx(sName) {
  let gxNameParts = [];
  let gxFullText = "";
  for (let namePartType of ["Prefix", "Given", "Surname", "Suffix"]) {
    let sNamePart = sName[namePartType.toLowerCase()];
    if (sNamePart) {
      let gxNamePart = {
        "type": "http://gedcomx.org/" + namePartType,
        "value": sNamePart.text
      }
      gxNameParts.push(gxNamePart);
      if (gxFullText.length > 0) {
        gxFullText += " ";
      }
      gxFullText += sNamePart.text;
      addBBox(gxNamePart, sNamePart, sNamePart.text,"http://gedcomx.org/" + namePartType);
    }
  }
  return {
    "nameForms": [{
      "fullText" : gxFullText,
      "parts" : gxNameParts
    }]
  };
}

function summaryDateToGx(sDate) {
  if (sDate && sDate.text) {
    let gxDate = {};
    gxDate.original = sDate.text;
    addBBox(gxDate, sDate, sDate.text, "http://gedcomx.org/Date");
    return gxDate;
  }
  return null;
}

function summaryPlaceToGx(sPlace) {
  if (sPlace && sPlace.text) {
    let gxPlace = {};
    gxPlace.original = sPlace.text;
    addBBox(gxPlace, sPlace, sPlace.text, "http://gedcomx.org/Place");
    return gxPlace;
  }
  return null;
}

function summaryFactToGx(sFact) {
  if (sFact.type === 'AGE' || sFact.type === 'GENDER') {
    // These are not GedcomX "facts". Pull them out separately.
    return null;
  }
  let gxFact = {};
  gxFact.type = summaryFactTypeToGx[sFact.type.toUpperCase()];
  if (!gxFact.type) {

  }
  if (sFact.date) {
    gxFact.date = summaryDateToGx(sFact.date);
  }
  if (sFact.place) {
    gxFact.place = summaryPlaceToGx(sFact.place);
  }
  if (sFact.value) {
    if (sFact.value.text) {
      gxFact.value = sFact.value.text;
    }
    addBBox(gxFact, sFact.value, sFact.text, gxFact.type);
  }
}

/**
 * Get the 'value' of the first summary fact that has the given summary fact type
 * @param sFacts - Array of summary facts
 * @param sFactType - Summary fact type (e.g., "AGE")
 * @returns First summary fact with the given fact type, or null if none found.
 */
function getSummaryFactValue(sFacts, sFactType) {
  if (sFacts) {
    for (let sFact of sFacts) {
      if (sFact.type === sFactType) {
        return sFact.value;
      }
    }
  }
  return null;
}

/**
 * If the given sGenderValue is non-null and has text of 'male' or 'female', then set the gender on the given GedcomX person.
 * @param gxPerson - GedcomX person to set the gender on
 * @param sGenderValue - Summary 'fact' for GENDER, with
 */
function setPersonGender(gxPerson, sGenderValue) {
  if (sGenderValue && (sGenderValue.text === 'male' || sGenderValue.text === 'female')) {
    gxPerson.gender = {
      "type" : "http://gedcomx.org/" + (sGenderValue.text === 'male' ? "Male" : "Female")
    }
    addBBox(gxPerson.gender, sGenderValue, sGenderValue.text, "http://gedcomx.org/Gender", true);
  }
}

function setPersonAge(gxPerson, sAgeValue) {
  if (sAgeValue && sAgeValue.text) {
    addBBox(gxPerson, sAgeValue, sAgeValue.text, "http://gedcomx.org/Age");
  }
}

function summaryPersonToGx(sPerson) {
  let gxPerson = {};
  gxPerson.id = sPerson.id;
  if (sPerson.name) {
    gxPerson.names = [summaryNameToGx(sPerson.name)];
  }
  setPersonGender(gxPerson, getSummaryFactValue(sPerson.facts, "GENDER"));
  setPersonAge(gxPerson, getSummaryFactValue(sPerson.facts, "AGE"));
  gxPerson.facts = convertSummaryArrayToGx(sPerson.facts, summaryFactToGx);
  return gxPerson;
}

function summaryRelationshipToGx(sRelationship) {
  let p1p2 = sRelationship.value.split(" ");
  let p1 = p1p2[0];
  let p2 = p1p2[1];

  let gxRelationship = {
    "type" : summaryRelationshipTypeToGx[sRelationship.type],
    "person1" : {
      "resourceId" : p1,
      "resource" : "#" + p1
    },
    "person2" : {
      "resourceId" : p2,
      "resource" : "#" + p2
    }
  };
  if (sRelationship.facts) {
    gxRelationship.facts = convertSummaryArrayToGx(sRelationship.facts, summaryFactToGx);
  }
  return gxRelationship;
}

function summaryRecordToGx(sRecord) {
  let gx = {};
  gx.persons = convertSummaryArrayToGx(sRecord.people, summaryPersonToGx);
  gx.relationships = convertSummaryArrayToGx(sRecord.relationships, summaryRelationshipToGx);
  gx.sourceDescriptions = [
    {
      "id": "sd_rec",
      "resourceType" : "http://gedcomx.org/Record"
    }
  ];
  return gx;
}

/**
 * Convert a summary object (created from parseSummary(summaryText)) to GedcomX.
 * Assumes two images with local IDs "Page1" and "Page2"
 * @param summaryModel - Summary object from Image-to-summary
 */
function summaryModelToGx(summaryModel) {
  let recordSet = convertSummaryArrayToGx(summaryModel.records, summaryRecordToGx);
  // For reach image, add a SourceDescription with id "sd_p0", "sd_p1", etc., to all of the GedcomX records.
  if (summaryModel.meta && summaryModel.meta.imageDimensions) {
    for (let gxRecord of recordSet) {
      for (let i = 0; i < summaryModel.meta.imageDimensions.length; i++) {
        let sourceDescription = {
          "id": "sd_p" + i,
          "fields": [
            {
              "type": "http://familysearch.org/types/fields/FsImageDimensions",
              "values": [
                {
                  "type": "http://gedcomx.org/Interpreted",
                  "value": summaryModel.meta.imageDimensions[i].join(","),
                  "labelId": "FS_IMAGE_DIMENSIONS"
                }
              ]
            }
          ]
        };
        gxRecord.sourceDescriptions.push(sourceDescription);
      }
    }
  }

  return recordSet;
}

function summaryToGx(i2sSummary) {
  let summaryModel = parseSummaryIntoSummaryModel(i2sSummary);
  return summaryModelToGx(summaryModel);
}