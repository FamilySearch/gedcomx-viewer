/*
 Parses an NBX file like:

 <NBX>
    <PDI>R</PDI>
    <DAT><TIMEX TYPE="DATE">May 19, 1990</TIMEX></DAT>
    <PAP><ENAMEX TYPE="ORGANIZATION.pub">Daily Press</ENAMEX> (<ENAMEX TYPE="LOCALE">Newport News</ENAMEX>, <ENAMEX TYPE="LOCALE">VA</ENAMEX>)</PAP>
    <UNQ>0FA95F4632F7CFCB</UNQ>
    <UNQ>100670773_01136_TXT</UNQ>
    <ROY><ENAMEX TYPE="ORGANIZATION.pub">Daily Press</ENAMEX> (<ENAMEX TYPE="LOCALE">Newport News</ENAMEX>, <ENAMEX TYPE="LOCALE">VA</ENAMEX>)</ROY>
    <DSI>0F289719CAB5DC54</DSI>
    <IBD>2448031</IBD><PUNQ>0FA95F462FFC950B</PUNQ><DTI><TIMEX TYPE="DATE">2005-02-04</TIMEX><TIMEX TYPE="TIME">T11:48:33-05:00</TIMEX></DTI><PBI>0C9C3220E8D8C080</PBI>
    <YMD><TIMEX TYPE="DATE">1990-05-19</TIMEX></YMD>
    <COP>Copyright (c) <TIMEX TYPE="DATE">1990</TIMEX>, <ENAMEX TYPE="ORGANIZATION.pub">Daily Press Inc.</ENAMEX> All rights reserved.</COP>
    <EPP>2</EPP>
    <WCT>528</WCT>
    <EID>0EB4E636926BE1F3</EID>
    <SQN>9005190081</SQN>
    <PARNT>TRUE</PARNT>
    <CTCD><ENAMEX TYPE="LOCALE">VA</ENAMEX></CTCD>
    <CTNM><ENAMEX TYPE="LOCALE">Virginia</ENAMEX></CTNM>
    <CTNM>Middle <ENAMEX TYPE="LOCALE.notgpe">Atlantic</ENAMEX></CTNM>
    <CTID>0F422B811C5F6D72</CTID>
    <CTID>0F7B82AEA0FE5817</CTID>
    <HED><ENAMEX TYPE="EVENT.xlife">FUNERALS</ENAMEX></HED>
    <EDT>Final</EDT>
    <SEC>Obituaries</SEC>
    <PAG>C2</PAG>
    <SIZE>907</SIZE><SART><br/>
    <SWCT>21</SWCT>
    <SUNQ>0FA95F4632F7CFCB</SUNQ><p/>
    <DECE><ENAMEX TYPE="PERSON">HEAD</ENAMEX></DECE><p/>
    <SBODY><ENAMEX TYPE="PERSON">HEAD, Forrest D. Sr.</ENAMEX>: <ENAMEX TYPE="EVENT.xlife">memorial service</ENAMEX> at <TIMEX TYPE="TIME">3 p.m.</TIMEX> in <ENAMEX TYPE="STRUCTURE">H.D. Oliver Funeral Apartments</ENAMEX>, <ENAMEX TYPE="STRUCTURE">Laskin Road Chapel</ENAMEX>, <ENAMEX TYPE="LOCALE">Virginia Beach</ENAMEX>.</SBODY><p/>
    </SART>
</NBX>
<RELEX TYPE="E1:HAS_ST_PL"_STID="843"_ENDID="873"_STTOKEN="memorial service"_ENDTOKEN="H.D. Oliver Funeral Apartments">
<RELEX TYPE="E1:HAS_ST_PL"_STID="843"_ENDID="905"_STTOKEN="memorial service"_ENDTOKEN="Laskin Road Chapel">
<RELEX TYPE="E1:HAS_ST_TM"_STID="843"_ENDID="863"_STTOKEN="memorial service"_ENDTOKEN="3 p.m.">
<RELEX TYPE="R40:IS_SAME_AS"_STID="149"_ENDID="48"_STTOKEN="Daily Press"_ENDTOKEN="Daily Press">
<RELEX TYPE="R40:IS_SAME_AS"_STID="162"_ENDID="61"_STTOKEN="Newport News"_ENDTOKEN="Newport News">
<RELEX TYPE="R40:IS_SAME_AS"_STID="176"_ENDID="536"_STTOKEN="VA"_ENDTOKEN="Virginia">
<RELEX TYPE="R40:IS_SAME_AS"_STID="330"_ENDID="24"_STTOKEN="1990-05-19"_ENDTOKEN="May 19, 1990">
<RELEX TYPE="R40:IS_SAME_AS"_STID="520"_ENDID="536"_STTOKEN="VA"_ENDTOKEN="Virginia">
<RELEX TYPE="R40:IS_SAME_AS"_STID="75"_ENDID="536"_STTOKEN="VA"_ENDTOKEN="Virginia">
<RELEX TYPE="R40:IS_SAME_AS"_STID="821"_ENDID="798"_STTOKEN="HEAD, Forrest D. Sr."_ENDTOKEN="HEAD">
<RELEX TYPE="S=1"_STID="821"_ENDID="821"_STTOKEN="HEAD, Forrest D. Sr."_ENDTOKEN="HEAD, Forrest D. Sr.">
<RELEX TYPE="Z:HAS_EVENT"_STID="821"_ENDID="646"_STTOKEN="HEAD, Forrest D. Sr."_ENDTOKEN="FUNERALS">
<RELEX TYPE="Z:HAS_EVENT"_STID="821"_ENDID="843"_STTOKEN="HEAD, Forrest D. Sr."_ENDTOKEN="memorial service">
<RELEX TYPE="Z:IS_PRINCIPAL"_STID="821"_ENDID="821"_STTOKEN="HEAD, Forrest D. Sr."_ENDTOKEN="HEAD, Forrest D. Sr.">
<RELEX TYPE="Z:SUBPLACE_OF"_STID="149"_ENDID="162"_STTOKEN="Daily Press"_ENDTOKEN="Newport News">
<RELEX TYPE="Z:SUBPLACE_OF"_STID="162"_ENDID="176"_STTOKEN="Newport News"_ENDTOKEN="VA">
<RELEX TYPE="Z:SUBPLACE_OF"_STID="48"_ENDID="61"_STTOKEN="Daily Press"_ENDTOKEN="Newport News">
<RELEX TYPE="Z:SUBPLACE_OF"_STID="61"_ENDID="75"_STTOKEN="Newport News"_ENDTOKEN="VA">
<RELEX TYPE="Z:SUBPLACE_OF"_STID="873"_ENDID="905"_STTOKEN="H.D. Oliver Funeral Apartments"_ENDTOKEN="Laskin Road Chapel">
<RELEX TYPE="Z:SUBPLACE_OF"_STID="905"_ENDID="873"_STTOKEN="Laskin Road Chapel"_ENDTOKEN="H.D. Oliver Funeral Apartments">
<RELEX TYPE="Z:SUBPLACE_OF"_STID="905"_ENDID="925"_STTOKEN="Laskin Road Chapel"_ENDTOKEN="Virginia Beach">

 into a Javascript object of the form:

 metadata :
   array of objects with
     tag : tag
     content: array of text-object
 sbody :
   array of text-object
 relex :
   array of relations of the form
     type :  <text>
     start : <startToken>
     end : <endToken>

 where a text-object has :
   text : <text to display>
   offset : <offset in original NBX w/o ENAMX>
   timex/enamex :
     tag: <timex/enamex...>
     type : <typeOfEntity>
     text : <text of entity>
 */

