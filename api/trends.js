// GET /api/trends?keyword=키워드&geo=KR&timeframe=today 3-m
// 구글 트렌드(무료, 비공식 스크래핑 방식)로 관심도 추이를 조회합니다.
// 참고: 공식 유료 API가 아니라 google-trends-api 라이브러리를 사용하므로
// 가끔 구글 쪽 사정으로 일시적으로 실패할 수 있습니다.

const googleTrends = require("google-trends-api");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }

  const { keyword, geo = "KR", timeframe = "today 3-m" } = req.query;
  if (!keyword) {
    return res.status(400).json({ error: "keyword 파라미터가 필요합니다." });
  }

  try {
    const raw = await googleTrends.interestOverTime({
      keyword,
      geo,
      hl: "ko",
      timeframe // 예: "now 7-d", "today 1-m", "today 3-m", "today 12-m"
    });

    const parsed = JSON.parse(raw);
    const timelineData = parsed?.default?.timelineData || [];

    const points = timelineData.map((p) => ({
      date: p.formattedTime,
      value: p.value ? p.value[0] : null
    }));

    return res.status(200).json({
      keyword,
      geo,
      timeframe,
      points
    });
  } catch (err) {
    return res.status(502).json({
      error: "구글 트렌드 조회에 실패했습니다. 무료 비공식 방식이라 일시적으로 막힐 수 있으니 잠시 후 다시 시도해 주세요.",
      detail: String(err)
    });
  }
};
