# map.json Schema (Draft)

## territories[]
- id: string (unique)
- continent: string
- neighbors: string[]

## continents[]
- id: string (unique)
- bonus: integer
- territories: string[]

## constraints
- territory IDs unique
- no self-neighbor references
- all neighbors resolve to valid territory IDs
