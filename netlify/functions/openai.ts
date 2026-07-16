import OpenAI from 'openai';

const POLICY_VERSION = '2026-07-16';
const CONSENT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_TEXT_LENGTH = 12_000;
const MAX_HISTORY_MESSAGES = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ACTIONS = new Set(['career-recommendations', 'recommend-materials', 'career-chat', 'esg-feedback']);
const VALUE_CHAIN_IDS = new Set(['step1', 'step2', 'step3', 'step4', 'step5', 'step6']);

interface ConsentPayload {
  granted?: unknown;
  policyVersion?: unknown;
  agreedAt?: unknown;
  consentSessionId?: unknown;
}

interface HistoryItem {
  role?: unknown;
  text?: unknown;
}

interface MaterialItem {
  id?: unknown;
  title?: unknown;
  majors?: unknown;
  keywords?: unknown;
}

interface RequestPayload {
  action?: unknown;
  consent?: unknown;
  subjects?: unknown;
  job?: unknown;
  thought?: unknown;
  materials?: unknown;
  material?: unknown;
  thoughts?: unknown;
  history?: unknown;
}

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const isValidConsent = (value: unknown): value is ConsentPayload => {
  if (!value || typeof value !== 'object') return false;
  const consent = value as ConsentPayload;
  const agreedAt = typeof consent.agreedAt === 'string' ? Date.parse(consent.agreedAt) : NaN;
  const age = Date.now() - agreedAt;
  return consent.granted === true
    && consent.policyVersion === POLICY_VERSION
    && Number.isFinite(agreedAt)
    && age >= -5 * 60 * 1000
    && age <= CONSENT_MAX_AGE_MS
    && typeof consent.consentSessionId === 'string'
    && UUID_PATTERN.test(consent.consentSessionId);
};

const readText = (value: unknown, maxLength = MAX_TEXT_LENGTH): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
};

const readHistory = (value: unknown): Array<{ role: 'user' | 'assistant'; content: string }> | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_HISTORY_MESSAGES) return null;
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const item of value as HistoryItem[]) {
    if (!item || typeof item !== 'object' || (item.role !== 'user' && item.role !== 'model')) return null;
    const text = readText(item.text, 8_000);
    if (!text) return null;
    history.push({ role: item.role === 'model' ? 'assistant' : 'user', content: text });
  }
  return history;
};

const readMaterials = (value: unknown): Array<{ id: string; title: string; majors: string[]; keywords: string[] }> | null => {
  if (!Array.isArray(value) || value.length > 100) return null;
  const materials: Array<{ id: string; title: string; majors: string[]; keywords: string[] }> = [];
  for (const raw of value as MaterialItem[]) {
    if (!raw || typeof raw !== 'object') return null;
    const id = readText(raw.id, 120);
    const title = readText(raw.title, 300);
    const majors = Array.isArray(raw.majors) ? raw.majors.filter((item): item is string => typeof item === 'string').slice(0, 20) : null;
    const keywords = Array.isArray(raw.keywords) ? raw.keywords.filter((item): item is string => typeof item === 'string').slice(0, 30) : null;
    if (!id || !title || !majors || !keywords) return null;
    materials.push({ id, title, majors, keywords });
  }
  return materials;
};

const COMMON_SYSTEM = [
  '당신은 고등학생을 돕는 친절하고 비판적인 한국어 진로·ESG 교육 멘토입니다.',
  '학생이 스스로 사고하도록 짧고 구체적인 질문을 사용하고, 사실이 불확실하면 불확실성을 명시하세요.',
  'AI 답변은 틀릴 수 있으므로 중요한 정보는 신뢰할 수 있는 다른 출처에서 교차 검증하도록 안내하세요.',
  '이름, 연락처, 학교·학급, 주소, 주민등록번호, 건강·상담 기록, 성적 등 민감하거나 개인을 식별할 수 있는 정보가 보이면 반복하거나 추론하지 말고 삭제를 안내하세요.',
  '모든 답변은 한국어로 작성하세요.',
].join('\n');

