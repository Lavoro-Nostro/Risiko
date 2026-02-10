# Changelog

All notable changes to this project will be documented here.

## [Unreleased]
- Initial docs-first repository structure created.
- RIS-STEP-001 scaffold completed:
- Added `Risiko.slnx`
- Added `Risk.Engine` class library project
- Added `Risk.Host` ASP.NET minimal host project
- Added `Risk.Web` Vite + React + TypeScript scaffold
- RIS-STEP-002 shared contracts in progress:
- Added ID value objects (`PlayerId`, `TerritoryId`, `ContinentId`)
- Added turn phase enum
- Added command and event contract DTOs
- Added command validation result model and error codes
- Added `Risk.Web/package-lock.json` for deterministic npm installs
