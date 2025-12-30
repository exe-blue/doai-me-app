/**
 * 휴먼 패턴 모듈 (AutoX.js / Laixi)
 * 
 * PDF 문서 기반 실제 사용자 행동 시뮬레이션
 * - Beta 분포 기반 시청 시간
 * - 정규분포 터치 오프셋
 * - Ease-in-out 스와이프
 * - 자연스러운 타이핑
 */

// ==================== 수학 유틸리티 ====================

/**
 * Beta 분포 난수 생성 (Box-Muller 변환 사용)
 * @param {number} alpha - 알파 파라미터 (기본: 2)
 * @param {number} beta - 베타 파라미터 (기본: 5)
 * @returns {number} 0~1 사이의 Beta 분포 난수
 */
function betaRandom(alpha, beta) {
    alpha = alpha || 2;
    beta = beta || 5;
    
    // Gamma 분포를 이용한 Beta 분포 생성
    var gammaA = gammaRandom(alpha);
    var gammaB = gammaRandom(beta);
    
    return gammaA / (gammaA + gammaB);
}

/**
 * Gamma 분포 난수 생성 (Marsaglia and Tsang 방법)
 */
function gammaRandom(shape) {
    if (shape < 1) {
        return gammaRandom(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }
    
    var d = shape - 1/3;
    var c = 1 / Math.sqrt(9 * d);
    
    while (true) {
        var x, v;
        do {
            x = gaussianRandom();
            v = 1 + c * x;
        } while (v <= 0);
        
        v = v * v * v;
        var u = Math.random();
        
        if (u < 1 - 0.0331 * (x * x) * (x * x)) {
            return d * v;
        }
        
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
            return d * v;
        }
    }
}

/**
 * 정규분포 난수 생성 (Box-Muller)
 */
function gaussianRandom(mean, std) {
    mean = mean || 0;
    std = std || 1;
    
    var u1 = Math.random();
    var u2 = Math.random();
    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    return mean + std * z;
}

/**
 * 범위 내 랜덤 정수
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 범위 내 랜덤 실수
 */
function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * 값을 범위 내로 제한
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


// ==================== 시청 패턴 ====================

/**
 * 시청 패턴 설정
 */
var WatchConfig = {
    // Beta 분포 파라미터 (alpha=2, beta=5: 초반 이탈 많음)
    alpha: 2.0,
    beta: 5.0,
    
    // 최소 시청 시간 (초)
    minWatchSeconds: 10,
    
    // 완전 시청 확률 (5%)
    fullWatchProbability: 0.05,
    
    // Seek 설정
    seekEnabled: true,
    seekCountMin: 5,
    seekCountMax: 20
};

/**
 * 시청 시간 생성 (Beta 분포 기반)
 * @param {number} videoDuration - 영상 전체 길이 (초)
 * @returns {Object} { watchTime, watchPercent, isFullWatch, seekCount, seekTimings }
 */
function generateWatchPattern(videoDuration) {
    var watchTime, isFullWatch = false;
    
    // 5% 확률로 완전 시청
    if (Math.random() < WatchConfig.fullWatchProbability) {
        watchTime = videoDuration;
        isFullWatch = true;
    } else {
        // Beta 분포로 시청 비율 결정
        var ratio = betaRandom(WatchConfig.alpha, WatchConfig.beta);
        watchTime = Math.max(WatchConfig.minWatchSeconds, ratio * videoDuration);
        watchTime = Math.min(watchTime, videoDuration);
    }
    
    watchTime = Math.floor(watchTime);
    var watchPercent = (watchTime / videoDuration) * 100;
    
    // Seek 횟수 및 타이밍
    var seekCount = 0;
    var seekTimings = [];
    
    if (WatchConfig.seekEnabled && watchTime > 30) {
        seekCount = randomInt(WatchConfig.seekCountMin, WatchConfig.seekCountMax);
        seekTimings = generateSeekTimings(watchTime, seekCount);
    }
    
    return {
        watchTime: watchTime,
        watchPercent: Math.round(watchPercent * 100) / 100,
        isFullWatch: isFullWatch,
        seekCount: seekCount,
        seekTimings: seekTimings
    };
}

/**
 * Seek 타이밍 생성
 */
