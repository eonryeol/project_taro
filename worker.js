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

    if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY.length < 10) {
      return new Response(JSON.stringify({ 
        error: "설정 오류", 
        message: "GEMINI_API_KEY가 등록되지 않았거나 너무 짧습니다. 대시보드를 확인하세요." 
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
        결과는 반드시 다음 JSON 형식으로만 응답하세요:
        {
          "intro": "전체적인 흐름 도입부",
          "readings": ["과거 해석", "현재 해석", "미래 해석"],
          "conclusion": "희망적인 마무리 조언"
        }
      `;

      // 시도해볼 모델과 API 버전 리스트
      const configs = [
        { ver: "v1beta", model: "gemini-1.5-flash" },
        { ver: "v1", model: "gemini-1.5-flash" },
        { ver: "v1beta", model: "gemini-pro" }
      ];

      let lastError = "";
      let finalData = null;

      for (const config of configs) {
        try {
          const apiURL = `https://generativelanguage.googleapis.com/${config.ver}/models/${config.model}:generateContent?key=${env.GEMINI_API_KEY}`;
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
            break; // 성공 시 탈출
          } else {
            lastError = data.error ? data.error.message : `${config.model} failed`;
          }
        } catch (e) {
          lastError = e.message;
        }
      }

      if (!finalData) {
        throw new Error(lastError || "모든 모델 연결 실패");
      }

      let aiText = finalData.candidates[0].content.parts[0].text;
      aiText = aiText.replace(/```json|```/g, "").trim();

      return new Response(aiText, {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });

    } catch (error) {
      // 모든 AI 호출 실패 시 "품격 있는" 기본 해석 반환
      return new Response(JSON.stringify({
        intro: "신비로운 타로의 기운이 잠시 안개에 가려져 있군요.",
        readings: [
          "과거에는 당신의 성장을 위한 소중한 경험들이 쌓여왔습니다.",
          "현재는 스스로를 믿고 한 걸음 더 나아갈 용기가 필요한 때입니다.",
          "미래에는 당신의 진심이 닿아 밝은 빛이 비칠 것입니다."
        ],
        conclusion: `마스터의 깊은 통찰은 잠시 후에 다시 드리겠습니다. (에러 원인: ${error.message})`
      }), { status: 200, headers: corsHeaders });
    }
  },
};
