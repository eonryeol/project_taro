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
        결과는 반드시 다음 JSON 형식으로만 응답하세요. 마크다운 기호 없이 순수 JSON 텍스트만 보내주세요:
        {
          "intro": "전체적인 흐름에 대한 짧은 도입부",
          "readings": ["과거 카드 해석", "현재 카드 해석", "미래 카드 해석"],
          "conclusion": "마지막 희망적인 조언"
        }
      `;

      // 1.5-flash 모델과 v1beta 엔드포인트는 가장 최신이자 널리 지원되는 방식입니다.
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        // API 에러 시 기본 해석을 반환하여 서비스가 멈추지 않게 함
        return new Response(JSON.stringify({
          intro: "지금은 타로의 기운이 조금 흐릿한 시기군요.",
          readings: [
            "과거에는 정해진 길을 걸어오며 많은 것을 배우셨네요.",
            "현재는 당신의 선택이 가장 중요한 시점에 와 있습니다.",
            "미래에는 당신의 노력에 따른 멋진 보상이 기다리고 있어요."
          ],
          conclusion: "잠시 후 다시 시도해보시면 더 깊은 통찰을 드릴 수 있습니다."
        }), { status: 200, headers: corsHeaders });
      }

      let aiText = data.candidates[0].content.parts[0].text;
      
      // 마크다운 제거 로직
      aiText = aiText.replace(/```json|```/g, "").trim();

      return new Response(aiText, {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });

    } catch (error) {
      // 서버 내부 에러 시에도 기본 해석 반환
      return new Response(JSON.stringify({
        intro: "잠시 동안 타로 마스터와 연결이 불안정합니다.",
        readings: ["과거의 기운은 고요합니다.", "현재는 집중이 필요한 때입니다.", "미래는 희망으로 가득 차 있네요."],
        conclusion: "마음을 차분히 가라앉히고 나중에 다시 찾아와 주세요."
      }), { status: 200, headers: corsHeaders });
    }
  },
};