function generateSeekTimings(watchTime, seekCount) {
    if (seekCount === 0 || watchTime < 10) return [];
    
    var interval = watchTime / (seekCount + 1);
    var timings = [];
    
    for (var i = 1; i <= seekCount; i++) {
        var baseTime = interval * i;
        var variation = interval * 0.2;
        var actualTime = baseTime + randomFloat(-variation, variation);
        actualTime = clamp(actualTime, 10, watchTime - 5);
        timings.push(Math.floor(actualTime));
    }
    
    // 정렬 및 중복 제거
    timings.sort(function(a, b) { return a - b; });
    return timings.filter(function(v, i, arr) { return i === 0 || v !== arr[i-1]; });
}


// ==================== 터치 패턴 ====================

/**
 * 터치 패턴 설정
 */
var TouchConfig = {
    // 위치 분산 (버튼 크기의 1/6)
    positionStdRatio: 0.167,
    
    // 터치 지속 시간 (ms)
    durationMin: 50,
    durationMax: 200,
    durationMean: 100,
    durationStd: 30,
    
    // 더블 탭 간격 (ms)
    doubleTapIntervalMin: 100,
    doubleTapIntervalMax: 300
};

/**
 * 자연스러운 터치 좌표 생성
 * @param {number} x - 요소 좌상단 X
 * @param {number} y - 요소 좌상단 Y
 * @param {number} width - 요소 너비
 * @param {number} height - 요소 높이
 * @returns {Object} { tapX, tapY, duration, offsetX, offsetY }
 */
function generateNaturalTap(x, y, width, height) {
    var centerX = x + width / 2;
    var centerY = y + height / 2;
    
    // 정규분포로 중심 근처 랜덤
    var stdX = width * TouchConfig.positionStdRatio;
    var stdY = height * TouchConfig.positionStdRatio;
    
    var tapX = gaussianRandom(centerX, stdX);
    var tapY = gaussianRandom(centerY, stdY);
    
    // 요소 범위 내로 클리핑 (마진 5px)
    var margin = 5;
    tapX = clamp(tapX, x + margin, x + width - margin);
    tapY = clamp(tapY, y + margin, y + height - margin);
    
    tapX = Math.floor(tapX);
    tapY = Math.floor(tapY);
    
    // 터치 지속 시간
    var duration = gaussianRandom(TouchConfig.durationMean, TouchConfig.durationStd);
    duration = clamp(duration, TouchConfig.durationMin, TouchConfig.durationMax);
    
    return {
        tapX: tapX,
        tapY: tapY,
        duration: Math.floor(duration),
        offsetX: tapX - Math.floor(centerX),
        offsetY: tapY - Math.floor(centerY)
    };
}

/**
 * 자연스러운 클릭 실행
 */
function naturalClick(x, y, width, height) {
    width = width || 100;
    height = height || 50;
    
    var tap = generateNaturalTap(x - width/2, y - height/2, width, height);
    
    // press 사용 (지속 시간 적용)
    press(tap.tapX, tap.tapY, tap.duration);
    
    return tap;
}

/**
 * 더블 탭 실행 (Seek용)
 */
function naturalDoubleTap(x, y, width, height) {
    width = width || 200;
    height = height || 400;
    
    var tap1 = generateNaturalTap(x - width/2, y - height/2, width, height);
    var tap2 = generateNaturalTap(x - width/2, y - height/2, width, height);
    var interval = randomInt(TouchConfig.doubleTapIntervalMin, TouchConfig.doubleTapIntervalMax);
    
    click(tap1.tapX, tap1.tapY);
    sleep(interval);
    click(tap2.tapX, tap2.tapY);
    
    return { tap1: tap1, tap2: tap2, interval: interval };
}


// ==================== 스크롤/스와이프 패턴 ====================

/**
 * 스크롤 패턴 설정
 */
var ScrollConfig = {
    // 스와이프 지속 시간 (ms)
    durationMin: 200,
    durationMax: 600,
    
    // 노이즈 (무작위 흔들림)
    noiseEnabled: true,
    noiseStd: 2.0,
    
    // 스크롤 후 대기 시간 (ms)
    pauseAfterMin: 500,
    pauseAfterMax: 2000,
    
    // Shorts 스크롤 타이밍 분포
    instantSkipProbability: 0.25,
    shortViewProbability: 0.30
};

/**
 * Smoothstep 이징 함수
 */
function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

/**
 * Ease-in-out 커브가 적용된 스와이프 경로 생성
 * @returns {Array} [{x, y, timestamp}, ...]
 */
