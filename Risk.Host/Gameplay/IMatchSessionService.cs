namespace Risk.Host.Gameplay;

public interface IMatchSessionService
{
    InitializeMatchResponse InitializeMatch(string matchId, InitializeMatchRequest request);
    SubmitCommandResponse SubmitCommand(string matchId, SubmitCommandRequest request);
    ReconnectResponse Reconnect(string matchId, ReconnectRequest request);
    MatchStateResponse? GetMatchState(string matchId);
}
