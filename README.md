# gedcomx-viewer

UI for viewing/editing/saving GEDCOM X data.

## Notes on Creating Truth Files

* Don't assume surnames if not explicitly provided (e.g. for Mike and Ann Johnson, Mike has no surname)
* Don't need to standardize on original date format (yet?)
* Add funeral if mentioned
* Assume married spouse also has parent-child relationships to children.
* Calculate implicit dates (i.e. convert things like Thursday to an actual date if possible)
* Remove estimated birthdate if explicit date is specified
* Add military service if mentioned
* Add military award if mentioned
* Add "move from" if mentioned
* Add "religion" if mentioned
* Add "education" if mentioned
* Add or move nickname if mentioned
* Add cause of death if mentioned
* Add inferred birth if age mentioned
