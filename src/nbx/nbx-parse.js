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
    else if (c === '') {
      offset++; // ignore newlines
    }
  }

  return nbx;
}

function getSample() {
  return '<NBX>' +
      '<UNQ>007150503_00275_TXT</UNQ>' +
      '<IMID>007150503_00275</IMID>' +
      '<APID><TIMEX TYPE=\\"DATE\\">TH-1961</TIMEX>-32807-<TIMEX TYPE=\\"DATE.non\\">15271-30</TIMEX></APID>' +
      '<IMGSIZE>3204,4059</IMGSIZE>' +
      '<SBODY>267' +
      'This <ENAMEX TYPE=\\"EVENT.xlife\\">Indenture</ENAMEX>, made this <TIMEX TYPE=\\"DATE\\">Twentieth day of December in the year of' +
      'our Lord one thousand eight hundred and fifty five</TIMEX> Between <ENAMEX TYPE=\\"PERSON\\">Hosea Meacham</ENAMEX> and <ENAMEX TYPE=\\"PERSON\\">Mary</ENAMEX> <ENAMEX TYPE=\\"COREF\\">his</ENAMEX> <ENAMEX TYPE=\\"FAMILYMEMBER\\">wife</ENAMEX>' +
      'of the <ENAMEX TYPE=\\"LOCALE\\">County of Cattaraugus</ENAMEX> and <ENAMEX TYPE=\\"LOCALE\\">State of New York</ENAMEX> of the first part, and <ENAMEX TYPE=\\"PERSON\\">Moses Bowen</ENAMEX>' +
      'of the <ENAMEX TYPE=\\"LOCALE\\">County of Cattaraugus</ENAMEX> and <ENAMEX TYPE=\\"LOCALE\\">State of New York</ENAMEX> of the second part, Witnesseth, that the said party of the' +
      'first part, for and in consideration of the sum of <NUMEX TYPE=\\"MONEY\\">One hundred' +
      'Dollars</NUMEX>, lawful money of the <ENAMEX TYPE=\\"LOCALE\\">United States of America</ENAMEX>, <ENAMEX TYPE=\\"COREF\\">them</ENAMEX> in hand paid by the said party of the second part, the receipt whereof' +
      'is hereby acknowledged, and <ENAMEX TYPE=\\"COREF\\">they</ENAMEX> to be therewith fully satisfied contented and paid, have <ENAMEX TYPE=\\"EVENT.xlife\\">Granted, Bargained, Sold, Aliened, Remis-' +
      'ed, Released, Conveyed, and Confirmed</ENAMEX>, and by these presents do <ENAMEX TYPE=\\"EVENT.xlife\\">Grant, Bargain, Sell, Alien, Remise, Release, Convey and Con-' +
      'firm</ENAMEX> unto the said party of the second part and to <ENAMEX TYPE=\\"COREF\\">his</ENAMEX> <ENAMEX TYPE=\\"NONFAMILY\\">heirs</ENAMEX> and <ENAMEX TYPE=\\"NONFAMILY\\">assigns</ENAMEX> forever, all that certain piece or parcel of land, situate, lying and' +
      'being in the <ENAMEX TYPE=\\"LOCALE\\">County of Cattaraugus</ENAMEX> and <ENAMEX TYPE=\\"LOCALE\\">State of New York</ENAMEX> distinguished by' +
      '' +
      'Part of lot number thirteen in township number four in the seventh range' +
      'of townships according to a survey made for the <ENAMEX TYPE=\\"ORGANIZATION\\">Holland Land Company</ENAMEX> by' +
      '<ENAMEX TYPE=\\"PERSON\\">Joseph Ellicott</ENAMEX> <ENAMEX TYPE=\\"OCCUPATION\\">surveyor</ENAMEX> Bounded as follows, Beginning on a line' +
      'at the distance of <NUMEX TYPE=\\"QUANTITY\\">eighteen</NUMEX> chains <NUMEX TYPE=\\"QUANTITY\\">seventeen</NUMEX> links north of the South bounds' +
      'of said lot and at a point <NUMEX TYPE=\\"QUANTITY\\">twenty five</NUMEX> chains and <NUMEX TYPE=\\"QUANTITY\\">five</NUMEX> links west of the party ' +
      'bounds thereof North <NUMEX TYPE=\\"QUANTITY\\">thirty five</NUMEX> degrees West <NUMEX TYPE=\\"QUANTITY\\">eleven</NUMEX> chains <NUMEX TYPE=\\"QUANTITY\\">twenty</NUMEX> links ' +
      'thence north on a line parallel to the east bounds of said lot <NUMEX TYPE=\\"QUANTITY\\">five</NUMEX> chains' +
      '<NUMEX TYPE=\\"QUANTITY\\">sixty</NUMEX> links thence west on a line parallel to the South bounds of said lot' +
      '<NUMEX TYPE=\\"QUANTITY\\">two</NUMEX> chains <NUMEX TYPE=\\"QUANTITY\\">seventy five</NUMEX> links thence South on a line parallel to the last' +
      'bounds of said lot <NUMEX TYPE=\\"QUANTITY\\">seven</NUMEX> chains <NUMEX TYPE=\\"QUANTITY\\">fifty-six</NUMEX> links to the center of the highway' +
      'thence along the center of the highway South <NUMEX TYPE=\\"QUANTITY\\">thirty five</NUMEX> degrees east <NUMEX TYPE=\\"QUANTITY\\">eight</NUMEX> chains <NUMEX TYPE=\\"QUANTITY\\">Sixty two</NUMEX> links thence East on a line ' +
      'parallel to the South bounds of said lot <NUMEX TYPE=\\"QUANTITY\\">four</NUMEX> chains <NUMEX TYPE=\\"QUANTITY\\">forty four</NUMEX> links to the place of beginning Containing <NUMEX TYPE=\\"QUANTITY\\">five</NUMEX> acres be the ' +
      'same more or less according to the annexed plan' +
      '' +
      'Together with all, and singular the tenements, hereditaments, and appurtenances thereunto belonging, or in anwise appertaining, and the' +
      'reversion and reversions, remainder and remainders, rents, issues and profits thereof: And also, all the estate, right, title, interest,' +
      'Dower property, possession, claim and demand, whatsoever, as well in Law as in Equity, of the said' +
      'party of the first part, of, in, or to the above described premises, and every part and parcel thereof, with the appurtenances. To have' +
      'and to Hold, the above granted, and described premises, with the appurtenances, unto the said party of the second part, <ENAMEX TYPE=\\"COREF\\">his</ENAMEX> <ENAMEX TYPE=\\"NONFAMILY\\">heirs</ENAMEX>' +
      'and <ENAMEX TYPE=\\"NONFAMILY\\">assigns</ENAMEX> to <ENAMEX TYPE=\\"COREF\\">his</ENAMEX> and <ENAMEX TYPE=\\"COREF\\">their</ENAMEX> only proper use, and behoof forever. And the said <ENAMEX TYPE=\\"PERSON\\">Hosea Meacham</ENAMEX>' +
      'for <ENAMEX TYPE=\\"COREF\\">himself</ENAMEX> <ENAMEX TYPE=\\"COREF\\">his</ENAMEX> <ENAMEX TYPE=\\"NONFAMILY\\">heirs</ENAMEX>, <ENAMEX TYPE=\\"NONFAMILY\\">executors</ENAMEX> and <ENAMEX TYPE=\\"NONFAMILY\\">administrators</ENAMEX>, do covenant, promise and agree to and with the said party' +
      'of the second part <ENAMEX TYPE=\\"COREF\\">his</ENAMEX> <ENAMEX TYPE=\\"NONFAMILY\\">heirs</ENAMEX> and <ENAMEX TYPE=\\"NONFAMILY\\">assigns</ENAMEX>, the above mentioned and described premises in the quiet and peacable possession of the said' +
      'party of the second part, <ENAMEX TYPE=\\"COREF\\">his</ENAMEX> <ENAMEX TYPE=\\"NONFAMILY\\">heirs</ENAMEX> and <ENAMEX TYPE=\\"NONFAMILY\\">assigns</ENAMEX>, against the said party of the first part, and <ENAMEX TYPE=\\"COREF\\">their</ENAMEX> <ENAMEX TYPE=\\"NONFAMILY\\">heirs</ENAMEX> and against all other' +
      'persons whatsoever, lawfully claiming or to claim the same, will Warrant and by these presents forever Defend.' +
      '' +
      'In Witness Whereof, The said party of the first part, have hereunto set <ENAMEX TYPE=\\"COREF\\">their</ENAMEX> hands and seals the <TIMEX TYPE=\\"COREF.dat\\">day and year first' +
      'above written</TIMEX>.' +
      '' +
      'Sealed and Delivered in presence of' +
      '<ENAMEX TYPE=\\"PERSON\\">Hosea Meacham</ENAMEX> S.S.' +
      '<ENAMEX TYPE=\\"PERSON\\">Mary Meacham</ENAMEX> S.S.' +
      '' +
      '<ENAMEX TYPE=\\"LOCALE\\">STATE OF NEW YORK</ENAMEX>.' +
      '<ENAMEX TYPE=\\"LOCALE\\">Cattaraugus County</ENAMEX>. ⎬ SS' +
      'On this <TIMEX TYPE=\\"DATE\\">Twentieth day of December 1855</TIMEX>' +
      '<ENAMEX TYPE=\\"PERSON\\">Hosea Meacham</ENAMEX> and <ENAMEX TYPE=\\"PERSON\\">Mary</ENAMEX> <ENAMEX TYPE=\\"COREF\\">his</ENAMEX> <ENAMEX TYPE=\\"FAMILYMEMBER\\">wife</ENAMEX> known' +
      'to <ENAMEX TYPE=\\"COREF\\">me</ENAMEX> to be the persons described in and <ENAMEX TYPE=\\"COREF\\">who</ENAMEX> executed the above instrument, personal-' +
      'ly came before <ENAMEX TYPE=\\"COREF\\">me</ENAMEX> and acknowledged the execution thereof,  And the said' +
      '<ENAMEX TYPE=\\"PERSON\\">Mary</ENAMEX> on a private examination separate and' +
      'apart from <ENAMEX TYPE=\\"COREF\\">her</ENAMEX> <ENAMEX TYPE=\\"FAMILYMEMBER\\">husband</ENAMEX>, acknowledged that <ENAMEX TYPE=\\"COREF\\">she</ENAMEX> executed the same freely, and without' +
      'any fear or compulsion of <ENAMEX TYPE=\\"COREF\\">her</ENAMEX> said <ENAMEX TYPE=\\"FAMILYMEMBER\\">husband</ENAMEX>.' +
      '' +
      '<ENAMEX TYPE=\\"PERSON\\">C.S. Leavitt</ENAMEX> <ENAMEX TYPE=\\"OCCUPATION\\">Justice</ENAMEX>' +
      '</SBODY>' +
      '</NBX>' +
      '' +
      '<RELEX TYPE=\\"E1:HAS_STDATE\\"_STID=\\"147\\"_ENDID=\\"168\\"_STTOKEN=\\"Indenture\\"_ENDTOKEN=\\"Twentieth day of December in the year of our Lord one thousand eight hundred and fifty five\\">' +
      '<RELEX TYPE=\\"E2:HAS_RESPL\\"_STID=\\"291\\"_ENDID=\\"307\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"County of Cattaraugus\\">' +
      '<RELEX TYPE=\\"E2:HAS_RESPL\\"_STID=\\"374\\"_ENDID=\\"393\\"_STTOKEN=\\"Moses Bowen\\"_ENDTOKEN=\\"County of Cattaraugus\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"1104\\"_ENDID=\\"307\\"_STTOKEN=\\"County of Cattaraugus\\"_ENDTOKEN=\\"County of Cattaraugus\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"1130\\"_ENDID=\\"333\\"_STTOKEN=\\"State of New York\\"_ENDTOKEN=\\"State of New York\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"2833\\"_ENDID=\\"999\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"his\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"2858\\"_ENDID=\\"999\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"his\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"291\\"_ENDID=\\"268\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"2922\\"_ENDID=\\"268\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"2940\\"_ENDID=\\"2922\\"_STTOKEN=\\"himself\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"2948\\"_ENDID=\\"2922\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3066\\"_ENDID=\\"2922\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3207\\"_ENDID=\\"2922\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3276\\"_ENDID=\\"2866\\"_STTOKEN=\\"their\\"_ENDTOKEN=\\"their\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3494\\"_ENDID=\\"2866\\"_STTOKEN=\\"their\\"_ENDTOKEN=\\"their\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3591\\"_ENDID=\\"268\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3591\\"_ENDID=\\"2922\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3629\\"_ENDID=\\"333\\"_STTOKEN=\\"STATE OF NEW YORK\\"_ENDTOKEN=\\"State of New York\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3712\\"_ENDID=\\"268\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3712\\"_ENDID=\\"3591\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3730\\"_ENDID=\\"3610\\"_STTOKEN=\\"Mary\\"_ENDTOKEN=\\"Mary Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3735\\"_ENDID=\\"268\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3851\\"_ENDID=\\"3753\\"_STTOKEN=\\"me\\"_ENDTOKEN=\\"me\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3908\\"_ENDID=\\"3610\\"_STTOKEN=\\"Mary\\"_ENDTOKEN=\\"Mary Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3908\\"_ENDID=\\"3730\\"_STTOKEN=\\"Mary\\"_ENDTOKEN=\\"Mary\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"393\\"_ENDID=\\"307\\"_STTOKEN=\\"County of Cattaraugus\\"_ENDTOKEN=\\"County of Cattaraugus\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3962\\"_ENDID=\\"3610\\"_STTOKEN=\\"her\\"_ENDTOKEN=\\"Mary Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"3993\\"_ENDID=\\"3610\\"_STTOKEN=\\"she\\"_ENDTOKEN=\\"Mary Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"4061\\"_ENDID=\\"3610\\"_STTOKEN=\\"her\\"_ENDTOKEN=\\"Mary Meacham\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"419\\"_ENDID=\\"333\\"_STTOKEN=\\"State of New York\\"_ENDTOKEN=\\"State of New York\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"614\\"_ENDID=\\"2866\\"_STTOKEN=\\"them\\"_ENDTOKEN=\\"their\\">' +
      '<RELEX TYPE=\\"R40:IS_SAME_AS\\"_STID=\\"718\\"_ENDID=\\"2866\\"_STTOKEN=\\"they\\"_ENDTOKEN=\\"their\\">' +
      '<RELEX TYPE=\\"S=2+\\"_STID=\\"1311\\"_ENDID=\\"1311\\"_STTOKEN=\\"Joseph Ellicott\\"_ENDTOKEN=\\"Joseph Ellicott\\">' +
      '<RELEX TYPE=\\"S=2+\\"_STID=\\"268\\"_ENDID=\\"268\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"S=2+\\"_STID=\\"2922\\"_ENDID=\\"2922\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"S=2+\\"_STID=\\"3591\\"_ENDID=\\"3591\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"S=2+\\"_STID=\\"3610\\"_ENDID=\\"3610\\"_STTOKEN=\\"Mary Meacham\\"_ENDTOKEN=\\"Mary Meacham\\">' +
      '<RELEX TYPE=\\"S=2+\\"_STID=\\"3712\\"_ENDID=\\"3712\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"S=2+\\"_STID=\\"374\\"_ENDID=\\"374\\"_STTOKEN=\\"Moses Bowen\\"_ENDTOKEN=\\"Moses Bowen\\">' +
      '<RELEX TYPE=\\"S=2+\\"_STID=\\"4080\\"_ENDID=\\"4080\\"_STTOKEN=\\"C.S. Leavitt\\"_ENDTOKEN=\\"C.S. Leavitt\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"2833\\"_ENDID=\\"2837\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"heirs\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"2858\\"_ENDID=\\"2847\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"assigns\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"291\\"_ENDID=\\"295\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"wife\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"2948\\"_ENDID=\\"2952\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"heirs\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"2948\\"_ENDID=\\"2959\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"executors\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"2948\\"_ENDID=\\"2973\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"administrators\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"3066\\"_ENDID=\\"3070\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"heirs\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"3066\\"_ENDID=\\"3080\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"assigns\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"3207\\"_ENDID=\\"3211\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"heirs\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"3207\\"_ENDID=\\"3221\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"assigns\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"3276\\"_ENDID=\\"3282\\"_STTOKEN=\\"their\\"_ENDTOKEN=\\"heirs\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"3735\\"_ENDID=\\"3739\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"wife\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"3962\\"_ENDID=\\"3966\\"_STTOKEN=\\"her\\"_ENDTOKEN=\\"husband\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"4061\\"_ENDID=\\"4070\\"_STTOKEN=\\"her\\"_ENDTOKEN=\\"husband\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"999\\"_ENDID=\\"1003\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"heirs\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"999\\"_ENDID=\\"1013\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"assigns\\">' +
      '<RELEX TYPE=\\"Z:HASFAMMEMLST\\"_STID=\\"999\\"_ENDID=\\"295\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"wife\\">' +
      '<RELEX TYPE=\\"Z:HAS_EVENT\\"_STID=\\"268\\"_ENDID=\\"147\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Indenture\\">' +
      '<RELEX TYPE=\\"Z:HAS_EVENT\\"_STID=\\"268\\"_ENDID=\\"780\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Granted, Bargained, Sold, Aliened, Remised, Released, Conveyed, and Confirmed\\">' +
      '<RELEX TYPE=\\"Z:HAS_EVENT\\"_STID=\\"268\\"_ENDID=\\"886\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Grant, Bargain, Sell, Alien, Remise, Release, Convey and Confirm\\">' +
      '<RELEX TYPE=\\"Z:HAS_EVENT\\"_STID=\\"286\\"_ENDID=\\"147\\"_STTOKEN=\\"Mary\\"_ENDTOKEN=\\"Indenture\\">' +
      '<RELEX TYPE=\\"Z:HAS_EVENT\\"_STID=\\"286\\"_ENDID=\\"780\\"_STTOKEN=\\"Mary\\"_ENDTOKEN=\\"Granted, Bargained, Sold, Aliened, Remised, Released, Conveyed, and Confirmed\\">' +
      '<RELEX TYPE=\\"Z:HAS_EVENT\\"_STID=\\"286\\"_ENDID=\\"886\\"_STTOKEN=\\"Mary\\"_ENDTOKEN=\\"Grant, Bargain, Sell, Alien, Remise, Release, Convey and Confirm\\">' +
      '<RELEX TYPE=\\"Z:HAS_EVENT\\"_STID=\\"291\\"_ENDID=\\"780\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"Granted, Bargained, Sold, Aliened, Remised, Released, Conveyed, and Confirmed\\">' +
      '<RELEX TYPE=\\"Z:HAS_EVENT\\"_STID=\\"291\\"_ENDID=\\"886\\"_STTOKEN=\\"his\\"_ENDTOKEN=\\"Grant, Bargain, Sell, Alien, Remise, Release, Convey and Confirm\\">' +
      '<RELEX TYPE=\\"Z:IS_FEM_FOR\\"_STID=\\"@GENDER\\"_ENDID=\\"286\\"_STTOKEN=\\"@GENDER\\"_ENDTOKEN=\\"Mary\\">' +
      '<RELEX TYPE=\\"Z:IS_FEM_FOR\\"_STID=\\"@GENDER\\"_ENDID=\\"3610\\"_STTOKEN=\\"@GENDER\\"_ENDTOKEN=\\"Mary Meacham\\">' +
      '<RELEX TYPE=\\"Z:IS_MALE_FOR\\"_STID=\\"@GENDER\\"_ENDID=\\"268\\"_STTOKEN=\\"@GENDER\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"Z:IS_PRINCIPAL\\"_STID=\\"268\\"_ENDID=\\"268\\"_STTOKEN=\\"Hosea Meacham\\"_ENDTOKEN=\\"Hosea Meacham\\">' +
      '<RELEX TYPE=\\"Z:MEMBER_OF\\"_STID=\\"286\\"_ENDID=\\"295\\"_STTOKEN=\\"Mary\\"_ENDTOKEN=\\"wife\\">' +
      '<RELEX TYPE=\\"Z:MEMBER_OF\\"_STID=\\"3730\\"_ENDID=\\"3739\\"_STTOKEN=\\"Mary\\"_ENDTOKEN=\\"wife\\">' +
      '<RELEX TYPE=\\"Z:OCCUPATION_OF\\"_STID=\\"1311\\"_ENDID=\\"1327\\"_STTOKEN=\\"Joseph Ellicott\\"_ENDTOKEN=\\"surveyor\\">';
}