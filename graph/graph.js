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

/**
 * Create a RelationshipGraph, construct from that a RelationshipChart, and return it.
 * @param gx - GedcomX document to visualize
 * @param isEditable - Flag for whether to include edit controls (requires JQuery UI dependency)
 * @param prevChart - Previous RelationshipChart object to use to get initial positions for corresponding PersonBox and FamilyLine elements.
 * @param ignoreUndo - Flag for whether to ignore the undo logic (set to true for undo/redo actions).
 * @param imgOverlayToGx - Map of DOM element ID of an image overlay rectangle to the id of the GedcomX element that it goes with. Ignored if null.
 * @param isDraggable - Flag for whether the rel chart should be draggable.
 * @returns {RelationshipChart}
 */
function buildGraph(gx, isEditable, prevChart, ignoreUndo, imgOverlayToGx = null, isDraggable = false) {
  return buildRelGraph(gx, prevChart ? prevRelChartOptions(prevChart, ignoreUndo): new ChartOptions({
    isEditable: isEditable,
    prevChart: prevChart,
    ignoreUndo: ignoreUndo,
    imgOverlayToGx: imgOverlayToGx,
    isDraggable: isDraggable
  }));
}

function buildMultipleRelGraphs(gxRecordSet, chartOptions) {
  let $relChartDiv = $("#rel-chart");
  let recordId = 0;
  for (let gx of gxRecordSet) {
    let subChartId = "record-" + recordId;
    $relChartDiv.append("<div id='" + subChartId + "></div>");
    buildRelGraph(gx, chartOptions, subChartId);
    $relChartDiv.append("<hr>");
    recordId++;
  }
}

/**
 * Create a RelationshipGraph, construct from that a RelationshipChart, and return it.
 * @param gx - GedcomX document to visualize
 * @param chartOptions - ChartOptions object
 * @param relChartDiv - optional HTML div ID of the div where the relationship chart will go (default="rel-chart")
 * @returns {RelationshipChart}
 */
function buildRelGraph(gx, chartOptions, relChartDiv='rel-chart') {
  if (!chartOptions && currentRelChart) {
    chartOptions = prevRelChartOptions(currentRelChart);
  }
  if (!chartOptions.imgOverlayToGx && chartOptions.prevChart) {
    chartOptions.imgOverlayToGx = chartOptions.prevChart.imgOverlayToGx; // in case this is non-null.
  }
  try {
    let graph = new RelationshipGraph(gx, chartOptions.prevChart ? chartOptions.prevChart.chartId : null);
    let $relChartDiv = $("#" + relChartDiv);
    if (!currentRelChart) {
      $(document).keydown(handleGraphKeydown);
    }
    let relChartBuilder = new RelChartBuilder(graph, $relChartDiv, chartOptions);
    let relChart = relChartBuilder.buildChart(chartOptions.prevChart, chartOptions.imgOverlayToGx);
    $relChartDiv.width(relChart.width);
    $relChartDiv.height(relChart.height);
    if (chartOptions.isDraggable) {
      $relChartDiv.draggable();
    }
    currentRelChart = relChart;
    return relChart;
  }
  catch (err) {
    console.log(err);
  }
}

function getPersonIdsOfPersonBoxes(selectedPersonBoxes) {
  let personIds = [];
  for (const personBox of selectedPersonBoxes) {
    personIds.push(personBox.personNode.personId);
  }
  return personIds;
}

function findPersonIndex(gxPersons, personId) {
  for (let personIndex = 0; personIndex < gxPersons.length; personIndex++) {
    if (gxPersons[personIndex].id === personId) {
      return personIndex;
    }
  }
  return -1;
}

let shouldCollapse = true;
let shouldShowAllNames = true;

function allSelectedPersonsHaveDetails(relChart) {
  for (let personBox of relChart.selectedPersonBoxes) {
    if (!relChart.detailedPersonIds.has(personBox.personNode.personId)) {
      return false;
    }
  }
  return true;
}