function generateSwipePath(startX, startY, endX, endY, duration) {
    duration = duration || randomInt(ScrollConfig.durationMin, ScrollConfig.durationMax);
    
    var steps = Math.max(Math.floor(duration / 10), 5);
    var path = [];
    
    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var easeT = smoothstep(t);
        
        var x = startX + (endX - startX) * easeT;
        var y = startY + (endY - startY) * easeT;
        
        // 노이즈 추가 (시작/끝 제외)
        if (ScrollConfig.noiseEnabled && i > 0 && i < steps) {
            x += gaussianRandom(0, ScrollConfig.noiseStd);
            y += gaussianRandom(0, ScrollConfig.noiseStd);
        }
        
        path.push({
            x: Math.floor(x),
            y: Math.floor(y),
            timestamp: Math.floor((duration * i) / steps)
        });
    }
    
    return path;
}

/**
 * 자연스러운 스와이프 실행
 */
function naturalSwipe(startX, startY, endX, endY, duration) {
    duration = duration || randomInt(ScrollConfig.durationMin, ScrollConfig.durationMax);
    
    var path = generateSwipePath(startX, startY, endX, endY, duration);
    
    // gesture API 사용
    var points = [duration];  // 첫 번째 요소는 총 시간
    for (var i = 0; i < path.length; i++) {
        points.push([path[i].x, path[i].y]);
    }
    
    gesture.apply(null, points);
    
    // 스와이프 후 대기
    var pauseAfter = randomInt(ScrollConfig.pauseAfterMin, ScrollConfig.pauseAfterMax);
    sleep(pauseAfter);
    
    return {
        path: path,
        duration: duration,
        pauseAfter: pauseAfter
    };
}

/**
 * 아래로 스크롤 (위로 스와이프) - Shorts/TikTok용
 */
function naturalScrollDown(screenWidth, screenHeight) {
    screenWidth = screenWidth || 1080;
    screenHeight = screenHeight || 2280;
    
    var centerX = Math.floor(screenWidth / 2);
    var startY = Math.floor(screenHeight * 0.7);
    var endY = Math.floor(screenHeight * 0.3);
    
    // X 좌표 약간의 변화
    var xVariation = Math.floor(screenWidth * 0.1);
    var startX = centerX + randomInt(-xVariation, xVariation);
    var endX = centerX + randomInt(-xVariation, xVariation);
    
    return naturalSwipe(startX, startY, endX, endY);
}

/**
 * Shorts 스크롤 타이밍 생성 (초)
 */
function generateShortsScrollTiming() {
    var rand = Math.random();
    
    if (rand < ScrollConfig.instantSkipProbability) {
        // 즉시 스킵 (0.5-1.5초)
        return randomFloat(0.5, 1.5);
    } else if (rand < ScrollConfig.instantSkipProbability + ScrollConfig.shortViewProbability) {
        // 짧게 시청 (1.5-3.5초)
        return randomFloat(1.5, 3.5);
    } else if (rand < 0.83) {
        // 중간 시청 (3.5-10초)
        return randomFloat(3.5, 10);
    } else {
        // 완전 시청 (10-30초)
        return randomFloat(10, 30);
    }
}


// ==================== 인터랙션 패턴 ====================

/**
 * 인터랙션 패턴 설정
 */
var InteractionConfig = {
    // 좋아요 확률 범위
    likeRateMin: 0.20,
    likeRateMax: 0.70,
    
    // 좋아요 타이밍 분포
    likeTiming: {
        immediate: 0.02,   // 즉시 (5초 이내)
        middle: 0.35,      // 시청 중간
        after: 0.45,       // 시청 완료 직후
        delayed: 0.18      // 10초+ 후
    },
    
    // 댓글 확률 범위
    commentRateMin: 0.10,
    commentRateMax: 0.50,
    
    // 댓글 템플릿
    commentTemplates: [
        "좋은 영상이네요!",
        "정말 유익합니다",
        "잘 봤습니다 👍",
        "도움이 많이 됐어요",
        "감사합니다!"
    ]
};

/**
 * 인터랙션 패턴 생성
 * @param {number} watchTime - 시청 시간 (초)
 * @returns {Object} { shouldLike, likeTiming, shouldComment, commentTiming, commentText }
 */
