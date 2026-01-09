/**
 * IdleWatchMode.js
 * Handles idle mode YouTube watching when no active queue exists
 *
 * Flow:
 * 1. Request search keyword from OpenAI
 * 2. Launch YouTube app
 * 3. Search keyword with human simulation
 * 4. Random scroll (1-5 times)
 * 5. Select random video from results
 * 6. Watch 5-60 seconds with random touches
 * 7. 5% chance: write AI-generated comment
 * 8. 10% chance: like video
 * 9. Log to persona_youtube_history
 * 10. Return to step 1
 */

const EventEmitter = require('events');

class IdleWatchMode extends EventEmitter {
  constructor(options = {}) {
    super();

    this.laixiAdapter = options.laixiAdapter;
    this.supabaseClient = options.supabaseClient;
    this.humanSimulator = options.humanSimulator;
    this.automationAI = options.automationAI;

    // Device state tracking
    this.deviceStates = new Map();  // deviceSerial -> IdleState

    // Configuration
    this.config = {
      maxConsecutiveErrors: 3,
      cooldownAfterErrorMs: 30000,
      ...options.config
    };

    // Statistics
    this.stats = {
      totalCycles: 0,
      videosWatched: 0,
      likesGiven: 0,
      commentsWritten: 0,
      errors: 0
    };
  }

  /**
   * Start idle mode for a device
   */
  async startDevice(deviceSerial, persona = null) {
    if (this.deviceStates.has(deviceSerial)) {
      console.log(`[IdleWatchMode] Device ${deviceSerial} already running`);
      return false;
    }

    const state = {
      deviceSerial,
      persona,
      isRunning: true,
      isPaused: false,
      currentCycle: 0,
      consecutiveErrors: 0,
      recentKeywords: [],
      lastActivity: null
    };

    this.deviceStates.set(deviceSerial, state);

    console.log(`[IdleWatchMode] Starting device ${deviceSerial}`);
    this.emit('deviceStarted', { deviceSerial, persona: persona?.id });

    // Start the idle loop
    this._runIdleLoop(deviceSerial);

    return true;
  }

  /**
   * Stop idle mode for a device
   */
  async stopDevice(deviceSerial) {
    const state = this.deviceStates.get(deviceSerial);
    if (!state) {
      return false;
    }

    state.isRunning = false;
    console.log(`[IdleWatchMode] Stopping device ${deviceSerial}`);
    this.emit('deviceStopped', { deviceSerial });

    return true;
  }

  /**
   * Pause idle mode for a device (for queue priority)
   */
  pauseDevice(deviceSerial) {
    const state = this.deviceStates.get(deviceSerial);
    if (!state) return false;

    state.isPaused = true;
    this.emit('devicePaused', { deviceSerial });
    return true;
  }

  /**
   * Resume idle mode for a device
   */
  resumeDevice(deviceSerial) {
    const state = this.deviceStates.get(deviceSerial);
    if (!state) return false;

    state.isPaused = false;
    this.emit('deviceResumed', { deviceSerial });
    return true;
  }

  /**
   * Main idle loop for a device
   */
  async _runIdleLoop(deviceSerial) {
    const state = this.deviceStates.get(deviceSerial);
    if (!state) return;

    while (state.isRunning) {
      try {
        // Check if paused
        if (state.isPaused) {
          await this._wait(1000);
          continue;
        }

        // Run one idle cycle
        await this._runIdleCycle(deviceSerial, state);

        // Reset error counter on success
        state.consecutiveErrors = 0;

      } catch (error) {
        state.consecutiveErrors++;
        this.stats.errors++;

        console.error(`[IdleWatchMode] Device ${deviceSerial} error (${state.consecutiveErrors}/${this.config.maxConsecutiveErrors}):`, error.message);

        this.emit('cycleError', {
          deviceSerial,
          error: error.message,
          consecutiveErrors: state.consecutiveErrors
        });

        // Too many errors, pause device
        if (state.consecutiveErrors >= this.config.maxConsecutiveErrors) {
          console.warn(`[IdleWatchMode] Device ${deviceSerial} paused due to repeated errors`);
          state.isPaused = true;
          await this._wait(this.config.cooldownAfterErrorMs);
          state.isPaused = false;
          state.consecutiveErrors = 0;
        }
      }
    }

    // Cleanup
    this.deviceStates.delete(deviceSerial);
    console.log(`[IdleWatchMode] Device ${deviceSerial} loop ended`);
  }

