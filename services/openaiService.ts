import { ConsentEvidence, EsgThoughts, ReadingMaterial } from '../types';

type OpenAIAction = 'career-recommendations' | 'recommend-materials' | 'career-chat' | 'esg-feedback';

interface OpenAIResponse {
  text?: string;
  result?: {
    recommendedIds?: string[];
    generatedMaterial?: Omit<ReadingMaterial, 'id' | 'isGenerated'>;
  };
  error?: string;
}

interface RequestBody {
  action: OpenAIAction;
  consent: ConsentEvidence;
  subjects?: string[];
  job?: string;
  thought?: string;
  materials?: Array<Pick<ReadingMaterial, 'id' | 'title' | 'majors' | 'keywords'>>;
  material?: Pick<ReadingMaterial, 'title' | 'valueChain'>;
  thoughts?: EsgThoughts;
  history?: Array<{ role: string; text: string }>;
}

const postToOpenAI = async (body: RequestBody): Promise<OpenAIResponse> => {
  const response = await fetch('/.netlify/functions/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let payload: OpenAIResponse;
  try {
    payload = await response.json() as OpenAIResponse;
  } catch {
    throw new Error('AI 서버의 응답을 확인할 수 없습니다.');
  }
  if (!response.ok) {
    throw new Error(payload.error || 'AI 요청을 처리하지 못했습니다.');
  }
  return payload;
};

export const getCareerRecommendations = async (
  subjects: string[],
  consent: ConsentEvidence
): Promise<string> => {
  const payload = await postToOpenAI({ action: 'career-recommendations', subjects, consent });
  if (!payload.text?.trim()) throw new Error('AI가 빈 응답을 반환했습니다.');
  return payload.text.trim();
};

export const recommendAndGenerateMaterials = async (
  job: string,
  thought: string,
  existingMaterials: ReadingMaterial[],
  consent: ConsentEvidence
): Promise<{ recommended: ReadingMaterial[]; generated: ReadingMaterial | null }> => {
  const payload = await postToOpenAI({
    action: 'recommend-materials',
    job,
    thought,
    materials: existingMaterials.slice(0, 100).map(({ id, title, majors, keywords }) => ({ id, title, majors, keywords })),
    consent,
  });

  const recommendedIds = payload.result?.recommendedIds || [];
  const recommended = existingMaterials.filter((material) => recommendedIds.includes(material.id));
  const rawGenerated = payload.result?.generatedMaterial;
  const generated = rawGenerated
    ? { id: `gen_${Date.now()}`, ...rawGenerated, isGenerated: true }
    : null;
  return { recommended, generated };
};

export const chatWithMentor = async (
  history: Array<{ role: string; text: string }>,
  job: string,
  material: ReadingMaterial,
  consent: ConsentEvidence
): Promise<string> => {
  const payload = await postToOpenAI({
    action: 'career-chat',
    history: history.slice(-20).map(({ role, text }) => ({ role, text })),
    job,
    material: { title: material.title, valueChain: material.valueChain },
    consent,
  });
  if (!payload.text?.trim()) throw new Error('AI가 빈 응답을 반환했습니다.');
  return payload.text.trim();
};

export const generateEsgFeedback = async (
  job: string,
  materialTitle: string,
  thoughts: EsgThoughts,
  history: Array<{ role: string; text: string }>,
  consent: ConsentEvidence
): Promise<string> => {
  const payload = await postToOpenAI({
    action: 'esg-feedback',
    history: history.slice(-20).map(({ role, text }) => ({ role, text })),
    job,
    material: { title: materialTitle, valueChain: '' },
    thoughts,
    consent,
  });
  if (!payload.text?.trim()) throw new Error('AI가 빈 응답을 반환했습니다.');
  return payload.text.trim();
};