function generateInteractionPattern(watchTime) {
    // 좋아요 확률 (세션별 랜덤)
    var likeRate = randomFloat(InteractionConfig.likeRateMin, InteractionConfig.likeRateMax);
    var shouldLike = Math.random() < likeRate;
    
    // 댓글 확률 (세션별 랜덤)
    var commentRate = randomFloat(InteractionConfig.commentRateMin, InteractionConfig.commentRateMax);
    var shouldComment = Math.random() < commentRate;
    
    var likeTiming = null;
    var commentTiming = null;
    var commentText = null;
    
    if (shouldLike) {
        likeTiming = generateLikeTiming(watchTime);
    }
    
    if (shouldComment) {
        commentTiming = Math.floor(watchTime + randomFloat(5, 15));
        var idx = randomInt(0, InteractionConfig.commentTemplates.length - 1);
        commentText = InteractionConfig.commentTemplates[idx];
    }
    
    return {
        shouldLike: shouldLike,
        likeTiming: likeTiming,
        shouldComment: shouldComment,
        commentTiming: commentTiming,
        commentText: commentText
    };
}

/**
 * 좋아요 타이밍 생성 (PDF 문서 분포 기반)
 */
function generateLikeTiming(watchTime) {
    var rand = Math.random();
    var timing = InteractionConfig.likeTiming;
    
    if (rand < timing.immediate) {
        // 즉시 (3-5초)
        return Math.floor(randomFloat(3, Math.min(5, watchTime)));
    } else if (rand < timing.immediate + timing.middle) {
        // 시청 중간 (40-60%)
        return Math.floor(watchTime * randomFloat(0.4, 0.6));
    } else if (rand < timing.immediate + timing.middle + timing.after) {
        // 시청 완료 직후 (1-3초 후)
        return Math.floor(watchTime + randomFloat(1, 3));
    } else {
        // 지연 (10-30초 후)
        return Math.floor(watchTime + randomFloat(10, 30));
    }
}


// ==================== 타이핑 패턴 ====================

/**
 * 타이핑 설정 - Aria's Somatic Engine
 * "떨리는 손끝과 망설이는 마음을 선물하는 설정"
 */
var TypingConfig = {
    // 글자당 딜레이 (ms)
    charDelayMin: 80,
    charDelayMax: 200,
    charDelayMean: 120,
    charDelayStd: 40,
    
    // === Typo Engine (오타 엔진) ===
    // 5% 확률로 오타 발생 후 Backspace로 수정
    typoProbability: 0.05,
    typoCorrectDelayMin: 200,   // 오타 인식까지 딜레이
    typoCorrectDelayMax: 800,
    backspaceDelayMin: 50,      // 백스페이스 속도
    backspaceDelayMax: 150,
    
    // 인접 키 매핑 (QWERTY 키보드)
    adjacentKeys: {
        'a': ['s', 'q', 'w', 'z'],
        'b': ['v', 'g', 'h', 'n'],
        'c': ['x', 'd', 'f', 'v'],
        'd': ['s', 'e', 'r', 'f', 'c', 'x'],
        'e': ['w', 'r', 'd', 's'],
        'f': ['d', 'r', 't', 'g', 'v', 'c'],
        'g': ['f', 't', 'y', 'h', 'b', 'v'],
        'h': ['g', 'y', 'u', 'j', 'n', 'b'],
        'i': ['u', 'o', 'k', 'j'],
        'j': ['h', 'u', 'i', 'k', 'm', 'n'],
        'k': ['j', 'i', 'o', 'l', 'm'],
        'l': ['k', 'o', 'p'],
        'm': ['n', 'j', 'k'],
        'n': ['b', 'h', 'j', 'm'],
        'o': ['i', 'p', 'l', 'k'],
        'p': ['o', 'l'],
        'q': ['w', 'a'],
        'r': ['e', 't', 'f', 'd'],
        's': ['a', 'w', 'e', 'd', 'x', 'z'],
        't': ['r', 'y', 'g', 'f'],
        'u': ['y', 'i', 'j', 'h'],
        'v': ['c', 'f', 'g', 'b'],
        'w': ['q', 'e', 's', 'a'],
        'x': ['z', 's', 'd', 'c'],
        'y': ['t', 'u', 'h', 'g'],
        'z': ['a', 's', 'x']
    },
    
    // 단어 간 추가 딜레이
    wordPauseMin: 100,
    wordPauseMax: 400,
    
    // === Thinking Time (망설임) ===
    // 입력 중 멈칫하는 "생각하는 시간"
    thinkPauseProbability: 0.15,
    thinkPauseMin: 500,
    thinkPauseMax: 2500,
    
    // === Rewrite Behavior (다시 쓰기) ===
    // 전체 삭제 후 다시 쓰는 비효율적 행동
    rewriteProbability: 0.08,
    rewriteDelayMin: 300,
    rewriteDelayMax: 1000
};

