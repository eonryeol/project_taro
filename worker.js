export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    
    const apiKey = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.trim() : null;
    if (!apiKey) return new Response(JSON.stringify({ error: "API 키가 없습니다." }), { status: 401, headers: corsHeaders });

    try {
      const { concern, cards } = await request.json();
      const prompt = `타로 마스터로서 고민("${concern}")과 카드(1.${cards[0].name}, 2.${cards[1].name}, 3.${cards[2].name})를 분석해 JSON으로 답하세요. 반드시 한국어로 답변하세요: {"intro":"..","readings":["..","..",".."],"conclusion":".."}`;

      // 가장 할당량이 넉넉한 gemini-1.5-flash 모델 하나만 정밀 타격합니다.
      const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(apiURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();

      if (!response.ok) {
        // 할당량 에러(429)나 지역 제한(400/403) 시 구체적인 가이드를 제공합니다.
        let msg = "구글 API 사용량이 초과되었거나 지역 제한에 걸렸습니다.";
        if (data.error && data.error.message.includes("quota")) {
          msg = "구글 API 무료 사용량이 일시적으로 소진되었습니다. 1분 후 다시 시도하거나, Google AI Studio에서 결제 수단을 등록(Pay-as-you-go)하면 즉시 해결됩니다.";
        }
        throw new Error(msg);
      }

      let aiText = data.candidates[0].content.parts[0].text;
      aiText = aiText.replace(/```json|```/g, "").trim();

      return new Response(aiText, {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        intro: "타로 마스터의 연결이 잠시 지연되고 있습니다.",
        readings: [
          "과거의 기운은 당신의 기반이 되었습니다.",
          "현재는 인내하며 기회를 기다려야 할 시기입니다.",
          "미래는 곧 밝은 소식을 가져다줄 것입니다."
        ],
        conclusion: `[안내: ${error.message}]`
      }), { status: 200, headers: corsHeaders });
    }
  },
};
