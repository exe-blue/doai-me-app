/**
 * jmuxer 타입 정의
 * @see https://github.com/nicobrinkkemper/jmuxer
 */

/// <reference types="node" />

declare module 'jmuxer' {
  interface JMuxerOptions {
    /** Video element */
    node: HTMLVideoElement | string;
    /** Mode: video, audio, both */
    mode?: 'video' | 'audio' | 'both';
    /** FPS for video playback */
    fps?: number;
    /** Buffer flushing time in ms */
    flushingTime?: number;
    /** Clear buffer on feed */
    clearBuffer?: boolean;
    /** Enable debug logging */
    debug?: boolean;
    /** Maximum delay in ms before dropping frames */
    maxDelay?: number;
    /** Read FPS from track metadata */
    readFpsFromTrack?: boolean;
    /** Called when jmuxer is ready */
    onReady?: () => void;
    /** Called on error (receives any data, not Error object) */
    onError?: (data: unknown) => void;
    /** Called when video frames are missing */
    onMissingVideoFrames?: (data: unknown) => void;
    /** Called when audio frames are missing */
    onMissingAudioFrames?: (data: unknown) => void;
  }

  interface FeedData {
    /** H.264 video data (NAL units) */
    video?: Uint8Array;
    /** AAC audio data */
    audio?: Uint8Array;
    /** Duration in ms */
    duration?: number;
    /** Composition time offset for B-frames */
    compositionTimeOffset?: number;
    /** Whether this is the last complete video frame */
    isLastVideoFrameComplete?: boolean;
  }

  class JMuxer {
    constructor(options: JMuxerOptions);
    /** Feed H.264/AAC data */
    feed(data: FeedData): void;
    /** Reset the player */
    reset(): void;
    /** Destroy the instance */
    destroy(): void;
    /** Create a writable stream for feeding data */
    createStream(): NodeJS.WritableStream;
  }

  export default JMuxer;
}
