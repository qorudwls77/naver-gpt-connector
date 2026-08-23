// GET /api/search?query=검색어&type=blog&display=10&start=1&sort=sim
// 네이버 검색 API(카테고리 검색) 프록시. type으로 카테고리를 지정합니다.

const VALID_TYPES = [
  "blog", "news", "book", "encyc", "cafearticle",
  "kin", "local", "webkr", "image", "shop", "doc", "movie"
];

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

  const { query, type = "blog", display = "10", start = "1", sort = "sim" } = req.query;

  if (!query) {
    return res.status(400).json({ error: "query 파라미터가 필요합니다." });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({
      error: `지원하지 않는 type입니다. 가능한 값: ${VALID_TYPES.join(", ")}`
    });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "서버에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되어 있지 않습니다."
    });
  }

  const url = new URL(`https://openapi.naver.com/v1/search/${type}.json`);
  url.searchParams.set("query", query);
  url.searchParams.set("display", display);
  url.searchParams.set("start", start);
  url.searchParams.set("sort", sort);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        // 구(舊) 네이버 오픈API 검색 인증 헤더
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
        // 신규 NCP API Gateway 스타일 헤더 (계정에 따라 이 방식이 필요할 수 있어 함께 전송)
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret
      }
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "네이버 검색 API 호출에 실패했습니다.",
        status: response.status,
        detail: data
      });
    }

    return res.status(200).json({
      query,
      type,
      total: data.total,
      start: data.start,
      display: data.display,
      items: data.items || []
    });
  } catch (err) {
    return res.status(502).json({ error: "네이버 검색 API 요청 중 오류가 발생했습니다.", detail: String(err) });
  }
};