function parseNbx(file) {
  var nbx = {};
  var pos = 0; // position in file[]
  var offset = 0; // 'offset' to use in IDs. Doesn't count sub-tags (ENAMEX, etc.), and only counts cr-lf as 1.
  var len = file.length;
  var stack = [];
  nbx.metadata = [];
  nbx.sbody = [];
  nbx.relex = [];
  var c;
  var tag;
  var content;
  var relexRegex = /RELEX TYPE="([^"]*)"_STID="([0-9]*)"_ENDID="([0-9]*)"_STTOKEN="([^"]*)"_ENDTOKEN="([^"]*)">/g;
  var entityRegex = /<([^ ]*) TYPE="([^"]*)">([^<]*)<([^>]*)>/g;
  var regexResults;
  var end;

  // Read from file[pos] up until the given closing tag is found.
  function parseUntil(tag) {
    var content = [];
    var endTag = "</" + tag + ">";
    var end = file.indexOf(endTag, pos);
    var next;

    while (pos < end) {
      next = file.indexOf("<", pos);
      if (next > pos) {
        // There's some text before the next closing tag or entity tag.
        content.push({text: file.slice(pos, next), offset: offset});
        offset += next - pos;
        pos = next;
      }
      if (next < end) {
        // There's an entity tag, so parse that, but DON'T increment "offset".
        // <ENAMEX TYPE="LOCALE.notgpe">Atlantic</ENAMEX>
        entityRegex.lastIndex = pos;
        regexResults = entityRegex.exec(file);
        content.push({tag: regexResults[1], type: regexResults[2], text: regexResults[3], offset: offset});
        offset += regexResults[3].length;
        if (regexResults[4] !== ("/" + regexResults[1])) {
          console.log("Error: couldn't parse entity from " + file.slice(pos, file.indexOf("\n", pos)));
        }
        pos = entityRegex.lastIndex;
      }
    }
    offset += endTag.length;
    pos += endTag.length;
    return content;
  }

  while (pos < len) {
    c = file[pos++];
    if (c === '<') {
      if (file.startsWith("RELEX ", pos)) {
        relexRegex.lastIndex = pos;
        regexResults = relexRegex.exec(file);
        nbx.relex.push({type: regexResults[1], startOffset: regexResults[2], endOffset: regexResults[3], startToken: regexResults[4], endToken: regexResults[5]});
        pos = relexRegex.lastIndex;
      }
      else {
        end = file.indexOf('>', pos);
        var spacePos = file.indexOf(' ', pos);
        if (spacePos >= 0 && spacePos < end) {
          // Unexpected attribute...???
          console.log("Error: Found unexpected attribute for tag: " + file.slice(pos));
        }
        tag = file.slice(pos, end);
        offset += 2 + tag.length; // < + TAG + >
        pos = end + 1;
        // Skip <p/>, <br/>, <NBX>, <SART>, </NBX>, </SART>
        if (tag !== 'p/' && tag !== 'br/' && tag !== 'NBX' && tag !== 'SART' && tag[0] !== '/') {
          content = parseUntil(tag);
          if (tag === "SBODY") {
            nbx.sbody = content;
          }
          else {
            nbx.metadata.push({ tag: tag, content: content});
          }
        }
      }
    }
    else if (c === '\n') {
      offset++; // ignore newlines
    }
  }

  return nbx;
}

