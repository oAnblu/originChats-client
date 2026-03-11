import Peer from "peerjs";
import type { MediaConnection } from "peerjs";
import { wsSend } from "./lib/websocket";
import {
  serverUrl,
  micThreshold as micThresholdSignal,
  voiceVideoRes,
  voiceVideoFps,
} from "./state";
import {
  renderVoiceSignal,
  renderChannelsSignal,
  showVoiceCallView,
} from "./lib/ui-signals";

export interface VoiceParticipant {
  username: string;
  peer_id: string;
  muted: boolean;
  speaking: boolean;
}

export class VoiceManagerClass {
  peer: Peer | null = null;
  private _peerReady: Promise<Peer> | null = null;

  calls: Record<string, MediaConnection> = {};
  streams: Record<string, MediaStream> = {};
  localStream: MediaStream | null = null;

  videoStream: MediaStream | null = null;
  videoCalls: Record<string, MediaConnection> = {};
  videoStreams: Record<string, MediaStream> = {};

  participants: VoiceParticipant[] = [];

  currentChannel: string | null = null;
  isMuted = false;
  isSpeaking = false;
  micDenied = false;

  private _myUsername: string | null = null;

  private localAudioContext: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localAnimFrameId: number | null = null;
  private remoteSpeakingDetectors: Map<
    string,
    { ctx: AudioContext; analyser: AnalyserNode; frameId: number }
  > = new Map();

  streamRes: number;
  streamFps: number;

  micThreshold: number;

  constructor() {
    this.micThreshold = micThresholdSignal.value;
    this.streamRes = voiceVideoRes.value;
    this.streamFps = voiceVideoFps.value;
  }

  private initPeer(): Promise<Peer> {
    if (this._peerReady && this.peer && !this.peer.destroyed) {
      return this._peerReady;
    }

    this._peerReady = new Promise<Peer>((resolve, reject) => {
      try {
        const peer = new Peer({
          debug: 0,
          config: {
            iceTransportPolicy: "relay",
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              {
                urls: "turn:free.expressturn.com:3478",
                username: "000000002088393795",
                credential: "82ycGu9kC/rKWJvfFicKScjmtxw=",
              },
            ],
          },
        });

        peer.on("open", () => {
          this.peer = peer;
          resolve(peer);
        });

        peer.on("error", (err: Error) => {
          console.error("[Voice] PeerJS error:", err);
          if (!this.peer) reject(err);
        });

        peer.on("call", (call: MediaConnection) => {
          call.answer(this.localStream || new MediaStream());

          call.on("stream", (stream: MediaStream) => {
            if (stream.getVideoTracks().length > 0) {
              this.videoCalls[call.peer] = call;
              this.videoStreams[call.peer] = stream;
              this._rerender();
            } else {
              this.calls[call.peer] = call;
              this.streams[call.peer] = stream;
              this._playStream(call.peer, stream);
              this._setupRemoteSpeakingDetection(call.peer, stream);
            }
          });

          call.on("close", () => {
            delete this.videoStreams[call.peer];
            delete this.videoCalls[call.peer];
            this._detachPeer(call.peer);
          });

          call.on("error", () => {
            this._detachPeer(call.peer);
          });
        });
      } catch (error) {
        console.error("[Voice] Failed to initialize PeerJS:", error);
        reject(error);
      }
    });

