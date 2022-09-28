const GX_COUPLE = "http://gedcomx.org/Couple";
const GX_PARENT_CHILD = "http://gedcomx.org/ParentChild";

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

// Array of previous copies of the GedcomX before a set of changes was made.
// [0] is the original GedcomX. Each time the graph is built, a copy of the latest GedcomX is added to the array (if isEditable is true).
let gedcomxChangeHistory = [];
// Position in gedcomxChangeHistory. Normally gedcomxChangePosition = gedcomxChangeHistory.length.
// But if 'undo' has been done, it can be earlier. If 'redo' is done before any further changes, then it advances again.
// If a change is made when this position is not at the end, then all following elements are removed.
let gedcomxChangePosition = 0;
let currentRelChart;

function undoGraph() {
  if (gedcomxChangePosition > 1) {
    let gx = gedcomxChangeHistory[--gedcomxChangePosition - 1];
    buildGraph(gx, prevRelChartOptions(currentRelChart));
  }
}

function redoGraph() {
  if (gedcomxChangePosition < gedcomxChangeHistory.length) {
    let gx = gedcomxChangeHistory[gedcomxChangePosition++];
    buildGraph(gx, prevRelChartOptions(currentRelChart));
  }
}

function updateGraphUndo(gx) {
  gedcomxChangeHistory[gedcomxChangePosition++] = JSON.parse(JSON.stringify(gx));
  if (gedcomxChangePosition < gedcomxChangeHistory.length) {
    // Did a change after doing multiple "undos". So ignore the rest of the change history.
    gedcomxChangeHistory.length = gedcomxChangePosition;
  }
}

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
function buildGraph(gx, isEditable, prevChart, ignoreUndo, imgOverlayToGx, isDraggable) {
  return buildRelGraph(gx, prevChart ? prevRelChartOptions(prevChart): new ChartOptions({
    isEditable: isEditable,
    prevChart: prevChart,
    ignoreUndo: ignoreUndo,
    imgOverlayToGx: imgOverlayToGx,
    isDraggable: isDraggable
  }));
}

/**
 * Create a RelationshipGraph, construct from that a RelationshipChart, and return it.
 * @param gx - GedcomX document to visualize
 * @param chartOptions - ChartOptions object
 * @returns {RelationshipChart}
 */
function buildRelGraph(gx, chartOptions) {
  if (!chartOptions.imgOverlayToGx && chartOptions.prevChart) {
    chartOptions.imgOverlayToGx = chartOptions.prevChart.imgOverlayToGx; // in case this is non-null.
  }
  try {
    let graph = new RelationshipGraph(gx, chartOptions.prevChart ? chartOptions.prevChart.chartId : null);
    let $relChartDiv = $("#rel-chart");
    if (chartOptions.isEditable && !chartOptions.ignoreUndo) {
      updateGraphUndo(gx);
    }
    if (!currentRelChart) {
      $(document).keydown(handleGraphKeydown);
    }
    let relChartBuilder = new RelChartBuilder(graph, $relChartDiv, chartOptions);
    currentRelChart = relChartBuilder.buildChart(chartOptions.prevChart, chartOptions.imgOverlayToGx);
    $relChartDiv.width(currentRelChart.width);
    $relChartDiv.height(currentRelChart.height);
    if (chartOptions.isDraggable) {
      $relChartDiv.draggable();
    }
    return currentRelChart;
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

function allSelectedPersonsHaveDetails() {
  for (let personBox of currentRelChart.selectedPersonBoxes) {
    if (!currentRelChart.detailedPersonIds.has(personBox.personNode.personId)) {
      return false;
    }
  }
  return true;
}

function handleGraphKeydown(e) {
  if ($(document.activeElement).is(":input,[contenteditable]") || !currentRelChart) {
    // ignore keydown events in input boxes or contenteditable sections. Those already handle cmd/ctrl-Z for undo/redo on their own.
    return;
  }
  let key = e.key.toUpperCase();

  if (!currentRelChart.ignoreUndo && (e.ctrlKey || e.metaKey)) {
    // Handle ctrl/cmd keydown
    if ((key === 'Z' && e.shiftKey) || key === 'Y') {
      // Ctrl/Cmd-shift Z or Cmd-Y => Redo
      redoGraph();
      e.stopPropagation();
    }
    else if (key === 'Z') { // lower-case z, no shift
      // Ctrl/Cmd-Z => Undo
      undoGraph();
      e.stopPropagation();
    }
  }
  else {
    switch (key) {
      case 'L':
        shouldCollapse = !shouldCollapse;
        updateRecord(currentRelChart.getGedcomX());
        e.stopPropagation();
        break;
      case 'R':
        if (e.shiftKey) {
          let currentGx = currentRelChart.getGedcomX();
          removeRedundantRelationships(currentGx);
        }
        else {
          if (typeof masterGx != 'undefined') {
            refreshMasterGx();
          }
        }
        e.stopPropagation();
        break;
      case 'I':
        currentRelChart.shouldDisplayIds = !currentRelChart.shouldDisplayIds;
        updateRecord(currentRelChart.getGedcomX());
        e.stopPropagation();
        break;
      case 'D':
        if (currentRelChart.selectedPersonBoxes.length > 0) {
          if (e.shiftKey || allSelectedPersonsHaveDetails()) {
            for (let personBox of currentRelChart.selectedPersonBoxes) {
              currentRelChart.detailedPersonIds.delete(personBox.personNode.personId);
            }
          }
          else {
            for (let personBox of currentRelChart.selectedPersonBoxes) {
              currentRelChart.detailedPersonIds.add(personBox.personNode.personId);
            }
          }
        }
        else {
          currentRelChart.shouldDisplayDetails = !currentRelChart.shouldDisplayDetails;
        }
        updateRecord(currentRelChart.getGedcomX());
        e.stopPropagation();
        break;
      case 'P':
      case 'S':
      case 'C':
      case 'B':
      case 'M':
        if (typeof toggleRelatives != 'undefined') {
          toggleRelatives(key, e.shiftKey, getPersonIdsOfPersonBoxes(currentRelChart.selectedPersonBoxes));
          e.stopPropagation();
        }
        break;
      case '1':
        if (typeof masterGx != 'undefined' && masterGx && masterGx.persons && masterGx.persons.length > 1 &&
            currentRelChart.selectedPersonBoxes && currentRelChart.selectedPersonBoxes.length === 1) {
          let selectedPersonIndex = findPersonIndex(masterGx.persons, currentRelChart.selectedPersonBoxes[0].personNode.personId);
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
        currentRelChart.clearSelectedPerson();
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
