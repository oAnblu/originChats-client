import { useReducer } from "preact/hooks";
import { useSignalEffect } from "@preact/signals";
import { currentUserByServer, serverUrl } from "../state";
import { renderVoiceSignal, showVoiceCallView } from "../lib/ui-signals";
import { voiceManager } from "../voice";
import { Icon } from "./Icon";
import { avatarUrl } from "../utils";

export function VoiceCallView() {
  // useReducer gives a stable forceUpdate — increment it whenever
  // renderVoiceSignal changes so this component always reflects live state.
  const [, forceUpdate] = useReducer((n) => n + 1, 0);
  useSignalEffect(() => {
    renderVoiceSignal.value; // subscribe
    forceUpdate(undefined);
  });

  const channel = voiceManager.currentChannel;
  const participants = voiceManager.participants;
  const myUsername =
    currentUserByServer.value[serverUrl.value]?.username || "You";
  const isMuted = voiceManager.isMuted;
  const isSpeaking = voiceManager.isSpeaking;
  const isScreenSharing = !!voiceManager.videoStream;

  const hasVideoStreams =
    Object.keys(voiceManager.videoStreams).length > 0 || isScreenSharing;

  return (
    <div className="voice-call-view">
      <div className="voice-call-header">
        <div className="voice-call-header-left">
          <Icon name="Mic" size={20} />
          <span className="voice-call-channel-name">{channel}</span>
          <span className="voice-call-participant-count">
            {participants.length} participant
            {participants.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          className="voice-call-minimize-btn"
          onClick={() => (showVoiceCallView.value = false)}
          title="Minimize"
        >
          <Icon name="Minimize2" size={18} />
        </button>
      </div>

      {hasVideoStreams && (
        <div className="voice-call-video-area">
          {isScreenSharing && (
            <div className="voice-call-video-tile voice-call-video-self">
              <video
                ref={(el) => {
                  if (el && voiceManager.videoStream) {
                    el.srcObject = voiceManager.videoStream;
                  }
                }}
                autoPlay
                muted
                playsInline
                className="voice-call-video-element"
              />
              <div className="voice-call-video-label">
                <span>{myUsername} (You)</span>
              </div>
            </div>
          )}

          {Object.entries(voiceManager.videoStreams).map(([peerId]) => {
            const participant = participants.find((p) => p.peer_id === peerId);
            const name = participant?.username || peerId;
            return (
              <div key={peerId} className="voice-call-video-tile">
                <video
                  ref={(el) => {
                    if (el && voiceManager.videoStreams[peerId]) {
                      el.srcObject = voiceManager.videoStreams[peerId];
                    }
                  }}
                  autoPlay
                  playsInline
                  className="voice-call-video-element"
                />
                <div className="voice-call-video-label">
                  <span>{name}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`voice-call-participants ${hasVideoStreams ? "compact" : ""}`}
      >
        <div
          className={`voice-call-tile ${isSpeaking ? "speaking" : ""} ${isMuted ? "muted" : ""}`}
        >
          <div className="voice-call-tile-avatar-wrap">
            <div
              className={`voice-call-tile-speaking-ring ${isSpeaking ? "active" : ""}`}
            />
            <img
              src={avatarUrl(myUsername)}
              alt={myUsername}
              className="voice-call-tile-avatar"
            />
          </div>
          <div className="voice-call-tile-name">{myUsername} (You)</div>
          <div className="voice-call-tile-status">
            {isMuted ? (
              <Icon name="MicOff" size={14} />
            ) : isSpeaking ? (
              <Icon name="Mic" size={14} />
            ) : (
              <Icon name="Mic" size={14} />
            )}
          </div>
        </div>

        {participants.map((p) => (
          <div
            key={p.peer_id}
            className={`voice-call-tile ${p.speaking ? "speaking" : ""} ${p.muted ? "muted" : ""}`}
          >
            <div className="voice-call-tile-avatar-wrap">
              <div
                className={`voice-call-tile-speaking-ring ${p.speaking ? "active" : ""}`}
              />
              <img
                src={avatarUrl(p.username)}
                alt={p.username}
                className="voice-call-tile-avatar"
              />
            </div>
            <div className="voice-call-tile-name">{p.username}</div>
            <div className="voice-call-tile-status">
              {p.muted ? (
                <Icon name="MicOff" size={14} />
              ) : p.speaking ? (
                <Icon name="Mic" size={14} />
              ) : (
                <Icon name="Mic" size={14} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="voice-call-controls">
        <button
          className={`voice-call-control-btn ${isMuted ? "muted" : ""}`}
          onClick={() => voiceManager.toggleMute()}
          title={isMuted ? "Unmute" : "Mute"}
        >
          <Icon name={isMuted ? "MicOff" : "Mic"} size={22} />
        </button>
        <button
          className={`voice-call-control-btn ${isScreenSharing ? "active" : ""}`}
          onClick={() => voiceManager.toggleScreenShare()}
          title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
        >
          <Icon name={isScreenSharing ? "MonitorOff" : "Monitor"} size={22} />
        </button>
        <button
          className="voice-call-control-btn danger"
          onClick={() => voiceManager.leaveChannel()}
          title="Disconnect"
        >
          <Icon name="PhoneOff" size={22} />
        </button>
      </div>
    </div>
  );
}
