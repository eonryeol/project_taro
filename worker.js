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

    const apiKey = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.trim() : null;

    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: "설정 오류", 
        message: "GEMINI_API_KEY가 등록되지 않았습니다." 
      }), { status: 401, headers: corsHeaders });
    }

    try {
      const { concern, cards } = await request.json();

      const prompt = `
        당신은 신비로운 타로 마스터입니다. 고민: "${concern}"
        카드: 1.${cards[0].name}, 2.${cards[1].name}, 3.${cards[2].name}
        위 고민과 카드를 분석해 따뜻한 조언을 JSON으로만 답하세요:
        {"intro": "...", "readings": ["...", "...", "..."], "conclusion": "..."}
      `;

      // 가장 표준적인 v1beta 엔드포인트와 모델명을 사용합니다.
      const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(apiURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Google이 보내는 실제 에러 메시지를 프론트엔드로 그대로 전달합니다.
        return new Response(JSON.stringify({
          intro: "타로 마스터의 통찰이 잠시 가려졌습니다.",
          readings: ["연결 상태를 확인 중입니다.", "API 설정을 점검 중입니다.", "잠시 후 다시 시도해주세요."],
          conclusion: `[Google API 에러: ${JSON.stringify(data.error || data)}]`
        }), { status: 200, headers: corsHeaders });
      }

      let aiText = data.candidates[0].content.parts[0].text;
      aiText = aiText.replace(/```json|```/g, "").trim();

      return new Response(aiText, {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        intro: "마스터와 연결할 수 없습니다.",
        readings: ["네트워크 상태를 확인해주세요.", "서버 응답이 지연되고 있습니다.", "다시 한 번 시도해주세요."],
        conclusion: `[통신 에러: ${error.message}]`
      }), { status: 200, headers: corsHeaders });
    }
  },
};
