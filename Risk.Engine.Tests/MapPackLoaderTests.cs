using Risk.Engine.Packs;

namespace Risk.Engine.Tests;

public class MapPackLoaderTests
{
    private readonly MapPackLoader _loader = new();

    [Fact]
    public async Task LoadAsync_WorldClassic_LoadsAllTerritories()
    {
        var mapDir = Path.GetFullPath(Path.Combine("..", "..", "..", "..", "packs", "maps", "world-classic"));

        var pack = await _loader.LoadAsync(mapDir);

        Assert.Equal("world-classic", pack.Id);
        Assert.Equal(42, pack.Territories.Count);
        Assert.Equal(6, pack.Continents.Count);
    }

    [Fact]
    public async Task Validate_WorldClassic_ReturnsValid()
    {
        var mapDir = Path.GetFullPath(Path.Combine("..", "..", "..", "..", "packs", "maps", "world-classic"));
        var pack = await _loader.LoadAsync(mapDir);

        var result = _loader.Validate(pack);

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void Validate_DetectsAdjacencyAsymmetry()
    {
        var pack = new MapPack(
            "broken-map",
            "Broken",
            [
                new MapTerritory("a", "c1", ["b"]),
                new MapTerritory("b", "c1", [])
            ],
            [
                new MapContinent("c1", 3, ["a", "b"])
            ]);

        var result = _loader.Validate(pack);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("Adjacency asymmetry", StringComparison.Ordinal));
    }

    [Fact]
    public void Validate_DetectsMissingContinentReference()
    {
        var pack = new MapPack(
            "broken-map-2",
            "Broken2",
            [
                new MapTerritory("a", "missing", [])
            ],
            [
                new MapContinent("c1", 2, ["a"])
            ]);

        var result = _loader.Validate(pack);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("unknown continent", StringComparison.OrdinalIgnoreCase));
    }
}
