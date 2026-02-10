# Pack Specification

## Layout
/packs/maps/<map-id>/
  map.svg
  map.json
  i18n/
    en.json
    it.json

## Requirements
- map.svg territory IDs must match map.json territory IDs
- map.json neighbors must be symmetric
- continents must reference existing territories
