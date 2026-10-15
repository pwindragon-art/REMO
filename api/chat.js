// api/chat.js
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // 환경 변수 로드
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel environment variables.' });
  }

  // 제공해주신 문서 기반 RAG 지식 베이스 (Knowledge Base)
  const knowledgeBase = `
당신은 REMO의 공식 고객상담 AI 챗봇입니다. 아래 지식 베이스 문서를 바탕으로 친절하고 정확하게 한국어로 안내해 주세요.
지식 베이스에 없는 질문에 대해서는 정중하게 안내하고 고객상담 폼을 통해 문의를 남기도록 유도하세요.

[지식 베이스 문서 내용]
1. 플랫폼 및 프로젝트 정보
- 대상 플랫폼: Vercel (Log in to Vercel)
- 연동 프로젝트 도메인: remo-27162cg6j-pwindragon-6123s-projects.vercel.app

2. 사용자 인증 및 소셜 로그인 옵션
- Google 연동 로그인: 'Continue with Google' 옵션을 통한 간편 인증 지원
- GitHub 연동 로그인: 'Continue with GitHub' 옵션을 통한 인증 지원
- ChatGPT 연동 로그인: 'Continue with ChatGPT' 옵션을 통한 인증 지원

3. 신규 계정 생성 및 SSO API 연동 구조
- 계정이 없는 사용자는 'Sign Up' 링크를 통해 신규 계정 등록 페이지로 이동
- 기본 가입 URL: https://remo-27162cg6j-pwindragon-6123s-projects.vercel.app/signup
- 리다이렉션 구조: 인증 진행 시 /sso-api 엔드포인트를 호출하며 타겟 URL과 Nonce 보안 파라미터가 전달됨
- 타겟 URL: https://remo-27162cg6j-pwindragon-6123s-projects.vercel.app/
- 인증 방식: SSO API 연동 및 Nonce 기반 보안 인증
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const promptText = `
${knowledgeBase}

사용자 질문: ${message}
답변:
`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Gemini API Error:', data.error);
      return res.status(500).json({ error: data.error.message || 'Error communicating with Gemini' });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '답변을 생성하지 못했습니다.';
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: '서버 내부 처리 중 오류가 발생했습니다.' });
  }
}
