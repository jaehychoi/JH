import React, { useState } from 'react';
import { ConsentEvidence } from '../types';

export const CONSENT_STORAGE_KEY = 'fca_guardian_consent';
export const POLICY_VERSION = '2026-07-16' as const;
const CONSENT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidConsent = (value: unknown): value is ConsentEvidence => {
  if (!value || typeof value !== 'object') return false;
  const consent = value as Partial<ConsentEvidence>;
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

export const readConsentEvidence = (): ConsentEvidence | null => {
  try {
    const stored = sessionStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!isValidConsent(parsed)) {
      sessionStorage.removeItem(CONSENT_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(CONSENT_STORAGE_KEY);
    return null;
  }
};

export const clearConsentEvidence = () => {
  sessionStorage.removeItem(CONSENT_STORAGE_KEY);
};

const createConsentEvidence = (): ConsentEvidence => {
  const fallbackId = '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  return {
    granted: true,
    policyVersion: POLICY_VERSION,
    agreedAt: new Date().toISOString(),
    consentSessionId: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : fallbackId,
  };
};

export const AiProcessingNotice: React.FC = () => (
  <details className="group text-xs text-slate-600">
    <summary className="cursor-pointer font-semibold text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
      AI 처리 안내 및 출처
    </summary>
    <div className="mt-2 space-y-2 leading-relaxed">
      <p>
        선택 과목, 희망 진로, 작성한 생각과 AI 멘토 대화는 맞춤형 진로·ESG 피드백을 만들기 위해
        이 서비스의 서버를 거쳐 OpenAI API로 전송·처리됩니다. 작성 중인 학습 기록은 이 브라우저의
        로컬 저장소에도 저장됩니다. 민감하거나 개인을 식별할 수 있는 정보는 입력하지 마세요.
      </p>
      <p>
        OpenAI API 입력·출력은 명시적으로 옵트인하지 않는 한 모델 훈련에 사용되지 않지만,
        서비스 운영 및 오용 방지를 위한 보관이 있을 수 있습니다 (OpenAI, n.d.-b).
        API 키는 브라우저가 아니라 서버 환경변수로만 관리합니다 (OpenAI, n.d.-a).
      </p>
      <div className="space-y-1 text-[11px] text-slate-500">
        <p>
          OpenAI. (n.d.-a). <em>Best practices for API key safety</em>. OpenAI Help Center.
          Retrieved July 16, 2026, from{' '}
          <a className="underline" href="https://help.openai.com/en/articles/5112595-best-practices-for-api" target="_blank" rel="noreferrer">
            https://help.openai.com/en/articles/5112595-best-practices-for-api
          </a>
        </p>
        <p>
          OpenAI. (n.d.-b). <em>Data controls in the OpenAI platform</em>. OpenAI API.
          Retrieved July 16, 2026, from{' '}
          <a className="underline" href="https://platform.openai.com/docs/models/default-usage-policies-by-endpoint" target="_blank" rel="noreferrer">
            https://platform.openai.com/docs/models/default-usage-policies-by-endpoint
          </a>
        </p>
      </div>
    </div>
  </details>
);

interface ConsentGateProps {
  onConsent: (consent: ConsentEvidence) => void;
}

const ConsentGate: React.FC<ConsentGateProps> = ({ onConsent }) => {
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const canContinue = guardianConfirmed && privacyConfirmed;

  const handleContinue = () => {
    if (!canContinue) return;
    const consent = createConsentEvidence();
    sessionStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    onConsent(consent);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 p-4 sm:p-8">
      <div className="min-h-full flex items-center justify-center">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="guardian-consent-title"
          aria-describedby="guardian-consent-description"
          className="w-full max-w-3xl rounded-3xl bg-white p-6 sm:p-9 shadow-2xl"
        >
          <p className="text-sm font-bold text-blue-700">보호자 동의가 먼저 필요합니다</p>
          <h1 id="guardian-consent-title" className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
            Future Career AI 이용 동의
          </h1>
          <div id="guardian-consent-description" className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
            <p>
              학생이 선택한 과목, 희망 진로, 진로·ESG 생각과 AI 멘토 대화는 맞춤형 피드백 생성을 위해
              이 서비스의 서버를 거쳐 OpenAI API로 전송·처리됩니다. 학습 진행 기록은 이 브라우저의
              로컬 저장소에도 보관됩니다. 동의하지 않으면 앱과 AI 기능을 사용할 수 없습니다.
            </p>
            <p>
              OpenAI API 입력·출력은 명시적으로 옵트인하지 않는 한 모델 훈련에 사용되지 않지만,
              서비스 운영 및 오용 방지를 위한 보관이 있을 수 있습니다 (OpenAI, n.d.-b).
              API 키는 브라우저가 아니라 서버에서만 관리합니다 (OpenAI, n.d.-a).
            </p>
            <p className="rounded-2xl bg-amber-50 p-4 text-amber-900">
              학생 이름, 주민등록번호, 연락처, 학교·학급, 주소, 건강·상담 기록, 성적 등
              민감하거나 개인을 식별할 수 있는 정보는 입력하지 마세요.
            </p>
          </div>

          <fieldset className="mt-6 space-y-4">
            <legend className="sr-only">필수 동의 항목</legend>
            <label className="flex gap-3 rounded-2xl border border-slate-200 p-4 focus-within:ring-2 focus-within:ring-blue-500">
              <input
                type="checkbox"
                checked={guardianConfirmed}
                onChange={(event) => setGuardianConfirmed(event.target.checked)}
                className="mt-1 h-5 w-5 accent-blue-600"
              />
              <span className="text-sm leading-6 text-slate-800">
                본인은 학생의 보호자(법정대리인)이며, 위 AI 처리 안내를 읽고 이용에 동의합니다.
              </span>
            </label>
            <label className="flex gap-3 rounded-2xl border border-slate-200 p-4 focus-within:ring-2 focus-within:ring-blue-500">
              <input
                type="checkbox"
                checked={privacyConfirmed}
                onChange={(event) => setPrivacyConfirmed(event.target.checked)}
                className="mt-1 h-5 w-5 accent-blue-600"
              />
              <span className="text-sm leading-6 text-slate-800">
                학생이 민감정보나 개인을 식별할 수 있는 정보를 입력하지 않도록 지도하겠습니다.
              </span>
            </label>
          </fieldset>

          <button
            type="button"
            disabled={!canContinue}
            onClick={handleContinue}
            className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 font-bold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            동의하고 시작하기
          </button>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <AiProcessingNotice />
          </div>
        </section>
      </div>
    </div>
  );
};

export default ConsentGate;
