namespace Risk.Host.Networking;

public interface ISignalingService
{
    RegisterPeerResponse RegisterPeer(string roomId, string peerId);
    SignalMessage SendSignal(string roomId, string fromPeerId, SignalSendRequest request);
    IReadOnlyList<SignalMessage> GetSignals(string roomId, string peerId, long afterSequence);
    HostEventMessage PublishHostEvent(string roomId, string hostPeerId, HostEventPublishRequest request);
    IReadOnlyList<HostEventMessage> GetHostEvents(string roomId, long afterSequence);
}
