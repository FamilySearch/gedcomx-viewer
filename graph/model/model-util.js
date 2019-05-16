// Look through the given array for the given value, and append the value to the end if it is not already there.
// Either way, return the index into the given array where the value was found or added.
function addToArrayIfNotThere(value, array) {
  var i;
  for (i = 0; i < array.length; i++) {
    if (array[i] === value) {
      return i;
    }
  }
  array[i] = value;
  return i;
}