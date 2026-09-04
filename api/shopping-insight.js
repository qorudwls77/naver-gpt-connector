// GET /api/shopping-insight?name1=화장품/미용&code1=50000002&startDate=2026-08-01&endDate=2026-09-01&timeUnit=week
// 네이버 쇼핑인사이트 API 프록시. 분야별 검색 클릭 트렌드(0~100 상대 비율)를 조회합니다.
// 실제 상품 목록(상품명,가격,링크)이 아니라 "어떤 분야가 얼마나 클릭되는지" 통계입니다.
// 카테고리 코드는 https://datalab.naver.com/shoppingInsight/sCategory.naver 에서
// 분야 선택 시 주소창의 cat_id 값으로 확인합니다. (예: 화장품/미용 = 50000002)
// 최대 3개 분야까지 비교 가능합니다 (name1/code1 ~ name3/code3).

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

  const {
    name1, code1,
    name2, code2,
    name3, code3,
    startDate, endDate,
    timeUnit = "week",
    device
  } = req.query;

  if (!name1 || !code1 || !startDate || !endDate) {
    return res.status(400).json({
      error: "name1, code1, startDate, endDate는 필수입니다. 예) ?name1=화장품/미용&code1=50000002&startDate=2026-08-01&endDate=2026-09-01"
    });
  }

  const category = [{ name: name1, param: [code1] }];
  if (name2 && code2) category.push({ name: name2, param: [code2] });
  if (name3 && code3) category.push({ name: name3, param: [code3] });

  const body = { startDate, endDate, timeUnit, category };
  if (device) body.device = device;

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "서버에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되어 있지 않습니다."
    });
  }

  try {
    const response = await fetch("https://naverapihub.apigw.ntruss.com/shopping/v1/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret
      },
      body: JSON.stringify(body)
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
      error: "네이버 쇼핑인사이트 API 호출에 실패했습니다.",
      status: response.status,
      detail: data
    });
  }

  return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: "네이버 쇼핑인사이트 API 요청 중 오류가 발생했습니다.", detail: String(err) });
  }
};
