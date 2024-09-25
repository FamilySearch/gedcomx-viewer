class Result {
  constructor(line) {
    const [name, fscore, precision, recall, correct, inserts, deletes, weightedCorrect, weightedInserts, weightedDeletes, insertPlusDeletesWeight] = line.split("\t");
    this.name = name; // 007_LV_2022_G02485_387
    this.index = name.replace(/_.*/, ""); // 3-digit number, like "007"
    this.fscore = fscore;
    this.precision = precision;
    this.recall = recall;
    this.correct = correct;
    this.inserts = inserts;
    this.deletes = deletes;
    this.weightedCorrect = weightedCorrect;
    this.weightedInserts = weightedInserts;
    this.weightedDeletes = weightedDeletes;
    this.insertPlusDeletesWeight = insertPlusDeletesWeight;
  }

  compare(other) {
    let diff = other.fscore - this.fscore;
    if (diff < 0) {
      return -1;
    }
    if (diff > 0) {
      return 1;
    }
    return other.index - this.index;
  }
}

function buildComparison(comparisonDivId, dataDir) {
  $.get(dataDir + "/fscores.txt", function(data) {
    const lines = data.split("\n");
    const results = lines.slice(1).map(line => new Result(line));
    results.sort((a, b) => b.compare(a));
    // const sample = results.slice(0, 10);
    continueBuildingComparison(comparisonDivId, dataDir, results);
  }, 'text');
}

function continueBuildingComparison(comparisonDivId, dataDir, results) {
  const $comparisonDiv = $("#" + comparisonDivId);
  let index = 1;
  for (let result of results) {
    $comparisonDiv.append(
      "<h2>" + index + ") " + result.name + "</h2>" +
      "<table class='stats'>" +
      "  <tr><th>FScore</th><th>Precision</th><th>Recall</th><th>Correct</th><th>Inserts</th><th>Deletes</th><th>Weighted Correct</th><th>Weighted Inserts</th><th>Weighted Deletes</th><th>Insert&amp;Deletes Weight</th></tr>" +
      "  <tr><td><b>" + result.fscore + "</b></td><td>" + result.precision + "</td><td>" + result.recall + "</td><td>" + result.correct + "</td><td>" + result.inserts + "</td><td>" + result.deletes + "</td><td>" + result.weightedCorrect + "</td><td>" + result.weightedInserts + "</td><td>" + result.weightedDeletes + "</td><td>" + result.insertPlusDeletesWeight + "</td></tr>" +
      "</table>");
    $comparisonDiv.append(
      "<table class='rel-graphs'>" +
      "  <tr><th>NBX</th><th>Truth</th><th>Output</th></tr>" +
      "  <tr>" +
      "    <td><div id='nbx-" + result.index + "'></div></td>" +
      "    <td><div id='truth-" + result.index + "'></div></td>" +
      "    <td><div id='output-" + result.index + "'></div></td>" +
      "  </tr>" +
      "</table>");
    addNbx(dataDir + "/nbx/" + result.name + ".nbx", "nbx-" + result.index);
    addRelGraph(dataDir + "/truth/" + result.name + ".json", "truth-" + result.index);
    addRelGraph(dataDir + "/output/" + result.name + ".json", "output-" + result.index);
    index++;
  }
}

function addNbx(nbxFile, divId) {
  $.get(nbxFile, function(nbx) {
    console.log("Updating NBX for " + divId);
    const $nbxDiv = $("#" + divId);
    let nbxHtml = formatNbx(nbx);
    $nbxDiv.html(nbxHtml);
    console.log("    => Finished updating NBX for " + divId);
  }, 'text').fail(function(jqXHR, textStatus, errorThrown) {
    console.error("Failed to load NBX file:", textStatus, errorThrown)
  });
}

function addRelGraph(jsonFile, relGraphDivId) {
  console.log("Fetching file " + jsonFile + " for " + relGraphDivId);
  $.get(jsonFile, function(data) {
    console.log("  Adding relGraph for " + relGraphDivId);
    const recordOrRecordSet = JSON.parse(data);
    const gx = recordOrRecordSet.records ? recordOrRecordSet.records[0] : recordOrRecordSet;
    if (gx && gx.persons && gx.persons.length > 0) {
      buildRelGraph(gx, new ChartOptions(isDraggable = true), relGraphDivId);
      console.log("    => Finished adding relGraph for " + relGraphDivId);
    }
    else {
      $("#" + relGraphDivId).html("(No record)");
      console.log("    => No records found for " + relGraphDivId);
    }
  }, 'text');
}

function formatNbx(nbx) {
  let html = encode(nbx);
  html = html.replace(/\n/g, "<br>");
  while (html.includes("<br> ")) {
    html = html.replace(/<br> /, "<br>&nbsp;");
  }
  while (html.includes("&nbsp; ")) {
    html = html.replace(/&nbsp; /, "&nbsp;&nbsp;");
  }
  while (html.includes("&amp;amp;")) {
    html = html.replace(/&amp;amp;/, "&amp;");
  }
  return html;
}