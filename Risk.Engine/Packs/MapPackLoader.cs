using System.Text.Json;

namespace Risk.Engine.Packs;

public sealed class MapPackLoader
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<MapPack> LoadAsync(string mapPackDirectory, CancellationToken cancellationToken = default)
    {
        var mapJsonPath = Path.Combine(mapPackDirectory, "map.json");
        if (!File.Exists(mapJsonPath))
        {
            throw new FileNotFoundException($"Missing map.json in map pack directory: {mapPackDirectory}", mapJsonPath);
        }

        await using var stream = File.OpenRead(mapJsonPath);
        var dto = await JsonSerializer.DeserializeAsync<MapPackDto>(stream, JsonOptions, cancellationToken);
        if (dto is null)
        {
            throw new InvalidDataException($"Failed to deserialize map pack file: {mapJsonPath}");
        }

        return new MapPack(
            dto.Id ?? string.Empty,
            dto.Name ?? string.Empty,
            dto.Territories?.Select(t => new MapTerritory(
                t.Id ?? string.Empty,
                t.Continent ?? string.Empty,
                t.Neighbors ?? []
            )).ToList() ?? [],
            dto.Continents?.Select(c => new MapContinent(
                c.Id ?? string.Empty,
                c.Bonus,
                c.Territories ?? []
            )).ToList() ?? []
        );
    }

    public MapPackValidationResult Validate(MapPack pack)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(pack.Id))
        {
            errors.Add("Map pack id is required.");
        }

        if (pack.Territories.Count == 0)
        {
            errors.Add("Map pack must contain at least one territory.");
        }

        var territoryIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var territory in pack.Territories)
        {
            if (string.IsNullOrWhiteSpace(territory.Id))
            {
                errors.Add("Territory id is required.");
                continue;
            }

            if (!territoryIds.Add(territory.Id))
            {
                errors.Add($"Duplicate territory id: {territory.Id}");
            }
        }

        var territoryMap = pack.Territories.ToDictionary(t => t.Id, t => t, StringComparer.Ordinal);

        foreach (var territory in pack.Territories)
        {
            if (string.IsNullOrWhiteSpace(territory.Continent))
            {
                errors.Add($"Territory '{territory.Id}' has no continent.");
            }

            foreach (var neighbor in territory.Neighbors)
            {
                if (!territoryMap.ContainsKey(neighbor))
                {
                    errors.Add($"Territory '{territory.Id}' references unknown neighbor '{neighbor}'.");
                    continue;
                }

                var reverse = territoryMap[neighbor];
                if (!reverse.Neighbors.Contains(territory.Id, StringComparer.Ordinal))
                {
                    errors.Add($"Adjacency asymmetry between '{territory.Id}' and '{neighbor}'.");
                }
            }
        }

        var continentIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var continent in pack.Continents)
        {
            if (string.IsNullOrWhiteSpace(continent.Id))
            {
                errors.Add("Continent id is required.");
                continue;
            }

            if (!continentIds.Add(continent.Id))
            {
                errors.Add($"Duplicate continent id: {continent.Id}");
            }

            if (continent.Bonus <= 0)
            {
                errors.Add($"Continent '{continent.Id}' bonus must be > 0.");
            }

            foreach (var territoryId in continent.Territories)
            {
                if (!territoryMap.ContainsKey(territoryId))
                {
                    errors.Add($"Continent '{continent.Id}' references unknown territory '{territoryId}'.");
                }
            }
        }

        foreach (var territory in pack.Territories)
        {
            if (!continentIds.Contains(territory.Continent))
            {
                errors.Add($"Territory '{territory.Id}' references unknown continent '{territory.Continent}'.");
            }
        }

        return errors.Count == 0
            ? MapPackValidationResult.Success()
            : MapPackValidationResult.Failure(errors);
    }

    private sealed record MapPackDto(
        string? Id,
        string? Name,
        List<MapTerritoryDto>? Territories,
        List<MapContinentDto>? Continents
    );

    private sealed record MapTerritoryDto(
        string? Id,
        string? Continent,
        List<string>? Neighbors
    );

    private sealed record MapContinentDto(
        string? Id,
        int Bonus,
        List<string>? Territories
    );
}