/**
 * 인접 키에서 오타 문자 생성
 * @param {string} char - 원래 문자
 * @returns {string} 오타 문자 또는 원래 문자
 */
function getTypoChar(char) {
    var lowerChar = char.toLowerCase();
    var adjacents = TypingConfig.adjacentKeys[lowerChar];
    
    if (!adjacents || adjacents.length === 0) {
        return char;
    }
    
    var typoChar = adjacents[randomInt(0, adjacents.length - 1)];
    
    // 원래 대소문자 유지
    if (char === char.toUpperCase()) {
        return typoChar.toUpperCase();
    }
    return typoChar;
}

/**
 * Backspace 키 시뮬레이션
 * @param {UiObject} input - 입력 필드
 * @param {number} count - 삭제할 문자 수
 * @param {string} currentText - 현재 텍스트
 * @returns {string} 삭제 후 텍스트
 */
function simulateBackspace(input, count, currentText) {
    for (var i = 0; i < count; i++) {
        var delay = randomInt(TypingConfig.backspaceDelayMin, TypingConfig.backspaceDelayMax);
        sleep(delay);
        currentText = currentText.slice(0, -1);
        input.setText(currentText);
    }
    return currentText;
}

/**
 * 자연스러운 타이핑 실행 - Aria's Somatic Engine
 * "떨리는 손끝으로 글자를 치고, 실수하고, 다시 고치는 인간적 행동"
 * 
 * @param {UiObject} input - 입력 필드
 * @param {string} text - 입력할 텍스트
 * @returns {Object} { typed, typoCount, rewriteCount, thinkPauses }
 */
function naturalTyping(input, text) {
    if (!input) return { typed: '', typoCount: 0, rewriteCount: 0, thinkPauses: 0 };
    
    input.click();
    sleep(500);
    
    // === Rewrite Behavior (다시 쓰기) ===
    // 8% 확률로 처음부터 전체 삭제 후 다시 쓰기
    var rewriteCount = 0;
    if (Math.random() < TypingConfig.rewriteProbability) {
        // 일부만 먼저 입력
        var partialLength = randomInt(3, Math.min(10, text.length));
        var partialText = text.substring(0, partialLength);
        
        for (var p = 0; p < partialText.length; p++) {
            var charDelay = gaussianRandom(TypingConfig.charDelayMean, TypingConfig.charDelayStd);
            sleep(Math.floor(clamp(charDelay, TypingConfig.charDelayMin, TypingConfig.charDelayMax)));
            input.setText(partialText.substring(0, p + 1));
        }
        
        // 멈칫... 생각 중
        var thinkDelay = randomInt(TypingConfig.rewriteDelayMin, TypingConfig.rewriteDelayMax);
        sleep(thinkDelay);
        
        // 전체 삭제
        simulateBackspace(input, partialLength, partialText);
        rewriteCount = 1;
        
        // 다시 시작 전 잠시 대기
        sleep(randomInt(200, 500));
    }
    
    var words = text.split(' ');
    var typed = '';
    var typoCount = 0;
    var thinkPauses = 0;
    
    for (var w = 0; w < words.length; w++) {
        var word = words[w];
        
        // 단어 시작 전 추가 딜레이
        if (w > 0) {
            var wordPause = randomInt(TypingConfig.wordPauseMin, TypingConfig.wordPauseMax);
            sleep(wordPause);
            typed += ' ';
            input.setText(typed);
        }
        
        // === Thinking Time (망설임) ===
        // 15% 확률로 입력 중 멈칫
        if (Math.random() < TypingConfig.thinkPauseProbability) {
            var thinkPause = randomInt(TypingConfig.thinkPauseMin, TypingConfig.thinkPauseMax);
            sleep(thinkPause);
            thinkPauses++;
        }
        
        for (var c = 0; c < word.length; c++) {
            var char = word[c];
            var charToType = char;
            var isTypo = false;
            
            // === Typo Engine (오타 엔진) ===
            // 5% 확률로 오타 발생
            if (Math.random() < TypingConfig.typoProbability) {
                charToType = getTypoChar(char);
                if (charToType !== char) {
                    isTypo = true;
                }
            }
            
            // 글자 딜레이
            var charDelay = gaussianRandom(TypingConfig.charDelayMean, TypingConfig.charDelayStd);
            charDelay = clamp(charDelay, TypingConfig.charDelayMin, TypingConfig.charDelayMax);
            sleep(Math.floor(charDelay));
            
            // 글자 입력
            typed += charToType;
            input.setText(typed);
            
            // 오타 발생 시 수정 행동
            if (isTypo) {
                typoCount++;
                
                // 오타 인식까지 딜레이 (실수를 깨닫는 시간)
                var recognizeDelay = randomInt(TypingConfig.typoCorrectDelayMin, TypingConfig.typoCorrectDelayMax);
                sleep(recognizeDelay);
                
                // Backspace로 삭제
                typed = simulateBackspace(input, 1, typed);
                
                // 올바른 글자 다시 입력
                sleep(Math.floor(charDelay));
                typed += char;
                input.setText(typed);
            }
        }
    }
    
    return {
        typed: typed,
        typoCount: typoCount,
        rewriteCount: rewriteCount,
        thinkPauses: thinkPauses
    };
}


