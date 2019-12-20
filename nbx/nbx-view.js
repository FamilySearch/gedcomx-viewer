function getId(offset) {
  return "f" + offset;
}

/**
 * Accept an array of text-objects, where each text-object has:
 *    text : <text to display>
 *    offset : <offset in original NBX w/o ENAMX>
 *    [tag] : <timex/enamex..., if the text was surrounded by a tag>
 *    [type] : <typeOfEntity, if there was a TYPE attribute>
 * @param content - Array of text-object
 * @param relexMap - Map of offset to array of relex objects (type, startOffset, endOffset, startToken, endToken)
 * @returns html for the list of text-objects.
 */
function textObjectArrayHtml(content, relexMap) {
  var html = "";
  var isList = content.length > 1;
  if (isList) {
    html += "<ul>";
  }
  var i;
  var textObject;
  var relations, relation, r;
  var odd;

  for (i = 0; i < content.length; i++) {
    textObject = content[i];
    if (isList) {
      html += "<li>";
    }
    var text = textObject.text.replace(/ *[\n] */g, " ");
    if (textObject.tag === undefined) {
      html += "<span class='text'>" + encode(text) + "</span>";
    }
    else {
      // Tagged element => entity with an offset as its id.
      html += "<table>";
      relations = relexMap[textObject.offset];
      if (relations !== undefined) {
        for (r = 0; r < relations.length; r++) {
          relation = relations[r];
          odd = r % 2 === 0 ? "even" : "odd";
          html += "<tr class='RELEX-" + odd + "'><td>" + encode(relation.type) + "</td></tr>";
          if (relation.endOffset !== relation.startOffset) {
            html += "<tr><td class='ref-" + odd + " ref-" + getId(relation.endOffset) + "'>" + encode(relation.endToken) + "</td></tr>";
          }
        }
      }

      html +="<tr><td class='" + textObject.tag + "'>" + encode(textObject.type) + "</td></tr>" +
             "<tr><td class='ref-" + getId(textObject.offset) + " text' id='" + getId(textObject.offset) + "'>" + encode(text) + "</td></tr>" +
           "</table>";
    }
    if (isList) {
      html += "</li>";
    }
  }
  if (isList) {
    html += "</ul>";
  }
  return html;
}

/**
 Converts an NBX object (parsed via parseNbx in nbx-parse.js) to an HTML representation.
 The NBX object is of the form:

   metadata :
    array of objects with
      tag : tag
      content: array of text-object
   sbody :
      array of text-object
   relex :
    array of relations of the form
      type :  <text>
      startOffset : <startToken>
      endOffset : <endToken>
      startToken : <text of token at startOffset>
      endToken : <text of token at endOffset>

   where a text-object has :
    text : <text to display>
    offset : <offset in original NBX w/o ENAMX>
    tag: <timex/enamex..., if the text was surrounded by a tag>
    type : <typeOfEntity, if there was a TYPE attribute>

   Takes an array of text-object and displays them as text with entity tags above, and relation(s) above that.
 */
function gxToHtml(nbx) {
  // Take a list of relex objects with a 'startOffset' field, and create a map of startOffset -> array of relex objects with that start offset.
  // Format of relex object is type, startOffset, endOffset, startToken, endToken.
  function makeRelexMap(relex) {
    var map = {};
    var i;
    var list;
    var offset;
    for (i = 0; i < relex.length; i++) {
      offset = relex[i].startOffset;
      list = map[offset];
      if (list === undefined) {
        list = [];
        map[offset] = list;
      }
      list.push(relex[i]);
    }
    return map;
  }

  var relexMap = makeRelexMap(nbx.relex);

  var html = "  <div id='metadata'><h4>Metadata</h4>\n" +
      "  <table class='metadata'>\n" +
      "    <tr><th>Label</th><th>Value</th></tr>\n";

  // Add metadata table rows
  var len = nbx.metadata.length;
  var i;
  var meta;
  for (i = 0; i < len; i++) {
    meta = nbx.metadata[i];
    // Add the tag
    html += "    <tr class='meta'><td class='label'>" + encode(meta.tag) + "</td><td class='value'>";
    html += textObjectArrayHtml(meta.content, relexMap);
    html += "</td></tr>\n";
  }
  html += "  </table>\n  </div>\n\n";

  html += "  <div id='sbody'><h4>  Source Body</h4>\n\n  <div class='sbody'>";
  html += textObjectArrayHtml(nbx.sbody, relexMap);
  html += "  </div>\n  </div>\n";

  var alreadyUsed = [];
  var id;
  html += "<script>\n";
  for (i = 0; i < nbx.relex.length; i++) {
    id = getId(nbx.relex[i].endOffset);
    if (alreadyUsed[id] === undefined) {
      alreadyUsed[id] = true;
      html += '$(".ref-' + id + '").hover(function(){\n' +
          // '        $("#' + id + '").toggleClass("highlight");\n' +
          '        $(".ref-' + id + '").toggleClass("highlight");\n' +
          '      });\n';
    }
  }
  html += "</script>\n";
  return html;
}