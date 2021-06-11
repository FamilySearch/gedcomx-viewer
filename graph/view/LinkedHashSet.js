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
    let index = this.values.indexOf(value);
    if (index > -1) {
      this.values.splice(index, 1);
    }
    else {
      throw "Could not find value in array that was in map, in LinkedHashSet.";
    }
  }
};

LinkedHashSet.prototype.removeAll = function(other) {
  for (let value of other.values) {
    this.remove(value);
  }
};

LinkedHashSet.prototype.addAll = function(other) {
  for (let value of other.values) {
    this.add(value);
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

LinkedHashSet.prototype.getSize = function() {
  return this.values.length;
};

function LinkedHashSet() {
  // Map of value to 'true'
  this.map = {};
  // Array of unique values
  this.values = [];
  this.size = 0;
}