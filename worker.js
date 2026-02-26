export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ 
        error: "설정 오류", 
        message: "GEMINI_API_KEY 환경 변수가 등록되지 않았습니다." 
      }), { status: 401, headers: corsHeaders });
    }

    try {
      const { concern, cards } = await request.json();

      const prompt = `
        당신은 신비롭고 통찰력 있는 타로 마스터입니다. 
        사용자의 고민: "${concern}"
        
        선택된 카드 3장:
        1. 과거: ${cards[0].name} (${cards[0].isReversed ? '역방향' : '정방향'})
        2. 현재: ${cards[1].name} (${cards[1].isReversed ? '역방향' : '정방향'})
        3. 미래: ${cards[2].name} (${cards[2].isReversed ? '역방향' : '정방향'})

        위 고민과 카드 조합을 분석하여, 진짜 타로 마스터처럼 따뜻하고 구체적인 조언을 해주세요.
        결과는 반드시 다음 JSON 형식으로만 응답하세요. 다른 설명 텍스트나 마크다운 기호 없이 순수 JSON만 보내주세요:
        {
          "intro": "전체적인 흐름에 대한 짧은 도입부",
          "readings": ["과거 카드 해석", "현재 카드 해석", "미래 카드 해석"],
          "conclusion": "마지막 희망적인 조언"
        }
      `;

      // 가장 기본적이고 널리 쓰이는 구버전 엔드포인트와 모델 사용 (확실한 작동 보장)
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return new Response(JSON.stringify({ 
          error: "API 에러", 
          details: data.error ? data.error.message : "API 호출 중 오류 발생" 
        }), { status: response.status, headers: corsHeaders });
      }

      if (!data.candidates || !data.candidates[0].content.parts[0].text) {
          throw new Error("응답 데이터가 올바르지 않습니다.");
      }

      let aiText = data.candidates[0].content.parts[0].text;
      
      // 마크다운 코드 블록 및 불필요한 공백 제거
      aiText = aiText.replace(/```json|```/g, "").trim();
      
      try {
        JSON.parse(aiText);
      } catch (e) {
        aiText = JSON.stringify({
          intro: "타로 카드를 통해 상황을 살펴보았습니다.",
          readings: ["과거의 영향이 느껴집니다.", "현재의 상황을 직시해야 합니다.", "미래의 가능성이 열려 있습니다."],
          conclusion: "당신의 앞날에 행운이 깃들길 바랍니다."
        });
      }

      return new Response(aiText, {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: "서버 내부 에러", message: error.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  },
};
