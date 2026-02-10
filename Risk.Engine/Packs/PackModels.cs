namespace Risk.Engine.Packs;

public sealed record MapPack(
    string Id,
    string Name,
    IReadOnlyList<MapTerritory> Territories,
    IReadOnlyList<MapContinent> Continents
);

public sealed record MapTerritory(
    string Id,
    string Continent,
    IReadOnlyList<string> Neighbors
);

public sealed record MapContinent(
    string Id,
    int Bonus,
    IReadOnlyList<string> Territories
);

public sealed record MapPackValidationResult(
    bool IsValid,
    IReadOnlyList<string> Errors
)
{
    public static MapPackValidationResult Success() => new(true, []);

    public static MapPackValidationResult Failure(IReadOnlyList<string> errors) =>
        new(false, errors);
}
