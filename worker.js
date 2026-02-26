export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const apiKey = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.trim() : null;
    if (!apiKey) return new Response(JSON.stringify({ error: "API 키 없음" }), { status: 401, headers: corsHeaders });

    try {
      const { concern, cards } = await request.json();
      const prompt = `타로 마스터로서 고민("${concern}")과 카드(1.${cards[0].name}, 2.${cards[1].name}, 3.${cards[2].name})를 분석해 JSON으로 답하세요: {"intro":"..","readings":["..","..",".."],"conclusion":".."}`;

      // 1단계: 현재 이 API 키로 사용 가능한 모델 리스트를 직접 조회합니다.
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const listRes = await fetch(listUrl);
      const listData = await listRes.json();

      let targetModel = "gemini-1.5-flash"; // 기본값

      if (listRes.ok && listData.models) {
        // 사용 가능한 모델 중 'generateContent'를 지원하는 가장 좋은 모델을 찾습니다.
        const available = listData.models.find(m => m.name.includes("gemini-1.5-flash") || m.name.includes("gemini-pro"));
        if (available) {
            // 모델 이름이 "models/gemini-1.5-flash" 형식이므로 그대로 추출
            targetModel = available.name.split("/").pop();
        }
      }

      // 2단계: 찾은 모델로 실제 리딩 요청
      const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
      const response = await fetch(apiURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`모델(${targetModel}) 호출 실패: ${data.error ? data.error.message : "알 수 없는 오류"}`);
      }

      let aiText = data.candidates[0].content.parts[0].text;
      aiText = aiText.replace(/```json|```/g, "").trim();

      return new Response(aiText, {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        intro: "타로 마스터가 깊은 명상에 잠겼습니다.",
        readings: [
          "과거의 경험은 당신의 큰 자산이 될 것입니다.",
          "현재는 당신의 직관을 믿고 나아가야 할 때입니다.",
          "미래는 당신의 선택에 따라 밝게 빛나고 있습니다."
        ],
        conclusion: `[시스템 알림: ${error.message}]`
      }), { status: 200, headers: corsHeaders });
    }
  },
};
