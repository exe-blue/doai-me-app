/**
 * JMuxer Type Definitions
 * H.264 Video Decoder for Browser
 */

declare module 'jmuxer' {
  export interface JMuxerOptions {
    node: HTMLCanvasElement | HTMLVideoElement | string;
    mode?: 'video' | 'audio' | 'both';
    flushingTime?: number;
    fps?: number;
    debug?: boolean;
    maxDelay?: number;
    clearBuffer?: boolean;
    onReady?: () => void;
    onError?: (error: any) => void;
    onMissingVideoFrames?: (data: any) => void;
    onMissingAudioFrames?: (data: any) => void;
  }

  export interface FeedData {
    video?: Uint8Array;
    audio?: Uint8Array;
    duration?: number;
  }

  export default class JMuxer {
    constructor(options: JMuxerOptions);
    feed(data: FeedData): void;
    destroy(): void;
    reset(): void;
  }
}

