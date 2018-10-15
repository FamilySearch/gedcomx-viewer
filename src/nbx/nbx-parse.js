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
        if (file.indexOf(' ', pos) < end) {
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
      '<DAT><TIMEX TYPE="DATE">November 5, 2000</TIMEX></DAT>\n' +
      '<PAP><ENAMEX TYPE="ORGANIZATION.pub">San Diego Union-Tribune, The</ENAMEX> (<ENAMEX TYPE="LOCALE">CA</ENAMEX>)</PAP>\n' +
      '<UNQ>0FD0DD84166B2F8E</UNQ>\n' +
      '<UNQ>101457148_00842_TXT</UNQ>\n' +
      '<ROY><ENAMEX TYPE="ORGANIZATION.pub">THE SAN DIEGO UNION-TRIBUNE</ENAMEX></ROY>\n' +
      '<DSI>0F2896AF1F011698</DSI>\n' +
      '<IBD>2451854</IBD><PUNQ>0F909DF658C5587C</PUNQ><DTI><TIMEX TYPE="DATE">2004-05-26</TIMEX><TIMEX TYPE="TIME">T18:47:54-05:00</TIMEX></DTI><PBI>0C9C35D44532DE80</PBI>\n' +
      '<YMD><TIMEX TYPE="DATE">2000-11-05</TIMEX></YMD>\n' +
      '<COP>Copyright (c) <TIMEX TYPE="DATE">2000</TIMEX> <ENAMEX TYPE="ORGANIZATION.pub">Union Tribune Publishing Co.</ENAMEX></COP>\n' +
      '<EPP>9</EPP>\n' +
      '<WCT>2834</WCT>\n' +
      '<EID>0EB545516BD4738F</EID>\n' +
      '<SQN>UTS1557133</SQN>\n' +
      '<PARNT>TRUE</PARNT>\n' +
      '<CTCD><ENAMEX TYPE="LOCALE">CA</ENAMEX></CTCD>\n' +
      '<CTNM><ENAMEX TYPE="LOCALE">California</ENAMEX></CTNM>\n' +
      '<CTNM><ENAMEX TYPE="LOCALE.notgpe">Pacific</ENAMEX></CTNM>\n' +
      '<CTID>0F422B80D850C0D9</CTID>\n' +
      '<CTID>0F67264534A799EB</CTID>\n' +
      '<HED>Title: <ENAMEX TYPE="EVENT.rel">DEATH</ENAMEX> AND <ENAMEX TYPE="EVENT.xlife">FUNERAL</ENAMEX> NOTICES</HED>\n' +
      '<TYP>LIST. OBIT.</TYP>\n' +
      '<EDT>1,3</EDT>\n' +
      '<COL><ENAMEX TYPE="EVENT.rel">DEATH</ENAMEX> AND <ENAMEX TYPE="EVENT.xlife">FUNERAL</ENAMEX> NOTICES</COL>\n' +
      '<SEC>LOCAL</SEC>\n' +
      '<PAG>B-9</PAG>\n' +
      '\n' +
      '<SIZE>2374</SIZE><SART><br/>\n' +
      '<SWCT>240</SWCT><SUNQ>0FD0DD84166B2F8E</SUNQ><p/>\n' +
      '<DECE><ENAMEX TYPE="PERSON">DICKEY</ENAMEX></DECE><p/>\n' +
      '<SBODY><ENAMEX TYPE="PERSON">DICKEY, DOLORES JEAN</ENAMEX> <TIMEX TYPE="DATE">June 17, 1934</TIMEX> - <TIMEX TYPE="DATE">November 2, 2000</TIMEX>' +
      ' <ENAMEX TYPE="PERSON">Dolores Jean Dickey</ENAMEX>, <ENAMEX TYPE="AGE">66</ENAMEX>, of <ENAMEX TYPE="LOCALE">El Cajon</ENAMEX>, <ENAMEX TYPE="EVENT.rel">passed on</ENAMEX>' +
      ' <TIMEX TYPE="DATE.non">Thursday</TIMEX> <TIMEX TYPE="TIME">evening</TIMEX>, <TIMEX TYPE="DATE">November 2, 2000</TIMEX>. <ENAMEX TYPE="COREF">She</ENAMEX> was' +
      ' <ENAMEX TYPE="EVENT.rel">born</ENAMEX> and raised in <ENAMEX TYPE="LOCALE">East Liverpool</ENAMEX>, <ENAMEX TYPE="LOCALE">Ohio</ENAMEX>. <ENAMEX TYPE="COREF">She</ENAMEX>' +
      ' has been <ENAMEX TYPE="EVENT.rel">married</ENAMEX> to <ENAMEX TYPE="PERSON">William Allen Dickey</ENAMEX> for <ENAMEX TYPE="DURATANNIV">49 years</ENAMEX>, and' +
      ' <ENAMEX TYPE="COREF">they</ENAMEX> were <ENAMEX TYPE="EVENT.rel">sealed together for time and all eternity</ENAMEX> in the <ENAMEX TYPE="STRUCTURE">San Diego Temple</ENAMEX>' +
      ' of The <ENAMEX TYPE="ORGANIZATION.rel">Church of Jesus Christ of Latter-day Saints</ENAMEX>. Together, in the military, <ENAMEX TYPE="COREF">they</ENAMEX>' +
      ' traveled throughout the world, raising a family of <NUMEX TYPE="QUANTITY">six</NUMEX> <ENAMEX TYPE="FAMILYMEMBER">children</ENAMEX>.  <ENAMEX TYPE="COREF">She</ENAMEX>' +
      ' retired after <ENAMEX TYPE="DURATANNIV">26 years</ENAMEX> from the <ENAMEX TYPE="STRUCTURE">Grossmont Hospital Women&#039;s Center</ENAMEX> in <TIMEX TYPE="DATE">1995</TIMEX>.' +
      ' <ENAMEX TYPE="COREF">She</ENAMEX> was preceded by <ENAMEX TYPE="COREF">her</ENAMEX> <ENAMEX TYPE="FAMILYMEMBER">eldest son</ENAMEX>,' +
      ' <ENAMEX TYPE="PERSON">William Allen Dickey II</ENAMEX> in <TIMEX TYPE="DATE">1983</TIMEX>. <ENAMEX TYPE="COREF">She</ENAMEX> is survived by' +
      ' <ENAMEX TYPE="COREF">her</ENAMEX> <ENAMEX TYPE="FAMILYMEMBER">husband</ENAMEX>, <ENAMEX TYPE="PERSON">William Allen Dickey</ENAMEX>, Ret. <ENAMEX TYPE="OCCUPATION">CWO</ENAMEX>,' +
      ' and <NUMEX TYPE="QUANTITY">six</NUMEX> <ENAMEX TYPE="FAMILYMEMBER">children</ENAMEX>, <ENAMEX TYPE="FAMILYMEMBER">daughter</ENAMEX>' +
      ' <ENAMEX TYPE="PERSON">Coleen O&#039;Farrell</ENAMEX> from <ENAMEX TYPE="LOCALE">Silverspring</ENAMEX>,<ENAMEX TYPE="LOCALE">Maryland</ENAMEX>,' +
      ' <ENAMEX TYPE="FAMILYMEMBER">daughter</ENAMEX> <ENAMEX TYPE="PERSON">Deborah Klay</ENAMEX> from <ENAMEX TYPE="LOCALE">Santee</ENAMEX>,' +
      ' <ENAMEX TYPE="LOCALE">California</ENAMEX>, <ENAMEX TYPE="FAMILYMEMBER">daughter</ENAMEX> <ENAMEX TYPE="PERSON">Adrienne Dickey</ENAMEX>' +
      ' from <ENAMEX TYPE="LOCALE">Centerville</ENAMEX>, <ENAMEX TYPE="LOCALE">Utah</ENAMEX>, <ENAMEX TYPE="FAMILYMEMBER">son</ENAMEX> <ENAMEX TYPE="PERSON">John Dickey</ENAMEX>' +
      ' from <ENAMEX TYPE="LOCALE">Mountain Green</ENAMEX>, <ENAMEX TYPE="LOCALE">Utah</ENAMEX>, and, raised as <ENAMEX TYPE="COREF">her</ENAMEX>' +
      ' <ENAMEX TYPE="FAMILYMEMBER">son</ENAMEX>, <ENAMEX TYPE="PERSON">Jerry Semallie</ENAMEX>, from <ENAMEX TYPE="LOCALE">Cameron</ENAMEX>, <ENAMEX TYPE="LOCALE">Arizona</ENAMEX>.' +
      '  <ENAMEX TYPE="COREF">She</ENAMEX> also has <NUMEX TYPE="QUANTITY">15</NUMEX> <ENAMEX TYPE="FAMILYMEMBER">grandchildren</ENAMEX>. <ENAMEX TYPE="PERSON">Dolores</ENAMEX>' +
      ' was a valiant and righteous <ENAMEX TYPE="FAMILYMEMBER">daughter</ENAMEX> of God. A beloved <ENAMEX TYPE="FAMILYMEMBER">wife</ENAMEX>.' +
      '  A dedicated <ENAMEX TYPE="FAMILYMEMBER">mother</ENAMEX> and inspiring <ENAMEX TYPE="FAMILYMEMBER">grandmother</ENAMEX>.' +
      '  A valued and cherished <ENAMEX TYPE="NONFAMILY">friend</ENAMEX>.  <ENAMEX TYPE="COREF">Her</ENAMEX> life&#039;s mission was unconditionally loving and serving' +
      ' <ENAMEX TYPE="COREF">her</ENAMEX> fellow beings.  <ENAMEX TYPE="COREF">Her</ENAMEX> dedication to God was exemplified by how <ENAMEX TYPE="COREF">she</ENAMEX> lived.' +
      '  <ENAMEX TYPE="COREF">She</ENAMEX> left a legacy of love. <ENAMEX TYPE="EVENT.xlife">Funeral services</ENAMEX> will be held at <TIMEX TYPE="TIME">10 a.m.</TIMEX>' +
      ' <TIMEX TYPE="DATE.non">Wednesday, November 8</TIMEX>, at <ENAMEX TYPE="ORGANIZATION.rel">the Church of Jesus Christ of Latter-day Saints</ENAMEX>,' +
      ' <ENAMEX TYPE="STRUCTURE.addr">8902 Highwood Drive</ENAMEX>, <ENAMEX TYPE="LOCALE">San Diego</ENAMEX>.  <ENAMEX TYPE="EVENT.rel">Interment</ENAMEX>' +
      ' to follow at <ENAMEX TYPE="STRUCTURE">Greenwood Memorial Park</ENAMEX>.</SBODY><p/>\n' +
      '</SART></NBX>\n' +
      '<RELEX TYPE="E1:HAS_STARTDATE"_STID="892"_ENDID="913"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="June 17, 1934">\n' +
      '<RELEX TYPE="E1:HAS_STDATE"_STID="2212"_ENDID="2253"_STTOKEN="Funeral services"_ENDTOKEN="Wednesday, November 8">\n' +
      '<RELEX TYPE="E1:HAS_STDATE"_STID="984"_ENDID="994"_STTOKEN="passed on"_ENDTOKEN="Thursday">\n' +
      '<RELEX TYPE="E1:HAS_ST_PL"_STID="1152"_ENDID="1201"_STTOKEN="sealed together for time and all eternity"_ENDTOKEN="San Diego Temple">\n' +
      '<RELEX TYPE="E1:HAS_ST_PL"_STID="2212"_ENDID="2279"_STTOKEN="Funeral services"_ENDTOKEN="the Church of Jesus Christ of Latter-day Saints">\n' +
      '<RELEX TYPE="E1:HAS_ST_PL"_STID="2361"_ENDID="2384"_STTOKEN="Interment"_ENDTOKEN="Greenwood Memorial Park">\n' +
      '<RELEX TYPE="E1:HAS_ST_TM"_STID="2212"_ENDID="2245"_STTOKEN="Funeral services"_ENDTOKEN="10 a.m.">\n' +
      '<RELEX TYPE="E1:HAS_ST_TM"_STID="984"_ENDID="1003"_STTOKEN="passed on"_ENDTOKEN="evening">\n' +
      '<RELEX TYPE="E2:HAS_RESPL"_STID="1612"_ENDID="1639"_STTOKEN="Coleen O\'Farrell"_ENDTOKEN="Silverspring">\n' +
      '<RELEX TYPE="E2:HAS_RESPL"_STID="1718"_ENDID="1739"_STTOKEN="Adrienne Dickey"_ENDTOKEN="Centerville">\n' +
      '<RELEX TYPE="E2:HAS_RESPL"_STID="1762"_ENDID="1779"_STTOKEN="John Dickey"_ENDTOKEN="Mountain Green">\n' +
      '<RELEX TYPE="E2:HAS_RESPL"_STID="946"_ENDID="974"_STTOKEN="Dolores Jean Dickey"_ENDTOKEN="El Cajon">\n' +
      '<RELEX TYPE="E3:HAS_ENDDATE"_STID="1488"_ENDID="1515"_STTOKEN="William Allen Dickey II"_ENDTOKEN="1983">\n' +
      '<RELEX TYPE="E3:HAS_ENDDATE"_STID="892"_ENDID="929"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="November 2, 2000">\n' +
      '<RELEX TYPE="E3:HAS_ENDDATE"_STID="946"_ENDID="929"_STTOKEN="Dolores Jean Dickey"_ENDTOKEN="November 2, 2000">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1012"_ENDID="929"_STTOKEN="November 2, 2000"_ENDTOKEN="November 2, 2000">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1030"_ENDID="892"_STTOKEN="She"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1079"_ENDID="892"_STTOKEN="She"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1297"_ENDID="1142"_STTOKEN="they"_ENDTOKEN="they">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1368"_ENDID="892"_STTOKEN="She"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1452"_ENDID="892"_STTOKEN="She"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1472"_ENDID="892"_STTOKEN="her"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1521"_ENDID="892"_STTOKEN="She"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1540"_ENDID="1521"_STTOKEN="her"_ENDTOKEN="She">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1540"_ENDID="892"_STTOKEN="her"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="156"_ENDID="52"_STTOKEN="THE SAN DIEGO UNION-TRIBUNE"_ENDTOKEN="San Diego Union-Tribune, The">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1697"_ENDID="531"_STTOKEN="California"_ENDTOKEN="California">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1795"_ENDID="1752"_STTOKEN="Utah"_ENDTOKEN="Utah">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1816"_ENDID="892"_STTOKEN="her"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1865"_ENDID="892"_STTOKEN="She"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="1896"_ENDID="946"_STTOKEN="Dolores"_ENDTOKEN="Dolores Jean Dickey">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="2045"_ENDID="892"_STTOKEN="Her"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="2108"_ENDID="892"_STTOKEN="her"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="2128"_ENDID="892"_STTOKEN="Her"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="2173"_ENDID="892"_STTOKEN="she"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="2185"_ENDID="892"_STTOKEN="She"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="334"_ENDID="24"_STTOKEN="2000-11-05"_ENDTOKEN="November 5, 2000">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="515"_ENDID="531"_STTOKEN="CA"_ENDTOKEN="California">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="82"_ENDID="531"_STTOKEN="CA"_ENDTOKEN="California">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="867"_ENDID="892"_STTOKEN="DICKEY"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="892"_ENDID="867"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="DICKEY">\n' +
      '<RELEX TYPE="R40:IS_SAME_AS"_STID="946"_ENDID="892"_STTOKEN="Dolores Jean Dickey"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="S=1"_STID="892"_ENDID="892"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="S=2+"_STID="1612"_ENDID="1612"_STTOKEN="Coleen O\'Farrell"_ENDTOKEN="Coleen O\'Farrell">\n' +
      '<RELEX TYPE="S=2+"_STID="1671"_ENDID="1671"_STTOKEN="Deborah Klay"_ENDTOKEN="Deborah Klay">\n' +
      '<RELEX TYPE="S=2+"_STID="1718"_ENDID="1718"_STTOKEN="Adrienne Dickey"_ENDTOKEN="Adrienne Dickey">\n' +
      '<RELEX TYPE="S=2+"_STID="1762"_ENDID="1762"_STTOKEN="John Dickey"_ENDTOKEN="John Dickey">\n' +
      '<RELEX TYPE="S=2+"_STID="1825"_ENDID="1825"_STTOKEN="Jerry Semallie"_ENDTOKEN="Jerry Semallie">\n' +
      '<RELEX TYPE="S=3"_STID="1488"_ENDID="1488"_STTOKEN="William Allen Dickey II"_ENDTOKEN="William Allen Dickey II">\n' +
      '<RELEX TYPE="S=3+"_STID="1103"_ENDID="1103"_STTOKEN="William Allen Dickey"_ENDTOKEN="William Allen Dickey">\n' +
      '<RELEX TYPE="S=3+"_STID="1553"_ENDID="1553"_STTOKEN="William Allen Dickey"_ENDTOKEN="William Allen Dickey">\n' +
      '<RELEX TYPE="S=3+"_STID="892"_ENDID="892"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="S=3+"_STID="946"_ENDID="946"_STTOKEN="Dolores Jean Dickey"_ENDTOKEN="Dolores Jean Dickey">\n' +
      '<RELEX TYPE="Z:AGE_OF"_STID="946"_ENDID="967"_STTOKEN="Dolores Jean Dickey"_ENDTOKEN="66">\n' +
      '<RELEX TYPE="Z:HASFAMMEMLST"_STID="1472"_ENDID="1476"_STTOKEN="her"_ENDTOKEN="eldest son">\n' +
      '<RELEX TYPE="Z:HASFAMMEMLST"_STID="1540"_ENDID="1544"_STTOKEN="her"_ENDTOKEN="husband">\n' +
      '<RELEX TYPE="Z:HASFAMMEMLST"_STID="1816"_ENDID="1758"_STTOKEN="her"_ENDTOKEN="son">\n' +
      '<RELEX TYPE="Z:HASFAMMEMLST"_STID="1816"_ENDID="1820"_STTOKEN="her"_ENDTOKEN="son">\n' +
      '<RELEX TYPE="Z:HASFAMMEMLST"_STID="1896"_ENDID="1881"_STTOKEN="Dolores"_ENDTOKEN="grandchildren">\n' +
      '<RELEX TYPE="Z:HASFAMMEMLST"_STID="892"_ENDID="1593"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="children">\n' +
      '<RELEX TYPE="Z:HASFAMMEMLST"_STID="892"_ENDID="1603"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="daughter">\n' +
      '<RELEX TYPE="Z:HASFAMMEMLST"_STID="892"_ENDID="1662"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="daughter">\n' +
      '<RELEX TYPE="Z:HASFAMMEMLST"_STID="892"_ENDID="1709"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="daughter">\n' +
      '<RELEX TYPE="Z:HASFAMMEMLST"_STID="892"_ENDID="1758"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="son">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="1030"_ENDID="1038"_STTOKEN="She"_ENDTOKEN="born">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="1079"_ENDID="1092"_STTOKEN="She"_ENDTOKEN="married">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="1103"_ENDID="1092"_STTOKEN="William Allen Dickey"_ENDTOKEN="married">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="1142"_ENDID="1152"_STTOKEN="they"_ENDTOKEN="sealed together for time and all eternity">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="892"_ENDID="2212"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="Funeral services">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="892"_ENDID="2361"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="Interment">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="892"_ENDID="642"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="DEATH">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="892"_ENDID="652"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="FUNERAL">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="892"_ENDID="717"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="DEATH">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="892"_ENDID="727"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="FUNERAL">\n' +
      '<RELEX TYPE="Z:HAS_EVENT"_STID="892"_ENDID="984"_STTOKEN="DICKEY, DOLORES JEAN"_ENDTOKEN="passed on">\n' +
      '<RELEX TYPE="Z:IS_FEM_FOR"_STID="@GENDER"_ENDID="1612"_STTOKEN="@GENDER"_ENDTOKEN="Coleen O\'Farrell">\n' +
      '<RELEX TYPE="Z:IS_FEM_FOR"_STID="@GENDER"_ENDID="1671"_STTOKEN="@GENDER"_ENDTOKEN="Deborah Klay">\n' +
      '<RELEX TYPE="Z:IS_FEM_FOR"_STID="@GENDER"_ENDID="1718"_STTOKEN="@GENDER"_ENDTOKEN="Adrienne Dickey">\n' +
      '<RELEX TYPE="Z:IS_FEM_FOR"_STID="@GENDER"_ENDID="892"_STTOKEN="@GENDER"_ENDTOKEN="DICKEY, DOLORES JEAN">\n' +
      '<RELEX TYPE="Z:IS_MALE_FOR"_STID="@GENDER"_ENDID="1553"_STTOKEN="@GENDER"_ENDTOKEN="William Allen Dickey">\n' +
      '<RELEX TYPE="Z:IS_MALE_FOR"_STID="@GENDER"_ENDID="1762"_STTOKEN="@GENDER"_ENDTOKEN="John Dickey">\n' +
      '<RELEX TYPE="Z:IS_MALE_FOR"_STID="@GENDER"_ENDID="1825"_STTOKEN="@GENDER"_ENDTOKEN="Jerry Semallie">\n' +
      '<RELEX TYPE="Z:IS_PRINCIPAL"_STID="946"_ENDID="946"_STTOKEN="Dolores Jean Dickey"_ENDTOKEN="Dolores Jean Dickey">\n' +
      '<RELEX TYPE="Z:MEMBER_OF"_STID="1488"_ENDID="1476"_STTOKEN="William Allen Dickey II"_ENDTOKEN="eldest son">\n' +
      '<RELEX TYPE="Z:MEMBER_OF"_STID="1553"_ENDID="1544"_STTOKEN="William Allen Dickey"_ENDTOKEN="husband">\n' +
      '<RELEX TYPE="Z:MEMBER_OF"_STID="1612"_ENDID="1603"_STTOKEN="Coleen O\'Farrell"_ENDTOKEN="daughter">\n' +
      '<RELEX TYPE="Z:MEMBER_OF"_STID="1671"_ENDID="1662"_STTOKEN="Deborah Klay"_ENDTOKEN="daughter">\n' +
      '<RELEX TYPE="Z:MEMBER_OF"_STID="1718"_ENDID="1709"_STTOKEN="Adrienne Dickey"_ENDTOKEN="daughter">\n' +
      '<RELEX TYPE="Z:MEMBER_OF"_STID="1762"_ENDID="1758"_STTOKEN="John Dickey"_ENDTOKEN="son">\n' +
      '<RELEX TYPE="Z:MEMBER_OF"_STID="1825"_ENDID="1820"_STTOKEN="Jerry Semallie"_ENDTOKEN="son">\n' +
      '<RELEX TYPE="Z:NUMBER_OF"_STID="1353"_ENDID="1357"_STTOKEN="six"_ENDTOKEN="children">\n' +
      '<RELEX TYPE="Z:NUMBER_OF"_STID="1589"_ENDID="1593"_STTOKEN="six"_ENDTOKEN="children">\n' +
      '<RELEX TYPE="Z:NUMBER_OF"_STID="1878"_ENDID="1881"_STTOKEN="15"_ENDTOKEN="grandchildren">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="1057"_ENDID="1073"_STTOKEN="East Liverpool"_ENDTOKEN="Ohio">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="156"_ENDID="82"_STTOKEN="THE SAN DIEGO UNION-TRIBUNE"_ENDTOKEN="CA">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="1639"_ENDID="1652"_STTOKEN="Silverspring"_ENDTOKEN="Maryland">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="1689"_ENDID="1697"_STTOKEN="Santee"_ENDTOKEN="California">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="1739"_ENDID="1752"_STTOKEN="Centerville"_ENDTOKEN="Utah">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="1779"_ENDID="1795"_STTOKEN="Mountain Green"_ENDTOKEN="Utah">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="1846"_ENDID="1855"_STTOKEN="Cameron"_ENDTOKEN="Arizona">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="2279"_ENDID="2328"_STTOKEN="the Church of Jesus Christ of Latter-day Saints"_ENDTOKEN="8902 Highwood Drive">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="2328"_ENDID="2349"_STTOKEN="8902 Highwood Drive"_ENDTOKEN="San Diego">\n' +
      '<RELEX TYPE="Z:SUBPLACE_OF"_STID="52"_ENDID="82"_STTOKEN="San Diego Union-Tribune, The"_ENDTOKEN="CA">\n';
}