using System.Text.Json;
using System.Xml.Linq;

namespace Risk.Engine.Tests;

public class MapPackAssetConsistencyTests
{
    [Fact]
    public void WorldClassic_MapJsonSvgAndI18n_AreConsistent()
    {
        var root = Path.GetFullPath(Path.Combine("..", "..", "..", ".."));
        var mapPath = Path.Combine(root, "packs", "maps", "world-classic", "map.json");
        var svgPath = Path.Combine(root, "packs", "maps", "world-classic", "map.svg");
        var enPath = Path.Combine(root, "packs", "maps", "world-classic", "i18n", "en.json");
        var itPath = Path.Combine(root, "packs", "maps", "world-classic", "i18n", "it.json");

        var mapJson = JsonDocument.Parse(File.ReadAllText(mapPath));
        var territoryIds = mapJson.RootElement
            .GetProperty("territories")
            .EnumerateArray()
            .Select(x => x.GetProperty("id").GetString()!)
            .ToHashSet(StringComparer.Ordinal);

        var svg = XDocument.Load(svgPath);
        XNamespace ns = "http://www.w3.org/2000/svg";
        var svgIds = svg.Descendants(ns + "g")
            .Select(x => x.Attribute("id")?.Value)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!)
            .ToHashSet(StringComparer.Ordinal);

        var enKeys = JsonDocument.Parse(File.ReadAllText(enPath)).RootElement
            .EnumerateObject()
            .Select(x => x.Name)
            .Where(x => x.StartsWith("territories.", StringComparison.Ordinal))
            .Select(x => x["territories.".Length..])
            .ToHashSet(StringComparer.Ordinal);

        var itKeys = JsonDocument.Parse(File.ReadAllText(itPath)).RootElement
            .EnumerateObject()
            .Select(x => x.Name)
            .Where(x => x.StartsWith("territories.", StringComparison.Ordinal))
            .Select(x => x["territories.".Length..])
            .ToHashSet(StringComparer.Ordinal);

        Assert.Equal(42, territoryIds.Count);
        Assert.Equal(territoryIds, svgIds);
        Assert.Equal(territoryIds, enKeys);
        Assert.Equal(territoryIds, itKeys);
    }
}
