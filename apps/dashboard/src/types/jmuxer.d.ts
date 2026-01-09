/**
 * jmuxer 타입 선언
 * @see https://github.com/niclegend/jmuxer
 */
declare module 'jmuxer' {
  interface Feeder {
    video?: Uint8Array;
    audio?: Uint8Array;
    duration?: number;
  }

  interface JMuxerOptions {
    node: HTMLVideoElement | string;
    mode?: 'video' | 'audio' | 'both';
    flushingTime?: number;
    fps?: number;
    debug?: boolean;
    clearBuffer?: boolean;
    
    // 추가 옵션들
    videoCodec?: string;
    maxDelay?: number;
    readFpsFromTrack?: boolean;
    
    // 콜백 함수들
    onReady?: () => void;
    onError?: (data: unknown) => void;  // upstream API에 맞춤: any 대신 unknown 사용
    onMissingVideoFrames?: (data: Feeder) => void;
    onMissingAudioFrames?: (data: Feeder) => void;
    onData?: (data: Uint8Array) => void;
  }

  interface FeedData {
    video?: Uint8Array;
    audio?: Uint8Array;
    duration?: number;
  }

  export default class JMuxer {
    constructor(options: JMuxerOptions);
    feed(data: FeedData): void;
    destroy(): void;
  }
}
