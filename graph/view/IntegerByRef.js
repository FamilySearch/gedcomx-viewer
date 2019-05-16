// Class to allow passing an integer by reference so that the function can modify it.

IntegerByRef.prototype.set = function(value) {
  this.value = value;
};
IntegerByRef.prototype.get = function() {
  return this.value;
};

function IntegerByRef(value) {
  this.value = value;
}