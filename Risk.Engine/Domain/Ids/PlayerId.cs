namespace Risk.Engine.Domain.Ids;

public readonly record struct PlayerId(string Value)
{
    public override string ToString() => Value;
}
