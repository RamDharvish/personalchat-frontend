/**
 * Voice Note Audio Recording Service
 * Uses browser MediaRecorder API with automatic MIME type negotiation
 * and strict microphone track cleanup.
 */

export const MAX_RECORDING_DURATION_SECONDS = 300; // 5 minutes max

export interface VoiceRecordingResult {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  fileName: string;
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private activeMimeType = '';
  private isCurrentlyRecording = false;

  /**
   * Determine the best supported audio MIME type for the user's browser.
   */
  public getSupportedMimeType(): { mimeType: string; extension: string } {
    if (typeof MediaRecorder === 'undefined') {
      return { mimeType: 'audio/webm', extension: 'webm' };
    }

    const types = [
      { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
      { mimeType: 'audio/webm', extension: 'webm' },
      { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
      { mimeType: 'audio/mp4', extension: 'm4a' },
      { mimeType: 'audio/aac', extension: 'aac' },
    ];

    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t.mimeType)) {
        return t;
      }
    }

    return { mimeType: '', extension: 'webm' };
  }

  /**
   * Start recording from the user's microphone.
   */
  public async startRecording(
    onDurationUpdate: (seconds: number) => void,
    onMaxDurationReached: () => void
  ): Promise<void> {
    if (this.isCurrentlyRecording) {
      this.cancelRecording();
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Audio recording is not supported in this browser.');
    }

    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported in this browser.');
    }

    this.recordedChunks = [];
    const supported = this.getSupportedMimeType();
    this.activeMimeType = supported.mimeType;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (err: unknown) {
      const errorName = err instanceof Error ? err.name : '';
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        throw new Error('Microphone permission denied. Please allow microphone access to record voice notes.');
      }
      if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        throw new Error('No microphone device found on your system.');
      }
      throw new Error('Unable to access microphone.');
    }

    this.mediaStream = stream;

    const options: MediaRecorderOptions = {};
    if (this.activeMimeType) {
      options.mimeType = this.activeMimeType;
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch {
      // Fallback without explicit mimeType
      this.mediaRecorder = new MediaRecorder(stream);
      this.activeMimeType = this.mediaRecorder.mimeType || 'audio/webm';
    }

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.isCurrentlyRecording = true;

    // Start timer updating every 500ms
    onDurationUpdate(0);
    this.durationInterval = setInterval(() => {
      if (!this.isCurrentlyRecording) return;
      const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      onDurationUpdate(elapsedSeconds);

      if (elapsedSeconds >= MAX_RECORDING_DURATION_SECONDS) {
        onMaxDurationReached();
      }
    }, 500);

    // Request data in chunks every 500ms for smooth buffering
    this.mediaRecorder.start(500);
  }

  /**
   * Stop recording, release microphone tracks, and return the recorded audio Blob.
   */
  public async stopRecording(): Promise<VoiceRecordingResult> {
    if (!this.isCurrentlyRecording || !this.mediaRecorder) {
      throw new Error('No active voice recording to stop.');
    }

    return new Promise<VoiceRecordingResult>((resolve, reject) => {
      const recorder = this.mediaRecorder!;
      const totalDurationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

      recorder.onstop = () => {
        try {
          const finalMimeType = this.activeMimeType || recorder.mimeType || 'audio/webm';
          const blob = new Blob(this.recordedChunks, { type: finalMimeType });

          const supported = this.getSupportedMimeType();
          const fileName = `voice-message-${Date.now()}.${supported.extension}`;

          this.cleanup();

          resolve({
            blob,
            mimeType: finalMimeType,
            durationSeconds: totalDurationSeconds,
            fileName,
          });
        } catch (err) {
          this.cleanup();
          reject(err);
        }
      };

      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          recorder.onstop(new Event('stop'));
        }
      } catch (err) {
        this.cleanup();
        reject(err);
      }
    });
  }

  /**
   * Cancel and discard recording, releasing all tracks immediately.
   */
  public cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore stop error
      }
    }
    this.cleanup();
  }

  public isRecording(): boolean {
    return this.isCurrentlyRecording;
  }

  private cleanup(): void {
    this.isCurrentlyRecording = false;

    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop error
        }
      });
      this.mediaStream = null;
    }

    this.mediaRecorder = null;
    this.recordedChunks = [];
  }
}

export const voiceRecorder = new VoiceRecorder();
