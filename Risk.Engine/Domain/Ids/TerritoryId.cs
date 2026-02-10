namespace Risk.Engine.Domain.Ids;

public readonly record struct TerritoryId(string Value)
{
    public override string ToString() => Value;
}
