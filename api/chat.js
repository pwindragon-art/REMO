// api/chat.js
export default async function handler(req, res) {
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

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  let modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  modelName = modelName.replace('models/', '').trim();

  // 구글 스프레드시트 Web App URL
  const googleScriptUrl =
    process.env.GOOGLE_SHEET_WEBAPP_URL ||
    'https://script.google.com/macros/s/AKfycbwPl2qfPmpIYB46ASsaYGse62tI_-RXP3FQwW-tnYOd7pcUCsf8lMc6c7ChYgy3mmnt/exec';

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel environment variables.' });
  }

  const knowledgeBase = `
당신은 REMO의 공식 고객상담 AI 챗봇입니다. 아래 지식 베이스 문서를 바탕으로 친절하고 정확하게 한국어로 안내해 주세요.

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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${knowledgeBase}\n\n사용자 질문: ${message}\n답변:` }]
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
      return res.status(500).json({ error: data.error.message || 'Gemini 응답 생성 중 오류가 발생했습니다.' });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '답변을 생성하지 못했습니다.';

    // [구글 시트로 대화 기록 전송 (가장 안전한 방식)]
    if (googleScriptUrl) {
      try {
        const queryParams = new URLSearchParams({
          type: 'chatbot',
          question: message,
          answer: reply
        });

        // URL 쿼리 파라미터와 redirect: 'follow'를 명시하여 구글 Apps Script로 확실히 전달
        await fetch(`${googleScriptUrl}?${queryParams.toString()}`, {
          method: 'POST',
          redirect: 'follow'
        });
      } catch (sheetErr) {
        console.error('구글 시트 저장 실패:', sheetErr);
      }
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: '서버 내부 처리 중 오류가 발생했습니다.' });
  }
}
