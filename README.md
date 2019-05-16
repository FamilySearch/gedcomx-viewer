UI for viewing/editing/saving GEDCOM X data.

---

GedcomX viewer/editor prioritized list of what still needs to be done.

I. Viewer
- Optimize line crossings: Reduce number of crossed lines.
- Optimize lines: Avoid unnecessarily long lines.
- For multiple parents or spouses, spread horizontal lines vertically along box. (Optimize crossings).
- Detailed display:
  - name forms, name parts, name fields.
  - fact value, date, place, fields
  - person fields
- Show/hide details

II. Editor
- Click gender on selected person to cycle.
- Click principal box on selected person to toggle.
- Consider hovering to select instead of having to click.
- Find a better way to add two parents (assume couple rel when adding 2nd parent? But how to NOT do that?)
- Add/delete person (click relationship to add new person as that relative).
- Add/delete/edit names, forms, parts.
- Add/delete/edit facts, dates, places.
- Handle fields, including orig/interp and bounding boxes.
- Checkbox next to each line to help user keep track of what they've validated.
- Drop-down to change gender.
- Output updated GedcomX JSON.
- Undo/redo history.
[If possible:]
- Save GedcomX to labeled data store.