  /**
   * Run a single idle cycle
   */
  async _runIdleCycle(deviceSerial, state) {
    const cycleStart = Date.now();
    state.currentCycle++;
    this.stats.totalCycles++;

    this.emit('cycleStarted', {
      deviceSerial,
      cycleNumber: state.currentCycle
    });

    // 1. Generate search keyword
    const keywordResult = await this.automationAI.generateSearchKeyword(
      state.persona,
      { recentKeywords: state.recentKeywords }
    );
    const keyword = keywordResult.keyword;

    // Track recent keywords to avoid repetition
    state.recentKeywords.push(keyword);
    if (state.recentKeywords.length > 10) {
      state.recentKeywords.shift();
    }

    this.emit('keywordGenerated', { deviceSerial, keyword, source: keywordResult.source });

    // 2. Launch YouTube and search
    await this._launchYouTube(deviceSerial);
    await this.humanSimulator.wait('idle');

    await this._searchKeyword(deviceSerial, keyword);
    await this.humanSimulator.wait('idle');

    // 3. Random scroll
    const scrollParams = this.humanSimulator.generateScrollParams('idle');
    await this._performScrolls(deviceSerial, scrollParams);

    // 4. Select random video
    const videoRank = this.humanSimulator.generateVideoRank(5);
    await this._selectVideo(deviceSerial, videoRank);
    await this.humanSimulator.wait('idle');

    // 5. Watch video
    const watchDuration = this.humanSimulator.generateWatchDuration('idle');
    const watchResult = await this._watchVideo(deviceSerial, watchDuration);

    // 6. Engagement actions
    let liked = false;
    let commented = false;
    let commentContent = null;

    if (this.humanSimulator.shouldLike('idle')) {
      await this._clickLike(deviceSerial);
      liked = true;
      this.stats.likesGiven++;
    }

    if (this.humanSimulator.shouldComment('idle')) {
      const commentResult = await this.automationAI.generateComment(
        { title: watchResult.videoTitle || keyword },
        state.persona
      );
      await this._writeComment(deviceSerial, commentResult.comment);
      commented = true;
      commentContent = commentResult.comment;
      this.stats.commentsWritten++;
    }

    // 7. Go back to home
    await this._pressBack(deviceSerial);

    // 8. Log to database
    await this._logIdleWatch({
      deviceSerial,
      personaId: state.persona?.id,
      keyword,
      keywordSource: keywordResult.source,
      videoTitle: watchResult.videoTitle,
      videoChannel: watchResult.videoChannel,
      videoUrl: watchResult.videoUrl,
      watchDuration: watchResult.actualWatchTime,
      scrollCount: scrollParams.totalScrolls,
      liked,
      commented,
      commentContent
    });

    this.stats.videosWatched++;
    state.lastActivity = new Date();

    const cycleDuration = Date.now() - cycleStart;

    this.emit('cycleCompleted', {
      deviceSerial,
      cycleNumber: state.currentCycle,
      keyword,
      watchDuration: watchResult.actualWatchTime,
      liked,
      commented,
      cycleDurationMs: cycleDuration
    });
  }

  // ===== Device Actions =====

  async _launchYouTube(deviceSerial) {
    if (!this.laixiAdapter) {
      throw new Error('LaixiAdapter not configured');
    }
    await this.laixiAdapter.openApp([deviceSerial], 'youtube');
  }

  async _searchKeyword(deviceSerial, keyword) {
    // Tap search icon (normalized coords)
    const searchIconCoord = this.humanSimulator.generateNormalizedClickPosition(0.85, 0.05, 'idle');
    await this.laixiAdapter.tap([deviceSerial], searchIconCoord.x, searchIconCoord.y);
    await this.humanSimulator.waitRange(500, 1000);

    // Tap search input
    const searchInputCoord = this.humanSimulator.generateNormalizedClickPosition(0.5, 0.05, 'idle');
    await this.laixiAdapter.tap([deviceSerial], searchInputCoord.x, searchInputCoord.y);
    await this.humanSimulator.waitRange(300, 600);

    // Type keyword (use clipboard for Korean)
    const hasKorean = /[가-힣]/.test(keyword);
    if (hasKorean) {
      await this.laixiAdapter.setClipboard([deviceSerial], keyword);
      await this.humanSimulator.waitRange(200, 400);
      await this.laixiAdapter.paste([deviceSerial]);
    } else {
      await this.laixiAdapter.inputText([deviceSerial], keyword);
    }

    // Press enter
    await this.humanSimulator.waitRange(300, 600);
    await this.laixiAdapter.sendKey([deviceSerial], 66);  // KEYCODE_ENTER

    // Wait for results to load
    await this.humanSimulator.waitRange(2000, 4000);
  }

  async _performScrolls(deviceSerial, scrollParams) {
    for (const segment of scrollParams.segments) {
      await this.laixiAdapter.swipe([deviceSerial], 'up');
      await this.humanSimulator.waitMs(segment.pauseAfter);
    }
  }

