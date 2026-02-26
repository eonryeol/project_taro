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

    // API 키 유효성 체크 (공백 제거 포함)
    const apiKey = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.trim() : null;

    if (!apiKey || apiKey.length < 10) {
      return new Response(JSON.stringify({ 
        error: "설정 오류", 
        message: "GEMINI_API_KEY가 등록되지 않았거나 올바르지 않습니다." 
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

        위 고민과 카드 조합을 분석하여 따뜻하고 구체적인 조언을 해주세요.
        결과는 반드시 다음 JSON 형식으로만 응답하세요. 다른 설명은 하지 마세요:
        {
          "intro": "전체적인 흐름 도입부",
          "readings": ["과거 해석", "현재 해석", "미래 해석"],
          "conclusion": "희망적인 마무리 조언"
        }
      `;

      // 가장 성공률이 높은 순서대로 모델 리스트 재구성
      const configs = [
        { ver: "v1", model: "gemini-1.5-flash" },
        { ver: "v1beta", model: "gemini-1.5-flash" },
        { ver: "v1", model: "gemini-pro" },
        { ver: "v1beta", model: "gemini-pro" },
        { ver: "v1beta", model: "gemini-1.5-flash-latest" }
      ];

      let lastError = "";
      let finalData = null;

      for (const config of configs) {
        try {
          const apiURL = `https://generativelanguage.googleapis.com/${config.ver}/models/${config.model}:generateContent?key=${apiKey}`;
          const response = await fetch(apiURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          });

          const data = await response.json();
          if (response.ok && data.candidates && data.candidates[0].content.parts[0].text) {
            finalData = data;
            break; 
          } else {
            lastError = data.error ? data.error.message : `${config.model} (${config.ver}) 호출 실패`;
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
      // 모든 AI 호출 실패 시 제공될 고정 리딩 (사용자가 에러를 느끼지 않도록 자연스럽게 구성)
      return new Response(JSON.stringify({
        intro: "신비로운 타로의 기운이 당신의 주변을 감싸고 있군요.",
        readings: [
          "과거에는 당신의 마음속에 씨앗을 심는 중요한 결정들이 있었습니다. 그 선택들이 지금의 당신을 만들었죠.",
          "현재는 상황을 냉철하게 직시하고, 당신 내면의 목소리에 귀를 기울여야 할 때입니다. 이미 당신은 답을 알고 있을지도 몰라요.",
          "미래에는 당신이 간절히 원하는 변화의 바람이 불어올 것입니다. 포기하지 않고 나아간다면 밝은 결실을 보게 될 거예요."
        ],
        conclusion: `마스터의 깊은 통찰은 잠시 후에 다시 드리겠습니다. (에러 코드: ${error.message.substring(0, 50)})`
      }), { status: 200, headers: corsHeaders });
    }
  },
};
