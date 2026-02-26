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

      // 사용자 요청에 따라 Gemini 2.5 Flash 를 최우선으로 사용합니다.
      const models = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash"];
      let lastError = "";
      let finalData = null;

      for (const model of models) {
        try {
          // v1beta 엔드포인트가 최신 모델 지원에 가장 적합합니다.
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
            const errMsg = data.error ? data.error.message : "알 수 없는 오류";
            lastError = `[${model}] ${errMsg}`;
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
        intro: "타로 마스터가 새로운 기운을 느끼고 있습니다.",
        readings: [
          "과거의 흐름이 당신에게 지혜를 주고 있습니다.",
          "현재는 명확한 판단이 필요한 시기입니다.",
          "미래는 당신의 결단에 따라 변화할 것입니다."
        ],
        conclusion: `[진단: ${error.message}]`
      }), { status: 200, headers: corsHeaders });
    }
  },
};