  async _selectVideo(deviceSerial, rank) {
    // Calculate Y position based on rank (normalized)
    const yPositions = [0.25, 0.45, 0.65, 0.85, 0.95];
    const y = yPositions[Math.min(rank - 1, yPositions.length - 1)];

    const coord = this.humanSimulator.generateNormalizedClickPosition(0.5, y, 'idle');
    await this.laixiAdapter.tap([deviceSerial], coord.x, coord.y);
  }

  async _watchVideo(deviceSerial, durationSeconds) {
    const startTime = Date.now();
    let videoTitle = null;
    let videoChannel = null;
    let videoUrl = null;

    // Watch with occasional random touches
    let elapsed = 0;
    while (elapsed < durationSeconds * 1000) {
      await this.humanSimulator.waitRange(5000, 10000);

      // Occasional random touch to simulate activity
      if (Math.random() < 0.1) {
        const coord = this.humanSimulator.generateNormalizedClickPosition(0.5, 0.3, 'idle');
        await this.laixiAdapter.tap([deviceSerial], coord.x, coord.y);
      }

      elapsed = Date.now() - startTime;
    }

    return {
      actualWatchTime: Math.round(elapsed / 1000),
      videoTitle,
      videoChannel,
      videoUrl
    };
  }

  async _clickLike(deviceSerial) {
    const coord = this.humanSimulator.generateNormalizedClickPosition(0.15, 0.35, 'idle');
    await this.laixiAdapter.tap([deviceSerial], coord.x, coord.y);
    await this.humanSimulator.waitRange(500, 1000);
  }

  async _writeComment(deviceSerial, comment) {
    // Scroll to comments
    await this.laixiAdapter.swipe([deviceSerial], 'up');
    await this.humanSimulator.waitRange(1000, 2000);

    // Tap comment section
    const commentCoord = this.humanSimulator.generateNormalizedClickPosition(0.5, 0.80, 'idle');
    await this.laixiAdapter.tap([deviceSerial], commentCoord.x, commentCoord.y);
    await this.humanSimulator.waitRange(500, 1000);

    // Type comment
    await this.laixiAdapter.setClipboard([deviceSerial], comment);
    await this.humanSimulator.waitRange(200, 400);
    await this.laixiAdapter.paste([deviceSerial]);

    // Submit
    await this.humanSimulator.waitRange(500, 1000);
    await this.laixiAdapter.sendKey([deviceSerial], 66);  // Enter to post
  }

  async _pressBack(deviceSerial) {
    await this.laixiAdapter.pressBack([deviceSerial]);
  }

  // ===== Database Logging =====

  async _logIdleWatch(data) {
    if (!this.supabaseClient) {
      console.log('[IdleWatchMode] No Supabase client, skipping log');
      return;
    }

    try {
      const { error } = await this.supabaseClient
        .from('persona_youtube_history')
        .insert({
          persona_id: data.personaId,
          device_serial: data.deviceSerial,
          search_keyword: data.keyword,
          keyword_source: data.keywordSource,
          video_title: data.videoTitle,
          video_channel: data.videoChannel,
          video_url: data.videoUrl,
          watch_duration_seconds: data.watchDuration,
          scroll_count: data.scrollCount,
          liked: data.liked,
          commented: data.commented,
          comment_content: data.commentContent,
          human_simulation_config: this.humanSimulator.getConfigSnapshot('idle'),
          completed_at: new Date().toISOString()
        });

      if (error) {
        console.error('[IdleWatchMode] Database log error:', error);
      }
    } catch (error) {
      console.error('[IdleWatchMode] Database error:', error);
    }
  }

  // ===== Utility =====

  async _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== Status Methods =====

  isDeviceRunning(deviceSerial) {
    const state = this.deviceStates.get(deviceSerial);
    return state?.isRunning || false;
  }

  isDevicePaused(deviceSerial) {
    const state = this.deviceStates.get(deviceSerial);
    return state?.isPaused || false;
  }

  getDeviceState(deviceSerial) {
    return this.deviceStates.get(deviceSerial) || null;
  }

  getRunningDevices() {
    const devices = [];
    for (const [serial, state] of this.deviceStates) {
      if (state.isRunning) {
        devices.push(serial);
      }
    }
    return devices;
  }

  getStats() {
    return { ...this.stats };
  }

  // ===== Dependency Injection =====

  setLaixiAdapter(adapter) {
    this.laixiAdapter = adapter;
  }

  setSupabaseClient(client) {
    this.supabaseClient = client;
  }

  setHumanSimulator(simulator) {
    this.humanSimulator = simulator;
  }

  setAutomationAI(ai) {
    this.automationAI = ai;
  }
}

module.exports = { IdleWatchMode };
