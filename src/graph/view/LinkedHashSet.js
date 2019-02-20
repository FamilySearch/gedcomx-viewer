/*
  Class that provides O(1) adding and lookup, but also maintains an ordered array of the unique values in it.
  Requires O(n) deletion.
 */
LinkedHashSet.prototype.add = function(value) {
  if (!this.map.hasOwnProperty(value)) {
    this.map[value] = true;
    this.values.push(value);
  }
};

LinkedHashSet.prototype.remove = function(value) {
  if (this.map[value]) {
    delete this.map[value];
    var index = this.values.indexOf(value);
    if (index > -1) {
      this.values.splice(index, 1);
    }
    else {
      throw "Could not find value in array that was in map, in LinkedHashSet.";
    }
  }
};

LinkedHashSet.prototype.addAll = function(other) {
  var i, value;
  for (i = 0; i < other.values.length; i++) {
    this.add(other.values[i]);
  }
};

LinkedHashSet.prototype.contains = function(value) {
  return this.map.hasOwnProperty(value); // true if map[value] is present; false otherwise.
};

LinkedHashSet.prototype.isEmpty = function() {
  return this.values.length === 0;
};

LinkedHashSet.prototype.getFirst = function() {
  return this.isEmpty() ? null : this.values[0];
};

LinkedHashSet.prototype.clear = function() {
  this.map = {};
  this.values = [];
};

function LinkedHashSet() {
  // Map of value to 'true'
  this.map = {};
  // Array of unique values
  this.values = [];
  this.size = 0;
}