function getSample() {
  return '<NBX>\n' +
      '<PDI>R</PDI>\n' +
      '<DAT><TIMEX TYPE="DATE">May 19, 1990</TIMEX></DAT>\n' +
      '<PAP><ENAMEX TYPE="ORGANIZATION.pub">Daily Press</ENAMEX> (<ENAMEX TYPE="LOCALE">Newport News</ENAMEX>, <ENAMEX TYPE="LOCALE">VA</ENAMEX>)</PAP>\n' +
      '<UNQ>0FA95F4632F7CFCB</UNQ>\n' +
      '<UNQ>100670773_01136_TXT</UNQ>\n' +
      '<ROY><ENAMEX TYPE="ORGANIZATION.pub">Daily Press</ENAMEX> (<ENAMEX TYPE="LOCALE">Newport News</ENAMEX>, <ENAMEX TYPE="LOCALE">VA</ENAMEX>)</ROY>\n' +
      '<DSI>0F289719CAB5DC54</DSI>\n' +
      '<IBD>2448031</IBD><PUNQ>0FA95F462FFC950B</PUNQ><DTI><TIMEX TYPE="DATE">2005-02-04</TIMEX><TIMEX TYPE="TIME">T11:48:33-05:00</TIMEX></DTI><PBI>0C9C3220E8D8C080</PBI>\n' +
      '<YMD><TIMEX TYPE="DATE">1990-05-19</TIMEX></YMD>\n' +
      '<COP>Copyright (c) <TIMEX TYPE="DATE">1990</TIMEX>, <ENAMEX TYPE="ORGANIZATION.pub">Daily Press Inc.</ENAMEX> All rights reserved.</COP>\n' +
      '<EPP>2</EPP>\n' +
      '<WCT>528</WCT>\n' +
      '<EID>0EB4E636926BE1F3</EID>\n' +
      '<SQN>9005190081</SQN>\n' +
      '<PARNT>TRUE</PARNT>\n' +
      '<CTCD><ENAMEX TYPE="LOCALE">VA</ENAMEX></CTCD>\n' +
      '<CTNM><ENAMEX TYPE="LOCALE">Virginia</ENAMEX></CTNM>\n' +
      '<CTNM>Middle <ENAMEX TYPE="LOCALE.notgpe">Atlantic</ENAMEX></CTNM>\n' +
      '<CTID>0F422B811C5F6D72</CTID>\n' +
      '<CTID>0F7B82AEA0FE5817</CTID>\n' +
      '<HED><ENAMEX TYPE="EVENT.xlife">FUNERALS</ENAMEX></HED>\n' +
      '<EDT>Final</EDT>\n' +
      '<SEC>Obituaries</SEC>\n' +
      '<PAG>C2</PAG>\n' +
      '\n' +
      '<SIZE>907</SIZE><SART><br/>\n' +
      '<SWCT>21</SWCT><SUNQ>0FA95F4632F7CFCB</SUNQ><p/>\n' +
      '<DECE><ENAMEX TYPE="PERSON">HEAD</ENAMEX></DECE><p/>\n' +
      '<SBODY><ENAMEX TYPE="PERSON">HEAD, Forrest D. Sr.</ENAMEX>: <ENAMEX TYPE="EVENT.xlife">memorial service</ENAMEX> at <TIMEX TYPE="TIME">3 p.m.</TIMEX> in <ENAMEX TYPE="STRUCTURE">H.D. Oliver Funeral Apartments</ENAMEX>, <ENAMEX TYPE="STRUCTURE">Laskin Road Chapel</ENAMEX>, <ENAMEX TYPE="LOCALE">Virginia Beach</ENAMEX>.</SBODY><p/>\n' +
      '</SART></NBX>\n' +
      '<RELEX TYPE="E1:HAS_ST_PL"_STID="843"_ENDID="873"_STTOKEN="memorial service"_ENDTOKEN="H.D. Oliver Funeral Apartments">\n' +
      '<RELEX TYPE="E1:HAS_ST_PL"_STID="843"_ENDID="905"_STTOKEN="memorial service"_ENDTOKEN="Laskin Road Chapel">\n' +
      '<RELEX TYPE="E1:HAS_ST_TM"_STID="843"_ENDID="863"_STTOKEN="memorial service"_ENDTOKEN="3 p.m.">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="149"_ENDID="48"_STTOKEN="Daily Press"_ENDTOKEN="Daily Press">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="162"_ENDID="61"_STTOKEN="Newport News"_ENDTOKEN="Newport News">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="176"_ENDID="536"_STTOKEN="VA"_ENDTOKEN="Virginia">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="330"_ENDID="24"_STTOKEN="1990-05-19"_ENDTOKEN="May 19, 1990">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="520"_ENDID="536"_STTOKEN="VA"_ENDTOKEN="Virginia">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="75"_ENDID="536"_STTOKEN="VA"_ENDTOKEN="Virginia">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="821"_ENDID="798"_STTOKEN="HEAD, Forrest D. Sr."_ENDTOKEN="HEAD">\n' +
      '<RELEX TYPE="S=1"_STID="821"_ENDID="821"_STTOKEN="HEAD, Forrest D. Sr."_ENDTOKEN="HEAD, Forrest D. Sr.">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="821"_ENDID="646"_STTOKEN="HEAD, Forrest D. Sr."_ENDTOKEN="FUNERALS">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="821"_ENDID="843"_STTOKEN="HEAD, Forrest D. Sr."_ENDTOKEN="memorial service">\n' +
      '<RELEX TYPE="Z:IS_PRINCIPAL"_STID="821"_ENDID="821"_STTOKEN="HEAD, Forrest D. Sr."_ENDTOKEN="HEAD, Forrest D. Sr.">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="149"_ENDID="162"_STTOKEN="Daily Press"_ENDTOKEN="Newport News">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="162"_ENDID="176"_STTOKEN="Newport News"_ENDTOKEN="VA">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="48"_ENDID="61"_STTOKEN="Daily Press"_ENDTOKEN="Newport News">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="61"_ENDID="75"_STTOKEN="Newport News"_ENDTOKEN="VA">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="873"_ENDID="905"_STTOKEN="H.D. Oliver Funeral Apartments"_ENDTOKEN="Laskin Road Chapel">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="905"_ENDID="873"_STTOKEN="Laskin Road Chapel"_ENDTOKEN="H.D. Oliver Funeral Apartments">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="905"_ENDID="925"_STTOKEN="Laskin Road Chapel"_ENDTOKEN="Virginia Beach">\n';
}