function getId(offset) {
  return "nbx-f" + offset;
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
  let html = "";
  let isList = content.length > 1;
  if (isList) {
    html += "<ul>";
  }

  for (let textObject of content) {
    if (isList) {
      html += "<li>";
    }
    if (textObject.tag === undefined) {
      let lines = textObject.text.split("\n");
      for (let line = 0; line < lines.length; line++) {
        if (line > 0) {
          html += isList ? "</ul><ul>" : "<br/>";
        }
        html += "<span class='nbx-text'>" + encode(lines[line]) + "</span>";
      }
    }
    else {
      // Tagged element => entity with an offset as its id.
      html += "<table>";
      let relations = relexMap[textObject.offset];
      if (relations !== undefined) {
        for (let r = 0; r < relations.length; r++) {
          let relation = relations[r];
          let odd = r % 2 === 0 ? "even" : "odd";
          html += "<tr class='nbx-RELEX-" + odd + "'><td>" + encode(relation.type) + "</td></tr>";
          if (relation.endOffset !== relation.startOffset) {
            html += "<tr><td class='nbx-ref-" + odd + " ref-" + getId(relation.endOffset) + "'>" + encode(relation.endToken) + "</td></tr>";
          }
        }
      }

      let text = textObject.text.replace(/ *[\n] */g, " ");
      html +="<tr><td class='nbx-" + textObject.tag + "'>" + encode(textObject.type) + "</td></tr>" +
             "<tr><td class='ref-" + getId(textObject.offset) + " nbx-text' id='" + getId(textObject.offset) + "'>" + encode(text) + "</td></tr>" +
           "</table>";
      if (textObject.text.includes("\n")) {
        html += isList ? "</ul><ul>" : "<br/>";
      }
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
function nbxToHtml(nbx) {
  // Take a list of relex objects with a 'startOffset' field, and create a map of startOffset -> array of relex objects with that start offset.
  // Format of relex object is type, startOffset, endOffset, startToken, endToken.
  function makeRelexMap(relex) {
    let map = {};
    for (let rel of relex) {
      let offset = rel.startOffset;
      let list = map[offset];
      if (list === undefined) {
        list = [];
        map[offset] = list;
      }
      list.push(rel);
    }
    return map;
  }

  let relexMap = makeRelexMap(nbx.relex);

  let html = "  <div id='nbx-metadata'><h4>Metadata</h4>\n" +
      "  <table class='nbx-metadata'>\n" +
      "    <tr><th>Label</th><th>Value</th></tr>\n";

  // Add metadata table rows
  let len = nbx.metadata.length;
  for (let i = 0; i < len; i++) {
    let meta = nbx.metadata[i];
    // Add the tag
    html += "    <tr class='nbx-meta'><td class='nbx-label'>" + encode(meta.tag) + "</td><td class='nbx-value'>";
    html += textObjectArrayHtml(meta.content, relexMap);
    html += "</td></tr>\n";
  }
  html += "  </table>\n  </div>\n\n";

  html += "  <div id='nbx-sbody'><h4>  Source Body</h4>\n\n  <div class='nbx-sbody'>";
  html += textObjectArrayHtml(nbx.sbody, relexMap);
  html += "  </div>\n  </div>\n";

  let alreadyUsed = [];
  html += "<script>\n";
  for (let rel of nbx.relex) {
    let id = getId(rel.endOffset);
    if (alreadyUsed[id] === undefined) {
      alreadyUsed[id] = true;
      html += '$(".ref-' + id + '").hover(function(){\n' +
          '        $(".ref-' + id + '").toggleClass("nbx-highlight");\n' +
          '      });\n';
    }
  }
  html += "</script>\n";

  html = "<div id='nbx-table'>" + html + "</div>";
  return html;
}
