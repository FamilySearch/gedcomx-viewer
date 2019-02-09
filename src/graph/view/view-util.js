function encode(s) {
  if (!s) {
    s="";
  }
  return $('<div/>').text(s).html();
}