// Look through the given array for the given value, and append the value to the end if it is not already there.
// Either way, return the index into the given array where the value was found or added.
function addToArrayIfNotThere(value, array) {
  let i = 0;
  while (i < array.length) {
    if (array[i] === value) {
      return i;
    }
    i++;
  }
  array[i] = value;
  return i;
}