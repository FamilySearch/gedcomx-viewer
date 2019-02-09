/*
  RelationshipChart: Represents a graphical display of a relationship graph, including PersonBox and FamilyLine objects and their positions.
 */

function RelationshipChart(graph, $personsDiv) {
  //todo: recursively add person boxes, and set their positions. Then add family lines.
  // For now, just make sure we can still draw on the screen.
  this.personBoxes = [];

  var p;
  var personBox;
  var $personDiv;
  var x = 0, y = 0;
  for (p = 0; p < graph.personNodes.length; p++) {
    personBox = this.personBoxes[p] = new PersonBox(graph.personNodes[p], $personsDiv);
    personBox.$personDiv.animate({"top": y, "left": x}, 1000);
    y += personBox.height + 10;
    x += 30;
  }
}