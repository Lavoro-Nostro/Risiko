namespace Risk.Engine.Domain.Ids;

public readonly record struct ContinentId(string Value)
{
    public override string ToString() => Value;
}