const GENERATED_MATERIAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recommendedIds: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 2,
    },
    generatedMaterial: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        valueChain: { type: 'string', enum: Array.from(VALUE_CHAIN_IDS) },
        content: { type: 'string' },
        majors: { type: 'array', items: { type: 'string' } },
        keywords: { type: 'array', items: { type: 'string' } },
        references: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
            },
            required: ['title', 'url'],
          },
          minItems: 2,
          maxItems: 5,
        },
      },
      required: ['title', 'valueChain', 'content', 'majors', 'keywords', 'references'],
    },
  },
  required: ['recommendedIds', 'generatedMaterial'],
};

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'POST 요청만 허용합니다.' });
  }

  let body: RequestPayload;
  try {
    body = await request.json() as RequestPayload;
  } catch {
    return jsonResponse(400, { error: '올바른 JSON 요청이 아닙니다.' });
  }

  if (!isValidConsent(body.consent)) {
    return jsonResponse(403, { error: '유효한 보호자 동의가 필요합니다.' });
  }
  if (typeof body.action !== 'string' || !ALLOWED_ACTIONS.has(body.action)) {
    return jsonResponse(400, { error: '허용되지 않은 AI 작업입니다.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse(503, { error: '서버의 OpenAI API 설정이 완료되지 않았습니다.' });
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

  try {
    if (body.action === 'career-recommendations') {
      if (!Array.isArray(body.subjects) || body.subjects.length === 0 || body.subjects.length > 20) {
        return jsonResponse(400, { error: '선택 과목을 확인해 주세요.' });
      }
      const subjects = body.subjects.map((subject) => readText(subject, 100));
      if (subjects.some((subject) => !subject)) return jsonResponse(400, { error: '선택 과목 형식이 올바르지 않습니다.' });
      const prompt = [
        `학생이 대학에서 배우고 싶어 하는 과목: ${subjects.join(', ')}`,
        '이 과목을 바탕으로 잘 맞을 수 있는 학과 3개와 구체적인 직업 5개를 이유와 함께 추천하세요.',
        '표 대신 읽기 쉬운 글머리표를 쓰고, 단정하지 말고 탐색을 돕는 격려 문체로 답하세요.',
      ].join('\n');
      const response = await client.responses.create({
        model,
        instructions: COMMON_SYSTEM,
        input: prompt,
        store: false,
      });
      const text = response.output_text?.trim();
      return text ? jsonResponse(200, { text }) : jsonResponse(502, { error: 'AI가 빈 응답을 반환했습니다.' });
    }

    if (body.action === 'recommend-materials') {
      const job = readText(body.job, 300);
      const thought = typeof body.thought === 'string' && body.thought.length <= 4_000 ? body.thought.trim() : null;
      const materials = readMaterials(body.materials);
      if (!job || thought === null || !materials) return jsonResponse(400, { error: '진로 또는 자료 형식이 올바르지 않습니다.' });
      const prompt = [
        `학생의 희망 직업: ${job}`,
        `학생이 생각한 AI·반도체와의 연결: ${thought || '(작성하지 않음)'}`,
        '기존 자료 목록에서 관련성이 가장 높은 ID를 최대 2개 고르세요.',
        '동시에 희망 직업을 AI·반도체 가치사슬과 연결하는 새로운 한국어 심층 읽기 자료 1개를 작성하세요.',
        '자료의 content에는 배경 탐구, 사회·경제·환경 관점, 진로 확장 질문 2개를 포함하세요.',
        '검증 가능한 사실에는 APA 7 본문 내 인용을 쓰고, content 마지막에 APA 7 참고문헌을 넣으세요.',
        'references에는 실제로 확인한 공신력 있는 원문 제목과 직접 URL만 넣으세요. 출처를 만들거나 추측하지 마세요.',
        `기존 자료: ${JSON.stringify(materials)}`,
      ].join('\n');
      const response = await client.responses.create({
        model,
        instructions: COMMON_SYSTEM,
        input: prompt,
        tools: [{ type: 'web_search' }] as never,
        text: {
          format: {
            type: 'json_schema',
            name: 'career_material_result',
            strict: true,
            schema: GENERATED_MATERIAL_SCHEMA,
          },
        } as never,
        store: false,
      });
      const text = response.output_text?.trim();
      if (!text) return jsonResponse(502, { error: 'AI가 빈 응답을 반환했습니다.' });
      const result = JSON.parse(text) as Record<string, unknown>;
      return jsonResponse(200, { result });
    }

    const history = readHistory(body.history);
    const job = readText(body.job, 300);
    const material = body.material && typeof body.material === 'object' ? body.material as Record<string, unknown> : null;
    const materialTitle = material ? readText(material.title, 500) : null;
    if (!history || !job || !materialTitle) return jsonResponse(400, { error: '대화 맥락 형식이 올바르지 않습니다.' });

    let instructions = COMMON_SYSTEM;
    if (body.action === 'career-chat') {
      const valueChain = material && typeof material.valueChain === 'string' && VALUE_CHAIN_IDS.has(material.valueChain)
        ? material.valueChain
        : '미지정';
      instructions += [
        '',
        `학생의 희망 직업: ${job}`,
        `읽는 자료: ${materialTitle}`,
        `AI·반도체 가치사슬 단계: ${valueChain}`,
        '소크라테스 문답법으로 학생이 이 자료와 자신의 진로 연결을 스스로 발견하도록 도우세요.',
        '답을 바로 주기보다 한 번에 핵심 질문 하나를 하고, 학생 수준에 맞춰 난이도를 조절하세요.',
      ].join('\n');
    } else {
      const thoughts = body.thoughts && typeof body.thoughts === 'object' ? body.thoughts as Record<string, unknown> : null;
      const env = thoughts ? readText(thoughts.env, 4_000) : null;
      const soc = thoughts ? readText(thoughts.soc, 4_000) : null;
      const eco = thoughts ? readText(thoughts.eco, 4_000) : null;
      if (!env || !soc || !eco) return jsonResponse(400, { error: 'ESG 생각을 모두 작성해 주세요.' });
      instructions += [
        '',
        `학생의 희망 직업: ${job}`,
        `관련 자료: ${materialTitle}`,
        `환경 관점: ${env}`,
        `사회 관점: ${soc}`,
        `경제·제도 관점: ${eco}`,
        '500자 이내의 간결한 ESG 코칭을 제공하세요.',
        '칭찬만 하지 말고 현실적 제약, 부작용, 공정성 중 하나를 검토하게 하는 날카로운 질문 하나를 포함하세요.',
      ].join('\n');
    }

    const response = await client.responses.create({
      model,
      instructions,
      input: history as never,
      store: false,
    });
    const text = response.output_text?.trim();
    return text ? jsonResponse(200, { text }) : jsonResponse(502, { error: 'AI가 빈 응답을 반환했습니다.' });
  } catch {
    return jsonResponse(502, { error: 'AI 응답을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
};