    return this._peerReady;
  }

  async joinChannel(
    channelName: string,
    myUsername?: string,
  ): Promise<boolean> {
    if (this.currentChannel === channelName) {
      showVoiceCallView.value = !showVoiceCallView.value;
      return true;
    }

    if (this.currentChannel) {
      this.leaveChannel();
    }

    if (myUsername) {
      this._myUsername = myUsername;
    }

    this.micDenied = false;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch {
      this.micDenied = true;
      try {
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        this.localStream = dest.stream;
      } catch {
        this.localStream = new MediaStream();
      }
    }

    let peer: Peer;
    try {
      peer = await this.initPeer();
    } catch {
      console.error("[Voice] Voice connection failed");
      return false;
    }

    const myPeerId = peer.id;
    if (!myPeerId) {
      console.error("[Voice] No peer ID");
      return false;
    }

    wsSend(
      { cmd: "voice_join", channel: channelName, peer_id: myPeerId },
      serverUrl.value,
    );

    this.currentChannel = channelName;
    this.isMuted = this.micDenied;

    if (this.micDenied) {
      this.localStream?.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
      wsSend({ cmd: "voice_mute" }, serverUrl.value);
    } else {
      this._setupLocalSpeakingDetection();
    }

    showVoiceCallView.value = true;
    this._rerender();

    return true;
  }

  onJoined(channel: string, participants: VoiceParticipant[]): void {
    if (this.currentChannel !== channel) return;
    this.participants = (participants || []).map((p) => ({
      ...p,
      speaking: false,
    }));

    for (const p of this.participants) {
      if (!p.peer_id || this.calls[p.peer_id]) continue;
      if (p.peer_id === this.peer?.id) continue;
      if (!this.localStream) continue;
      const call = this.peer!.call(p.peer_id, this.localStream);
      if (call) this._attachAudioCall(call);
    }

    if (this.peer?.id) {
      const myParticipant: VoiceParticipant = {
        username: this._myUsername || "You",
        peer_id: this.peer.id,
        muted: this.isMuted,
        speaking: this.isSpeaking,
      };
      if (!this.participants.find((p) => p.peer_id === this.peer?.id)) {
        this.participants.unshift(myParticipant);
      }
    }

    this._rerender();
  }

  getAllParticipants(): VoiceParticipant[] {
    return this.participants;
  }

  setMyUsername(username: string): void {
    this._myUsername = username;
    if (this.peer?.id) {
      const me = this.participants.find((p) => p.peer_id === this.peer?.id);
      if (me) {
        me.username = username;
      }
    }
  }

  onUserJoined(
    channel: string,
    user: { username: string; peer_id: string; muted: boolean },
  ): void {
    if (!this.currentChannel || this.currentChannel !== channel) return;
    if (!user.peer_id) return;

    if (!this.participants.find((p) => p.peer_id === user.peer_id)) {
      this.participants.push({
        username: user.username,
        peer_id: user.peer_id,
        muted: user.muted,
        speaking: false,
      });
    }

    if (!this.calls[user.peer_id] && this.localStream && this.peer) {
      const call = this.peer.call(user.peer_id, this.localStream);
      if (call) this._attachAudioCall(call);
    }

    if (this.videoStream && this.peer) {
      const vcall = this.peer.call(user.peer_id, this.videoStream);
      if (vcall) this.videoCalls[user.peer_id] = vcall;
    }

    this._rerender();
  }

  onUserLeft(channel: string, username: string): void {
    if (!this.currentChannel || this.currentChannel !== channel) return;
    const p = this.participants.find((p) => p.username === username);
    if (p) this._detachPeer(p.peer_id);
    this.participants = this.participants.filter(
      (p) => p.username !== username,
    );
    this._rerender();
  }

  onUserUpdated(
    channel: string,
    user: { username: string; peer_id?: string; muted: boolean },
  ): void {
    if (!this.currentChannel || this.currentChannel !== channel) return;
    // Match by peer_id first (more reliable), fall back to username
    const p = this.participants.find(
      (p) =>
        (user.peer_id && p.peer_id === user.peer_id) ||
        p.username === user.username,
    );
    if (p) {
      p.muted = user.muted;
      // Keep username in sync in case our self-entry was stored as "You"
      if (user.username && p.username === "You") {
        p.username = user.username;
      }
    }
    this._rerender();
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;

    if (this.localStream) {
      this.localStream
        .getAudioTracks()
        .forEach((t) => (t.enabled = !this.isMuted));
    }

    if (this.peer?.id) {
      const me = this.participants.find((p) => p.peer_id === this.peer?.id);
      if (me) {
        me.muted = this.isMuted;
      }
    }

    const sent = wsSend(
      { cmd: this.isMuted ? "voice_mute" : "voice_unmute" },
      serverUrl.value,
    );
    if (!sent) {
      console.warn("[Voice] Failed to send mute state — WebSocket not open");
    }
    this._rerender();
  }

  async toggleScreenShare(): Promise<void> {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((t) => t.stop());
      this.videoStream = null;
      Object.values(this.videoCalls).forEach((c) => {
        try {
          c.close();
        } catch {}
      });
      this.videoCalls = {};
      this._rerender();
      return;
    }

    const constraints = this._qualityConstraints();
    try {
      this.videoStream = await navigator.mediaDevices.getDisplayMedia({
        video: constraints,
        audio: true,
      });
    } catch {
      try {
        this.videoStream = await navigator.mediaDevices.getUserMedia({
          video: constraints,
          audio: false,
        });
      } catch {
        console.error("[Voice] Could not get video");
        return;
      }
    }

    const videoTrack = this.videoStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        if (this.videoStream) this.toggleScreenShare();
      };
    }

    for (const p of this.participants) {
      if (!p.peer_id || !this.peer) continue;
      if (p.peer_id === this.peer.id) continue;
      const call = this.peer.call(p.peer_id, this.videoStream);
      if (call) this.videoCalls[p.peer_id] = call;
    }

    this._rerender();
  }

  leaveChannel(): void {
    wsSend({ cmd: "voice_leave" }, serverUrl.value);
    this._cleanup();
    this.currentChannel = null;
    showVoiceCallView.value = false;
    this._rerender();
  }

  isInChannel(): boolean {
    return this.currentChannel !== null;
  }

  getMyPeerId(): string | null {
    return this.peer?.id || null;
  }

  private _attachAudioCall(call: MediaConnection): void {
    this.calls[call.peer] = call;

    call.on("stream", (stream: MediaStream) => {
      this.streams[call.peer] = stream;
      this._playStream(call.peer, stream);
      this._setupRemoteSpeakingDetection(call.peer, stream);
    });

    call.on("close", () => this._detachPeer(call.peer));
    call.on("error", () => this._detachPeer(call.peer));
  }

  private _playStream(peerId: string, stream: MediaStream): void {
    let audio = document.getElementById(
      "vcaudio-" + peerId,
    ) as HTMLAudioElement | null;
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "vcaudio-" + peerId;
      audio.autoplay = true;
      audio.style.display = "none";
      document.body.appendChild(audio);
    }
    audio.srcObject = stream;
  }

  private _detachPeer(peerId: string): void {
    if (this.calls[peerId]) {
      try {
        this.calls[peerId].close();
      } catch {}
      delete this.calls[peerId];
    }
    delete this.streams[peerId];

    if (this.videoCalls[peerId]) {
      try {
        this.videoCalls[peerId].close();
      } catch {}
      delete this.videoCalls[peerId];
    }
    delete this.videoStreams[peerId];

    const audio = document.getElementById("vcaudio-" + peerId);
    if (audio) audio.remove();

    this._stopRemoteSpeakingDetection(peerId);
  }

  private _cleanup(): void {
    Object.values(this.calls).forEach((c) => {
      try {
        c.close();
      } catch {}
    });
    this.calls = {};
    this.streams = {};

    Object.values(this.videoCalls).forEach((c) => {
      try {
        c.close();
      } catch {}
    });
    this.videoCalls = {};
    this.videoStreams = {};

    if (this.videoStream) {
      this.videoStream.getTracks().forEach((t) => t.stop());
      this.videoStream = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    document.querySelectorAll('[id^="vcaudio-"]').forEach((a) => a.remove());

    this._stopLocalSpeakingDetection();
    for (const peerId of this.remoteSpeakingDetectors.keys()) {
      this._stopRemoteSpeakingDetection(peerId);
    }

    this.participants = [];
    this.isMuted = false;
    this.isSpeaking = false;
    this.micDenied = false;
    this._myUsername = null;
  }

  private _setupLocalSpeakingDetection(): void {
    if (!this.localStream) return;
    this._stopLocalSpeakingDetection();

    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(this.localStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      this.localAudioContext = audioCtx;
      this.localAnalyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const check = () => {
        if (!this.localAnalyser) return;
        try {
          analyser.getByteFrequencyData(dataArray);
          const average =
            (dataArray.reduce((a, b) => a + b, 0) / dataArray.length) *
            (100 / 255);
          const speaking = average > this.micThreshold && !this.isMuted;
          if (speaking !== this.isSpeaking) {
            this.isSpeaking = speaking;

            if (this.peer?.id) {
              const me = this.participants.find(
                (p) => p.peer_id === this.peer?.id,
              );
              if (me) {
                me.speaking = speaking;
              }
            }

            this._rerender();
          }
        } catch {}
        this.localAnimFrameId = requestAnimationFrame(check);
      };
      this.localAnimFrameId = requestAnimationFrame(check);
    } catch (e) {
      console.error("[Voice] Failed local speaking detection:", e);
    }
  }

  private _stopLocalSpeakingDetection(): void {
    if (this.localAnimFrameId) {
      cancelAnimationFrame(this.localAnimFrameId);
      this.localAnimFrameId = null;
    }
    if (this.localAudioContext) {
      try {
        this.localAudioContext.close();
      } catch {}
      this.localAudioContext = null;
    }
    this.localAnalyser = null;
    this.isSpeaking = false;
  }

  private _setupRemoteSpeakingDetection(
    peerId: string,
    stream: MediaStream,
  ): void {
    this._stopRemoteSpeakingDetection(peerId);

    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const check = () => {
        try {
          analyser.getByteFrequencyData(dataArray);
          const average =
            (dataArray.reduce((a, b) => a + b, 0) / dataArray.length) *
            (100 / 255);
          const speaking = average > 15;

          const participant = this.participants.find(
            (p) => p.peer_id === peerId,
          );
          if (participant && participant.speaking !== speaking) {
            participant.speaking = speaking;
            this._rerender();
          }
        } catch {}

        const det = this.remoteSpeakingDetectors.get(peerId);
        if (det) {
          det.frameId = requestAnimationFrame(check);
        }
      };

      const frameId = requestAnimationFrame(check);
      this.remoteSpeakingDetectors.set(peerId, { ctx, analyser, frameId });
    } catch (e) {
      console.error("[Voice] Failed remote speaking detection:", e);
    }
  }

  private _stopRemoteSpeakingDetection(peerId: string): void {
    const det = this.remoteSpeakingDetectors.get(peerId);
    if (det) {
      cancelAnimationFrame(det.frameId);
      try {
        det.ctx.close();
      } catch {}
      this.remoteSpeakingDetectors.delete(peerId);
    }
  }

  private _qualityConstraints(): MediaTrackConstraints {
    const h = this.streamRes;
    const w =
      h === 2160
        ? 3840
        : h === 1440
          ? 2560
          : h === 1080
            ? 1920
            : h === 720
              ? 1280
              : 854;
    return {
      width: { ideal: w },
      height: { ideal: h },
      frameRate: { ideal: this.streamFps, max: this.streamFps },
    };
  }

  private _rerender(): void {
    renderVoiceSignal.value++;
    renderChannelsSignal.value++;
  }
}

export const voiceManager = new VoiceManagerClass();
(window as any).voiceManager = voiceManager;
