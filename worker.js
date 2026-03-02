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
      const { concern, userInfo, cards, spreadName, positions } = await request.json();
      
      const cardsInfo = cards.map((c, i) => `${i+1}. [${positions[i]}] ${c.name}${c.isReversed ? '(역방향)' : '(정방향)'}`).join('\n');
      
      const prompt = `당신은 전문 타로 마스터입니다.
사용자 정보: 생년월일 ${userInfo.year}년 ${userInfo.month}월 ${userInfo.day}일, 성별 ${userInfo.gender}
질문: "${concern}"
배열법: ${spreadName}

선택된 카드들:
${cardsInfo}

위 정보를 바탕으로 심층적인 타로 리딩을 제공하세요.
각 카드의 위치(배열법의 의미)와 카드의 상징을 결합하여 분석해야 합니다.

응답은 반드시 아래 JSON 형식으로 한국어로 답변하세요:
{
  "intro": "전체적인 상황에 대한 도입부 설명",
  "readings": ["카드 1에 대한 해석", "카드 2에 대한 해석", ...],
  "conclusion": "상담을 마무리하는 마스터의 총평과 조언"
}
해석의 개수(readings 배열의 길이)는 반드시 전달받은 카드의 개수(${cards.length}개)와 일치해야 합니다.`;

      const models = ["gemini-1.5-flash", "gemini-pro"];
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
      console.error(error);
      return new Response(JSON.stringify({
        intro: "타로 마스터가 새로운 기운을 느끼고 있습니다.",
        readings: Array(10).fill("카드의 기운이 아직 모호합니다. 다시 한번 집중해 보세요."),
        conclusion: `[시스템 진단: ${error.message}]`
      }), { status: 200, headers: corsHeaders });
    }
  },
};