function handleGraphKeydown(e) {
  let relChart = currentRelChart;
  if ($(document.activeElement).is(":input,[contenteditable]") || !relChart) {
    // ignore keydown events in input boxes or contenteditable sections. Those already handle cmd/ctrl-Z for undo/redo on their own.
    return;
  }
  let key = e.key.toUpperCase();
  if (!relChart.ignoreUndo && (e.ctrlKey || e.metaKey)) {
    // Handle ctrl/cmd keydown
    if ((key === 'Z' && e.shiftKey) || key === 'Y') {
      // Ctrl/Cmd-shift Z or Cmd-Y => Redo
      redoGraph(relChart);
      e.stopPropagation();
    }
    else if (key === 'Z') { // lower-case z, no shift
      // Ctrl/Cmd-Z => Undo
      undoGraph(relChart);
      e.stopPropagation();
    }
  }
  else {
    switch (key) {
      case 'L':
        shouldCollapse = !shouldCollapse;
        updateRecord(relChart.getGedcomX());
        e.stopPropagation();
        break;
      case 'N':
        shouldShowAllNames = !shouldShowAllNames;
        updateRecord(relChart.getGedcomX());
        e.stopPropagation();
        break;
      case 'R':
        if (e.shiftKey) {
          let currentGx = relChart.getGedcomX();
          removeRedundantRelationships(currentGx);
        }
        else {
          if (typeof masterGx != 'undefined') {
            refreshMasterGx(relChart);
          }
        }
        e.stopPropagation();
        break;
      case 'I':
        relChart.shouldDisplayIds = !relChart.shouldDisplayIds;
        updateRecord(relChart.getGedcomX());
        e.stopPropagation();
        break;
      case 'D':
        if (relChart.selectedPersonBoxes.length > 0) {
          if (e.shiftKey || allSelectedPersonsHaveDetails(relChart)) {
            for (let personBox of relChart.selectedPersonBoxes) {
              relChart.detailedPersonIds.delete(personBox.personNode.personId);
            }
          }
          else {
            for (let personBox of relChart.selectedPersonBoxes) {
              relChart.detailedPersonIds.add(personBox.personNode.personId);
            }
          }
        }
        else {
          relChart.shouldDisplayDetails = !relChart.shouldDisplayDetails;
        }
        updateRecord(relChart.getGedcomX());
        e.stopPropagation();
        break;
      case 'P':
      case 'S':
      case 'C':
      case 'M':
        if (typeof toggleRelatives != 'undefined') {
          toggleRelatives(key, e.shiftKey, getPersonIdsOfPersonBoxes(relChart.selectedPersonBoxes));
          e.stopPropagation();
        }
        break;
      case '1':
        if (typeof masterGx != 'undefined' && masterGx && masterGx.persons && masterGx.persons.length > 1 &&
            relChart.selectedPersonBoxes && relChart.selectedPersonBoxes.length === 1) {
          let selectedPersonIndex = findPersonIndex(masterGx.persons, relChart.selectedPersonBoxes[0].personNode.personId);
          if (selectedPersonIndex > 0) {
            masterGx.persons[0].principal = false;
            let temp = masterGx.persons[selectedPersonIndex];
            masterGx.persons[selectedPersonIndex] = masterGx.persons[0];
            masterGx.persons[0] = temp;
            masterGx.persons[0].principal = true;
          }
          updateRecord(masterGx);
          e.stopPropagation();
        }
        break;
      case 'ESCAPE':
        relChart.clearSelectedPerson();
        e.stopPropagation();
        break;
    }
  }

}

/*
Todo:
- Have line out to that FamilyLine center on the marriage fact for that couple, if any?
- Optimize horizontal arrangement of FamilyLines to minimize line-crossings.
- Able to enter URL to load from there.
- Edit everything:
  - Use change history to support undo/redo.
  - Edit person
    - Add, edit, delete name and parts [eventually orig/interp fields]
    - Add, edit, delete fact [eventually, orig/interp fields]
      - Keyboard shortcuts:
        - b/c/d/g/r/m => add fact of type birth, christening, death, burial ("grave"), residence, marriage
        - cursor in date field. Tab to place field.
    - Cycle gender
    - Toggle principal
    - Add, delete person.
  - Edit relationship:
    - Add, edit, delete parent-child relationship persons
      - Click vertical line to select couple relationship with "x" at each spouse
        or "+" at no-spouse end.
        - Drag "x" or "+" to person to connect.
        - Click "x" or "+" to disconnect or create new person.
      - Click person to select, and "x"
    - Edit relationship facts (maybe within person?)
  - Reorder persons
    - Reorder in global list
    - Reorder children in family
    - Reorder spouses for person
- Sort person events (and their relationship events) chronologically, then by type, then by original order?
 */
