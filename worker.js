export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    
    const apiKey = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.trim() : null;
    if (!apiKey) return new Response(JSON.stringify({ error: "API 키가 등록되지 않았습니다." }), { status: 401, headers: corsHeaders });

    try {
      const { concern, cards } = await request.json();
      const prompt = `타로 마스터로서 고민("${concern}")과 카드(1.${cards[0].name}, 2.${cards[1].name}, 3.${cards[2].name})를 분석해 JSON으로 답하세요. 반드시 한국어로 답변하세요: {"intro":"..","readings":["..","..",".."],"conclusion":".."}`;

      // 시도해볼 최신 모델 리스트 (Gemini 2.0 Flash 우선)
      const models = ["gemini-2.0-flash-exp", "gemini-1.5-flash"];
      let lastError = "";
      let finalData = null;

      for (const model of models) {
        try {
          const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const response = await fetch(apiURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });

          const data = await response.json();
          if (response.ok && data.candidates) {
            finalData = data;
            break;
          } else {
            // limit: 0 에러가 포함되어 있는지 확인
            const errMsg = data.error ? data.error.message : "알 수 없는 오류";
            if (errMsg.includes("limit: 0")) {
              lastError = "지역 제한(Region Restricted) 에러입니다. 구글 AI 무료 티어는 특정 국가(유럽 등)에서 제한됩니다. Google AI Studio에서 결제 수단(Pay-as-you-go)을 등록하면 즉시 해결됩니다.";
            } else {
              lastError = errMsg;
            }
          }
        } catch (e) {
          lastError = e.message;
        }
      }

      if (!finalData) throw new Error(lastError);

      let aiText = finalData.candidates[0].content.parts[0].text;
      aiText = aiText.replace(/```json|```/g, "").trim();

      return new Response(aiText, {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        intro: "타로 마스터가 지금은 자리를 비운 것 같군요.",
        readings: [
          "과거의 흐름은 당신에게 인내를 가르치고 있습니다.",
          "현재는 잠시 멈춰서 상황을 재점검할 때입니다.",
          "미래의 길은 곧 다시 열릴 것이니 너무 조급해하지 마세요."
        ],
        conclusion: `[진단: ${error.message}]`
      }), { status: 200, headers: corsHeaders });
    }
  },
};
