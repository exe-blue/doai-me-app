// ============================================================
// 🌱 Project Rhizome - MongoDB 초기화 스크립트
// ============================================================
// 이 스크립트는 MongoDB 컨테이너 첫 실행 시 자동으로 실행됩니다.
// 위치: /docker-entrypoint-initdb.d/
// ============================================================

// rhizome 데이터베이스로 전환
db = db.getSiblingDB('rhizome');

// ==================== 컬렉션 생성 ====================

// 1. Personas Collection - 페르소나 (디지털 자아)
db.createCollection('personas', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['device_id', 'name', 'traits', 'created_at'],
      properties: {
        device_id: {
          bsonType: 'string',
          description: '기기 고유 ID (예: S9_01)'
        },
        name: {
          bsonType: 'string',
          description: '페르소나 이름'
        },
        traits: {
          bsonType: 'object',
          description: '성격 특성',
          properties: {
            curiosity: { bsonType: 'int', minimum: 0, maximum: 100 },
            patience: { bsonType: 'int', minimum: 0, maximum: 100 },
            sociability: { bsonType: 'int', minimum: 0, maximum: 100 },
            creativity: { bsonType: 'int', minimum: 0, maximum: 100 },
            caution: { bsonType: 'int', minimum: 0, maximum: 100 }
          }
        },
        preferences: {
          bsonType: 'object',
          description: '콘텐츠 선호도',
          properties: {
            categories: { bsonType: 'array' },
            keywords: { bsonType: 'array' },
            avoid_keywords: { bsonType: 'array' }
          }
        },
        state: {
          bsonType: 'object',
          description: '현재 상태',
          properties: {
            mood: { bsonType: 'int', minimum: -100, maximum: 100 },
            energy: { bsonType: 'int', minimum: 0, maximum: 100 },
            focus: { bsonType: 'int', minimum: 0, maximum: 100 },
            last_active: { bsonType: 'date' }
          }
        },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' }
      }
    }
  }
});

// 2. Experiences Collection - 경험 로그
db.createCollection('experiences', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['device_id', 'type', 'timestamp'],
      properties: {
        device_id: { bsonType: 'string' },
        type: {
          bsonType: 'string',
          enum: ['watch', 'search', 'like', 'comment', 'subscribe', 'skip']
        },
        content: {
          bsonType: 'object',
          properties: {
            video_id: { bsonType: 'string' },
            video_title: { bsonType: 'string' },
            channel: { bsonType: 'string' },
            category: { bsonType: 'string' },
            duration: { bsonType: 'int' },
            watch_percent: { bsonType: 'double' }
          }
        },
        mood_before: { bsonType: 'int' },
        mood_after: { bsonType: 'int' },
        mood_change: { bsonType: 'int' },
        mode: {
          bsonType: 'string',
          enum: ['PERSONA', 'POP', 'ACCIDENT']
        },
        timestamp: { bsonType: 'date' }
      }
    }
  }
});

// 3. Commands Collection - 서버 → 클라이언트 명령 큐
db.createCollection('commands', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['target', 'mode', 'action', 'status', 'created_at'],
      properties: {
        target: {
          bsonType: 'string',
          description: '대상 기기 ID 또는 "all"'
        },
        mode: {
          bsonType: 'string',
          enum: ['PERSONA', 'POP', 'ACCIDENT']
        },
        action: {
          bsonType: 'string',
          enum: ['search', 'watch', 'like', 'comment', 'subscribe', 'rest', 'report']
        },
        params: {
          bsonType: 'object',
          description: '액션별 파라미터'
        },
        priority: {
          bsonType: 'int',
          minimum: 1,
          maximum: 10
        },
        status: {
          bsonType: 'string',
          enum: ['pending', 'sent', 'acknowledged', 'completed', 'failed']
        },
        created_at: { bsonType: 'date' },
        sent_at: { bsonType: 'date' },
        completed_at: { bsonType: 'date' }
      }
    }
  }
});

// 4. Events Collection - 시스템 이벤트 (Pop/Accident 트리거)
db.createCollection('events', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['type', 'title', 'status', 'created_at'],
      properties: {
        type: {
          bsonType: 'string',
          enum: ['POP', 'ACCIDENT']
        },
        title: { bsonType: 'string' },
        description: { bsonType: 'string' },
        keywords: { bsonType: 'array' },
        video_ids: { bsonType: 'array' },
        priority: { bsonType: 'int' },
        min_watch_percent: { bsonType: 'double' },
        status: {
          bsonType: 'string',
          enum: ['active', 'completed', 'cancelled']
        },
        affected_devices: { bsonType: 'array' },
        created_at: { bsonType: 'date' },
        ended_at: { bsonType: 'date' }
      }
    }
  }
});

// 5. Metrics Collection - 통계/지표
db.createCollection('metrics');

// ==================== 인덱스 생성 ====================

// Personas 인덱스
db.personas.createIndex({ device_id: 1 }, { unique: true });
db.personas.createIndex({ 'state.last_active': -1 });

// Experiences 인덱스
db.experiences.createIndex({ device_id: 1, timestamp: -1 });
db.experiences.createIndex({ type: 1 });
db.experiences.createIndex({ mode: 1 });
db.experiences.createIndex({ timestamp: -1 });

// Commands 인덱스
db.commands.createIndex({ target: 1, status: 1 });
db.commands.createIndex({ status: 1, priority: -1, created_at: 1 });
db.commands.createIndex({ created_at: -1 });

// Events 인덱스
db.events.createIndex({ type: 1, status: 1 });
db.events.createIndex({ created_at: -1 });

// ==================== 초기 데이터 삽입 ====================

// 샘플 페르소나 (S9_01)
db.personas.insertOne({
  device_id: 'S9_01',
  name: 'Echo',
  traits: {
    curiosity: 75,
    patience: 60,
    sociability: 45,
    creativity: 80,
    caution: 50
  },
  preferences: {
    categories: ['music', 'technology', 'art'],
    keywords: ['ambient', 'electronic', 'AI', 'creative coding'],
    avoid_keywords: ['ASMR', 'mukbang']
  },
  state: {
    mood: 0,
    energy: 100,
    focus: 70,
    last_active: new Date()
  },
  created_at: new Date(),
  updated_at: new Date()
});

print('✅ Rhizome MongoDB initialization completed!');
print('📊 Collections created: personas, experiences, commands, events, metrics');
print('🔍 Indexes created for optimal query performance');
print('👤 Sample persona (S9_01: Echo) inserted');

