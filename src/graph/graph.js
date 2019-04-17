var GX_COUPLE = "http://gedcomx.org/Couple";
var GX_PARENT_CHILD = "http://gedcomx.org/ParentChild";

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
 *
 * @param gx - GedcomX document to visualize
 * @param prevChart - Previous RelationshipChart object to use to get initial positions for corresponding PersonBox and FamilyLine elements.
 * @param $relChartDiv - JQuery object for the div with id="rel-chart". If null, will look it up.
 * @returns {RelationshipChart}
 */
function buildGraph(gx, prevChart, $relChartDiv) {
  try {
    var graph = new RelationshipGraph(gx);
    if (!$relChartDiv) {
      $relChartDiv = $("#rel-chart");
    }
    return new RelChartBuilder(graph, $relChartDiv, true, true).buildChart(prevChart);
  }
  catch (err) {
    console.log(err);
  }
}

/*
Todo:
- Add a "dot" (square; triangle) where a PersonLine meets a FamilyLine.
- Have line out to that FamilyLine center on the marriage fact for that couple, if any?
- Optimize horizontal arrangement of FamilyLines toi minimize line-crossings.
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