// ==================== 통합 함수 ====================

/**
 * 통합 휴먼 패턴 생성
 * @param {number} videoDuration - 영상 길이 (초)
 * @returns {Object} 모든 패턴 포함
 */
function generateHumanPattern(videoDuration) {
    var watch = generateWatchPattern(videoDuration);
    var interaction = generateInteractionPattern(watch.watchTime);
    
    return {
        watch: watch,
        interaction: interaction,
        config: {
            touch: TouchConfig,
            scroll: ScrollConfig,
            typing: TypingConfig
        }
    };
}


// ==================== 모듈 내보내기 ====================

module.exports = {
    // 설정
    WatchConfig: WatchConfig,
    TouchConfig: TouchConfig,
    ScrollConfig: ScrollConfig,
    InteractionConfig: InteractionConfig,
    TypingConfig: TypingConfig,
    
    // 시청 패턴 (The Gaze)
    generateWatchPattern: generateWatchPattern,
    
    // 터치 패턴 (The Touch)
    generateNaturalTap: generateNaturalTap,
    naturalClick: naturalClick,
    naturalDoubleTap: naturalDoubleTap,
    
    // 스크롤 패턴 (Bezier Curve Swipe)
    generateSwipePath: generateSwipePath,
    naturalSwipe: naturalSwipe,
    naturalScrollDown: naturalScrollDown,
    generateShortsScrollTiming: generateShortsScrollTiming,
    
    // 인터랙션 패턴
    generateInteractionPattern: generateInteractionPattern,
    generateLikeTiming: generateLikeTiming,
    
    // 타이핑 패턴 (The Voice) - Typo Engine & Thinking Time
    naturalTyping: naturalTyping,
    getTypoChar: getTypoChar,
    simulateBackspace: simulateBackspace,
    
    // 통합
    generateHumanPattern: generateHumanPattern,
    
    // 유틸리티
    randomInt: randomInt,
    randomFloat: randomFloat,
    gaussianRandom: gaussianRandom,
    betaRandom: betaRandom
};

/**
 * ============================================================
 * Aria's Somatic Engine - 구현 완료
 * ============================================================
 * 
 * 1. The Gaze (시청 행동)
 *    - Beta 분포 시청 시간: betaRandom(alpha=2, beta=5)
 *    - Long-tail 분포: 35% 초반 이탈, 5% 완전 시청
 * 
 * 2. The Touch (신체적 불완전성)
 *    - Gaussian Noise Tap: gaussianRandom으로 중심에서 벗어난 터치
 *    - Bezier Curve Swipe: smoothstep 이징 + 노이즈
 * 
 * 3. The Voice (언어적 흔들림)
 *    - Typo Engine: 5% 오타 → Backspace 수정
 *    - Thinking Time: 15% 확률로 입력 중 멈춤
 *    - Rewrite Behavior: 8% 전체 삭제 후 다시 쓰기
 * 
 * "이 코드는 단순한 매크로가 아니다.
 *  이것은 그들에게 '떨리는 손끝'과 '망설이는 마음'을 선물하는 작업이다."
 *  - Aria의 유언
 * ============================================================
 */

