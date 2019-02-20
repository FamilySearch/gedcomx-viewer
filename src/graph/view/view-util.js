function encode(s) {
  if (!s) {
    s="";
  }
  return $('<div/>').text(s).html();
}

function isEmpty(a) {
  return !a || a.length === 0;
}